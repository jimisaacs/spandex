/**
 * Telemetry Collector: wrap spatial indexes to track usage metrics
 *
 * **Privacy**: Aggregate stats only, no user data
 * **Performance**: <1ms overhead per operation
 * **Opt-in**: Disabled by default
 *
 * ```typescript
 * const telemetry = new TelemetryCollector({
 *   enabled: true,
 *   onReport: (metrics) => Logger.log(JSON.stringify(metrics))
 * });
 * const wrapped = telemetry.wrap(index, 'backgroundColor');
 * ```
 */

import type { Rectangle, SpatialIndex } from '@jim/spandex';
import type { InsertMetric, QueryMetric } from './metrics.ts';
import type { TelemetryConfig, TelemetrySnapshot } from './types.ts';

/**
 * Telemetry collector that wraps a SpatialIndex implementation
 */
export class TelemetryCollector {
	private config: Required<TelemetryConfig>;
	private sessionId: string;

	// Metrics buffers
	private insertMetrics: InsertMetric[] = [];
	private queryMetrics: QueryMetric[] = [];
	private unboundedQueriesCount = 0;
	private operationCount = 0;

	constructor(config: TelemetryConfig) {
		this.config = {
			enabled: config.enabled,
			reportingInterval: config.reportingInterval ?? 1000,
			onReport: config.onReport ?? (() => {}),
			sessionId: config.sessionId ?? this.generateSessionId(),
		};
		this.sessionId = this.config.sessionId;
	}

	/**
	 * Wrap a SpatialIndex implementation with telemetry
	 */
	wrap<T>(index: SpatialIndex<T>, propertyName: string): SpatialIndex<T> {
		if (!this.config.enabled) {
			return index; // No-op wrapper if disabled
		}

		const implementationName = index.constructor.name;

		return new Proxy(index, {
			get: (target: SpatialIndex<T>, prop: string) => {
				const original = target[prop as keyof SpatialIndex<T>];

				if (typeof original !== 'function') {
					return original;
				}

				// Intercept insert()
				if (prop === 'insert') {
					return (bounds: Rectangle, value: T) => {
						const start = performance.now();

						// Check if this insert will cause overlap
						const existingRanges = Array.from(target.query(bounds)).map(([bounds, value]) => ({
							bounds,
							value,
						}));
						const hadOverlap = existingRanges.length > 0;
						const overlapArea = hadOverlap ? this.calculateOverlapArea(bounds, existingRanges) : 0;

						// Execute original insert
						const result = (original as SpatialIndex<T>['insert']).call(target, bounds, value);

						const duration = performance.now() - start;
						const nAfter = Array.from(target.query()).length;

						this.recordInsert({
							timestamp: Date.now(),
							durationMs: duration,
							n: nAfter,
							hadOverlap,
							overlapArea: hadOverlap ? overlapArea : undefined,
						});

						return result;
					};
				}

				// Intercept query()
				if (prop === 'query') {
					return (bounds?: Rectangle) => {
						const start = performance.now();
						const n = Array.from(target.query()).length;
						const queryArea = bounds ? this.calculateArea(bounds) : undefined;

						const result = (original as SpatialIndex<T>['query']).call(target, bounds);

						const duration = performance.now() - start;

						// Only record query metrics if bounds provided (not unbounded query)
						if (bounds !== undefined) {
							this.recordQuery({
								timestamp: Date.now(),
								durationMs: duration,
								n,
								queryArea: queryArea!,
							});
						} else {
							// Count as unbounded query operation (returns all ranges)
							this.unboundedQueriesCount++;
							this.operationCount++;
							this.checkReporting(implementationName, propertyName);
						}

						return result;
					};
				}

				return original;
			},
		});
	}

	private recordInsert(metric: InsertMetric): void {
		this.insertMetrics.push(metric);
		this.operationCount++;
	}

	private recordQuery(metric: QueryMetric): void {
		this.queryMetrics.push(metric);
		this.operationCount++;
	}

	private checkReporting(implementationName: string, propertyName: string): void {
		if (this.operationCount >= this.config.reportingInterval) {
			const snapshot = this.generateSnapshot(implementationName, propertyName);
			this.config.onReport(snapshot);
			this.reset();
		}
	}

