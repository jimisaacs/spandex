/**
 * Spandex Telemetry
 *
 * Instrumentation for production spatial indexes. Tracks operations, overlaps, and performance.
 *
 * ```typescript
 * import { TelemetryCollector } from '@local/spandex-telemetry';
 *
 * const telemetry = new TelemetryCollector({
 *   enabled: true,
 *   reportingInterval: 1000,
 *   onReport: (metrics) => console.log(metrics),
 * });
 *
 * const wrappedIndex = telemetry.wrap(index, 'backgroundColor');
 * ```
 */

export * from './collector.ts';
export * from './types.ts';
