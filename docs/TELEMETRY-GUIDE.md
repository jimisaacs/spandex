# Production Telemetry Guide

Collect real-world usage metrics to validate optimization decisions.

## Why Telemetry?

Validate "n<100 is typical" assumption with production data.

**Questions to answer**:

- Real `n` distributions?
- Real query patterns? (viewport vs full exports)
- Real overlap patterns? (sequential vs random)
- Actual bottlenecks?

## Quick Start

```typescript
import { TelemetryCollector } from '@local/spandex-telemetry';
import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';

// 1. Create telemetry collector
const telemetry = new TelemetryCollector({
	enabled: true,
	reportingInterval: 1000, // Report every 1000 operations
	onReport: (metrics) => {
		// Send to your logging service (e.g., Google Cloud Logging)
		console.log(JSON.stringify(metrics));
		// Or: Logger.log(JSON.stringify(metrics)); in Apps Script
	},
});

// 2. Wrap your spatial index
const backgroundColors = createMortonLinearScanIndex<string>();
const wrapped = telemetry.wrap(backgroundColors, 'backgroundColor');

// 3. Use normally (Rectangle format: [xmin, ymin, xmax, ymax])
wrapped.insert([0, 0, 4, 4], 'red');
wrapped.query([0, 0, 9, 9]);

// Metrics auto-collected and reported
```

## What Gets Collected

### Metrics Collected

**`nDistribution`**: `min`, `max`, `mean`, `median`, `p95`, `p99` - Validates "n<100 is typical"

**`operations`**: `inserts`, `queries` - Read vs write balance

**`queryPatterns`**: `avgQueryArea`, `fullExportQueries`, `viewportQueries` - Viewport vs full exports

**`insertPatterns`**: `sequential`, `overlapping`, `avgOverlapArea` - Decomposition overhead

**`performance`**: `insertP50/P95/P99`, `queryP50/P95/P99` - Latency bottlenecks

## Configuration

```typescript
interface TelemetryConfig {
	/** Enable telemetry (default: false) */
	enabled: boolean;

	/** Report every N operations (default: 1000) */
	reportingInterval?: number;

	/** Callback for metrics */
	onReport?: (metrics: TelemetrySnapshot) => void;

	/** Session identifier (optional) */
	sessionId?: string;
}
```

**Production**: `reportingInterval: 1000`
**Development**: `reportingInterval: 100`
**Testing**: `forceReport()`

## Privacy & Performance

**Privacy**: Aggregate stats only. Never collects cell values, range contents, or user identifiers.

**Performance**: <1ms overhead per operation. Zero when `enabled: false`.

## Apps Script Integration

### Cloud Logging

```typescript
import { TelemetryCollector } from '@local/spandex-telemetry';

const telemetry = new TelemetryCollector({
	enabled: true,
	reportingInterval: 1000,
	onReport: (metrics) => {
		// Google Apps Script Logger
		Logger.log(JSON.stringify(metrics));

		// Or send to external service
		UrlFetchApp.fetch('https://your-logging-endpoint.com/metrics', {
			method: 'post',
			contentType: 'application/json',
			payload: JSON.stringify(metrics),
		});
	},
});
```

### Properties Service (Persistence)

```typescript
function saveTelemetry(metrics: TelemetrySnapshot) {
	const props = PropertiesService.getUserProperties();
	const key = `telemetry_${Date.now()}`;
	props.setProperty(key, JSON.stringify(metrics));
}

const telemetry = new TelemetryCollector({
	enabled: true,
	reportingInterval: 1000,
	onReport: saveTelemetry,
});
```

### Periodic Flush

```typescript
function onDocumentClose() {
	telemetry.forceReport('MortonLinearScanImpl', 'backgroundColor');
}
```

## Analyzing Results

### Key Questions to Answer

**1. Is n<100 typical?**

```
Look at: nDistribution.p95, nDistribution.p99
If p95 < 100: Linear scan is correct choice
If p95 > 200: R-tree should be default
If 100 < p95 < 200: Hybrid/adaptive approach needed
```

**2. What's the workload balance?**

```
Look at: operations.inserts vs operations.queries
If queries >> inserts: Read-optimized matters
If inserts >> queries: Write-optimized matters
If balanced: Mixed workload considerations
```

**3. Are overlaps common?**

```
Look at: insertPatterns.overlapping / insertPatterns.sequential
If ratio < 0.1: Sequential optimization matters
If ratio > 0.5: Decomposition optimization matters
```

**4. What query sizes are typical?**

```
Look at: queryPatterns.viewportQueries vs queryPatterns.fullExportQueries
If viewport >> fullExport: Cache locality critical
If fullExport common: Tree pruning less valuable
```

## Data Collection Campaign

**Step 1**: Enable telemetry

```typescript
// In your production code
const ENABLE_TELEMETRY = true; // Feature flag
const telemetry = new TelemetryCollector({
	enabled: ENABLE_TELEMETRY,
	reportingInterval: 1000,
	sessionId: `user_${Session.getActiveUser().getEmail()}`,
	onReport: (metrics) => {
		Logger.log(`TELEMETRY: ${JSON.stringify(metrics)}`);
	},
});
```

**Step 2**: Wrap all spatial indices

```typescript
const backgroundColors = telemetry.wrap(
	createMortonLinearScanIndex<string>(),
	'backgroundColor',
);
const fontWeights = telemetry.wrap(
	createMortonLinearScanIndex<string>(),
	'fontWeight',
);
// ... etc
```

**Step 3**: Analyze

```typescript
// Aggregate all metrics
const allMetrics: TelemetrySnapshot[] = [...]; // Load from logs

// Calculate global statistics
const allNSamples = allMetrics.flatMap(m => m.nDistribution.samples);
const globalP95 = percentile(allNSamples, 0.95);
const globalP99 = percentile(allNSamples, 0.99);

console.log(`P95 n = ${globalP95}`);
console.log(`P99 n = ${globalP99}`);

if (globalP95 < 100) {
  console.log('✅ n<100 assumption VALIDATED');
} else {
  console.log('❌ n<100 assumption REJECTED - need R-tree by default');
}
```

## Troubleshooting

**Metrics not reported**: Use small `reportingInterval: 10` or `forceReport()`

**Too much overhead**: Increase `reportingInterval` or disable

**Missing data**: Wrap all spatial indices

## Next Steps

1. Enable telemetry (feature flag)
2. Collect 1-2 weeks
3. Analyze results
4. Update PRODUCTION-GUIDE.md with findings