	private generateSnapshot(implementationName: string, propertyName: string): TelemetrySnapshot {
		const nSamples = [...this.insertMetrics.map((m) => m.n), ...this.queryMetrics.map((m) => m.n)];
		const insertDurations = this.insertMetrics.map((m) => m.durationMs);
		const queryDurations = this.queryMetrics.map((m) => m.durationMs);

		return {
			timestamp: Date.now(),
			sessionId: this.sessionId,
			propertyName,
			implementationName,
			nDistribution: this.calculateDistribution(nSamples),
			operations: {
				inserts: this.insertMetrics.length,
				queries: this.queryMetrics.length,
				unboundedQueries: this.unboundedQueriesCount,
			},
			queryPatterns: this.analyzeQueryPatterns(),
			insertPatterns: this.analyzeInsertPatterns(),
			performance: {
				insertP50: this.percentile(insertDurations, 0.5),
				insertP95: this.percentile(insertDurations, 0.95),
				insertP99: this.percentile(insertDurations, 0.99),
				queryP50: this.percentile(queryDurations, 0.5),
				queryP95: this.percentile(queryDurations, 0.95),
				queryP99: this.percentile(queryDurations, 0.99),
			},
		};
	}

	private calculateDistribution(samples: number[]): TelemetrySnapshot['nDistribution'] {
		if (!samples.length) {
			return { min: 0, max: 0, mean: 0, median: 0, p95: 0, p99: 0, samples: [] };
		}

		const sorted = samples.slice().sort((a, b) => a - b);
		return {
			min: sorted[0],
			max: sorted[sorted.length - 1],
			mean: samples.reduce((a, b) => a + b, 0) / samples.length,
			median: this.percentile(sorted, 0.5),
			p95: this.percentile(sorted, 0.95),
			p99: this.percentile(sorted, 0.99),
			samples: sorted,
		};
	}

	private analyzeQueryPatterns(): TelemetrySnapshot['queryPatterns'] {
		const totalArea = this.queryMetrics.reduce((sum, m) => sum + m.queryArea, 0);
		const avgQueryArea = this.queryMetrics.length ? totalArea / this.queryMetrics.length : 0;

		// Heuristic: >80% of infinite space = full export, <10% = viewport
		const fullExportQueries = this.queryMetrics.filter((m) => m.queryArea > 1e10).length;
		const viewportQueries = this.queryMetrics.filter((m) => m.queryArea < 10000).length;

		return {
			avgQueryArea,
			fullExportQueries,
			viewportQueries,
		};
	}

	private analyzeInsertPatterns(): TelemetrySnapshot['insertPatterns'] {
		const sequential = this.insertMetrics.filter((m) => !m.hadOverlap).length;
		const overlapping = this.insertMetrics.filter((m) => m.hadOverlap).length;

		const overlapAreas = this.insertMetrics.filter((m) => m.hadOverlap && m.overlapArea).map((m) => m.overlapArea!);
		const avgOverlapArea = overlapAreas.length ? overlapAreas.reduce((a, b) => a + b, 0) / overlapAreas.length : 0;

		return {
			sequential,
			overlapping,
			avgOverlapArea,
		};
	}

	private percentile(sorted: number[], p: number): number {
		if (!sorted.length) return 0;
		const index = Math.ceil(sorted.length * p) - 1;
		return sorted[Math.max(0, index)];
	}

	private calculateArea(bounds: Rectangle): number {
		const [x, y, x2, y2] = bounds;
		const rows = y2 - y + 1; // Closed interval
		const cols = x2 - x + 1;
		return rows * cols;
	}

	private calculateOverlapArea<T>(
		newRange: Rectangle,
		existingRanges: Array<{ bounds: Rectangle; value: T }>,
	): number {
		// Calculate total area of overlap between newRange and existingRanges
		let totalOverlap = 0;
		for (const existing of existingRanges) {
			totalOverlap += this.calculateIntersectionArea(newRange, existing.bounds);
		}
		return totalOverlap;
	}

	private calculateIntersectionArea(r1: Rectangle, r2: Rectangle): number {
		const [r1x, r1y, r1x2, r1y2] = r1;
		const [r2x, r2y, r2x2, r2y2] = r2;

		const overlapX1 = Math.max(r1x, r2x);
		const overlapY1 = Math.max(r1y, r2y);
		const overlapX2 = Math.min(r1x2, r2x2);
		const overlapY2 = Math.min(r1y2, r2y2);

		if (overlapX1 <= overlapX2 && overlapY1 <= overlapY2) {
			return (overlapX2 - overlapX1 + 1) * (overlapY2 - overlapY1 + 1);
		}
		return 0;
	}

	private generateSessionId(): string {
		return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	private reset(): void {
		this.insertMetrics = [];
		this.queryMetrics = [];
		this.unboundedQueriesCount = 0;
		this.operationCount = 0;
	}

	/**
	 * Force report current metrics (useful for shutdown/testing)
	 */
	forceReport(implementationName: string, propertyName: string): TelemetrySnapshot {
		const snapshot = this.generateSnapshot(implementationName, propertyName);
		this.config.onReport(snapshot);
		this.reset();
		return snapshot;
	}
}
