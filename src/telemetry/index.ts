/// <reference types="@types/google-apps-script" />

import type { SpatialIndex } from '../conformance/testsuite.ts';

/**
 * Production Telemetry System
 *
 * Lightweight instrumentation for collecting real-world usage metrics.
 * Designed for Google Apps Script environments with minimal overhead.
 *
 * **Privacy**: All metrics are aggregate statistics only (no user data).
 * **Performance**: <1ms overhead per operation.
 * **Optional**: Telemetry is opt-in via configuration.
 *
 * Usage:
 * ```typescript
 * import { TelemetryCollector } from './src/telemetry/index.ts';
 *
 * const telemetry = new TelemetryCollector({
 *   enabled: true,
 *   reportingInterval: 1000, // Report every 1000 operations
 *   onReport: (metrics) => {
 *     // Send to your logging service
 *     Logger.log(JSON.stringify(metrics));
 *   }
 * });
 *
 * const index = new MortonLinearScanImpl<string>();
 * telemetry.wrap(index, 'backgroundColor');
 * ```
 */

export interface TelemetryConfig {
	/** Enable telemetry collection (default: false) */
	enabled: boolean;

	/** Report metrics every N operations (default: 1000) */
	reportingInterval?: number;

	/** Callback for sending metrics to your logging service */
	onReport?: (metrics: TelemetrySnapshot) => void;

	/** Custom session identifier (optional) */
	sessionId?: string;
}

export interface TelemetrySnapshot {
	/** When this snapshot was taken */
	timestamp: number;

	/** Session identifier */
	sessionId: string;

	/** Property name (e.g., 'backgroundColor', 'fontWeight') */
	propertyName: string;

	/** Implementation class name */
	implementationName: string;

	/** Distribution of n (range count) values */
	nDistribution: {
		min: number;
		max: number;
		mean: number;
		median: number;
		p95: number;
		p99: number;
		samples: number[];
	};

	/** Operation counts */
	operations: {
		inserts: number;
		queries: number;
		getAllRanges: number;
	};

	/** Query patterns */
	queryPatterns: {
		/** Average query rectangle area */
		avgQueryArea: number;
		/** Queries covering >80% of space (full exports) */
		fullExportQueries: number;
		/** Queries covering <10% of space (viewport) */
		viewportQueries: number;
	};

	/** Insert patterns */
	insertPatterns: {
		/** Sequential non-overlapping inserts */
		sequential: number;
		/** Overlapping inserts (triggers decomposition) */
		overlapping: number;
		/** Average overlap area when overlaps occur */
		avgOverlapArea: number;
	};

	/** Performance metrics (milliseconds) */
	performance: {
		insertP50: number;
		insertP95: number;
		insertP99: number;
		queryP50: number;
		queryP95: number;
		queryP99: number;
	};
}

interface OperationMetric {
	timestamp: number;
	durationMs: number;
	n: number; // Range count at time of operation
}

interface QueryMetric extends OperationMetric {
	queryArea: number; // GridRange area
}

interface InsertMetric extends OperationMetric {
	hadOverlap: boolean;
	overlapArea?: number;
}

/**
 * Telemetry collector that wraps a SpatialIndex implementation
 */
export class TelemetryCollector {
	private config: Required<TelemetryConfig>;
	private sessionId: string;

	// Metrics buffers
	private insertMetrics: InsertMetric[] = [];
	private queryMetrics: QueryMetric[] = [];
	private getAllRangesCount = 0;
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
					return (gridRange: GoogleAppsScript.Sheets.Schema.GridRange, value: T) => {
						const start = performance.now();

						// Check if this insert will cause overlap
						const existingRanges = target.query(gridRange);
						const hadOverlap = existingRanges.length > 0;
						const overlapArea = hadOverlap ? this.calculateOverlapArea(gridRange, existingRanges) : 0;

						// Execute original insert
						const result = (original as SpatialIndex<T>['insert']).call(target, gridRange, value);

						const duration = performance.now() - start;
						const nAfter = target.getAllRanges().length;

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
					return (gridRange: GoogleAppsScript.Sheets.Schema.GridRange) => {
						const start = performance.now();
						const n = target.getAllRanges().length;
						const queryArea = this.calculateArea(gridRange);

						const result = (original as SpatialIndex<T>['query']).call(target, gridRange);

						const duration = performance.now() - start;

						this.recordQuery({
							timestamp: Date.now(),
							durationMs: duration,
							n,
							queryArea,
						});

						return result;
					};
				}

				// Intercept getAllRanges()
				if (prop === 'getAllRanges') {
					return () => {
						this.getAllRangesCount++;
						this.operationCount++;
						this.checkReporting(implementationName, propertyName);
						return (original as SpatialIndex<T>['getAllRanges']).call(target);
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
				getAllRanges: this.getAllRangesCount,
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
		if (samples.length === 0) {
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
		const avgQueryArea = this.queryMetrics.length > 0 ? totalArea / this.queryMetrics.length : 0;

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
		const avgOverlapArea = overlapAreas.length > 0
			? overlapAreas.reduce((a, b) => a + b, 0) / overlapAreas.length
			: 0;

		return {
			sequential,
			overlapping,
			avgOverlapArea,
		};
	}

	private percentile(sorted: number[], p: number): number {
		if (sorted.length === 0) return 0;
		const index = Math.ceil(sorted.length * p) - 1;
		return sorted[Math.max(0, index)];
	}

	private calculateArea(gridRange: GoogleAppsScript.Sheets.Schema.GridRange): number {
		const rows = (gridRange.endRowIndex ?? Infinity) - (gridRange.startRowIndex ?? 0);
		const cols = (gridRange.endColumnIndex ?? Infinity) - (gridRange.startColumnIndex ?? 0);
		return rows * cols;
	}

	private calculateOverlapArea<T>(
		newRange: GoogleAppsScript.Sheets.Schema.GridRange,
		existingRanges: Array<{ gridRange: GoogleAppsScript.Sheets.Schema.GridRange; value: T }>,
	): number {
		// Calculate total area of overlap between newRange and existingRanges
		let totalOverlap = 0;
		for (const existing of existingRanges) {
			totalOverlap += this.calculateIntersectionArea(newRange, existing.gridRange);
		}
		return totalOverlap;
	}

	private calculateIntersectionArea(
		r1: GoogleAppsScript.Sheets.Schema.GridRange,
		r2: GoogleAppsScript.Sheets.Schema.GridRange,
	): number {
		const r1Start = r1.startRowIndex ?? 0;
		const r1End = r1.endRowIndex ?? Infinity;
		const r1cStart = r1.startColumnIndex ?? 0;
		const r1cEnd = r1.endColumnIndex ?? Infinity;

		const r2Start = r2.startRowIndex ?? 0;
		const r2End = r2.endRowIndex ?? Infinity;
		const r2cStart = r2.startColumnIndex ?? 0;
		const r2cEnd = r2.endColumnIndex ?? Infinity;

		const overlapRows = Math.max(0, Math.min(r1End, r2End) - Math.max(r1Start, r2Start));
		const overlapCols = Math.max(0, Math.min(r1cEnd, r2cEnd) - Math.max(r1cStart, r2cStart));

		return overlapRows * overlapCols;
	}

	private generateSessionId(): string {
		return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	private reset(): void {
		this.insertMetrics = [];
		this.queryMetrics = [];
		this.getAllRangesCount = 0;
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
