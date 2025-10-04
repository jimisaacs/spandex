# Production Telemetry Guide

Collect real-world usage metrics to validate optimization decisions.

## Why Telemetry?

**Current State**: All performance optimizations assume "n<100 is typical" but this **has never been validated** with production data.

**Purpose**: Answer critical questions:

- What are real `n` distributions? (assumed <100, but is this true?)
- What are real query patterns? (viewport queries vs full exports?)
- What are real overlap patterns? (sequential vs random?)
- Where are the actual bottlenecks?

## Quick Start

```typescript
import { TelemetryCollector } from './src/telemetry/index.ts';
import HilbertLinearScanImpl from './src/implementations/hilbertlinearscan.ts';

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
const backgroundColors = new HilbertLinearScanImpl<string>();
const wrapped = telemetry.wrap(backgroundColors, 'backgroundColor');

// 3. Use it normally
wrapped.insert({ startRow: 0, endRow: 5, startCol: 0, endCol: 5 }, 'red');
wrapped.query({ startRow: 0, endRow: 10, startCol: 0, endCol: 10 });

// Metrics are automatically collected and reported
```

## What Gets Collected

### Range Count Distribution (`nDistribution`)

- `min`, `max`, `mean`, `median`, `p95`, `p99`
- **Validates**: "n<100 is typical" assumption

### Operation Counts (`operations`)

- `inserts`, `queries`, `getAllRanges`
- **Shows**: Read vs write workload balance

### Query Patterns (`queryPatterns`)

- `avgQueryArea` - Average query rectangle size
- `fullExportQueries` - Queries covering >80% of space
- `viewportQueries` - Queries covering <10% of space
- **Validates**: Viewport scrolling vs full exports

### Insert Patterns (`insertPatterns`)

- `sequential` - Non-overlapping inserts
- `overlapping` - Inserts triggering decomposition
- `avgOverlapArea` - Typical overlap size
- **Shows**: Decomposition overhead

### Performance Metrics (`performance`)

- `insertP50`, `insertP95`, `insertP99` - Insert latencies
- `queryP50`, `queryP95`, `queryP99` - Query latencies
- **Identifies**: Bottlenecks and outliers

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

### Recommendation

- **Production**: `reportingInterval: 1000` (low overhead, frequent data)
- **Development**: `reportingInterval: 100` (faster feedback)
- **Testing**: Use `forceReport()` for immediate data

## Privacy & Performance

**Privacy**: Only aggregate statistics, no user data

- ✅ Collects: n distributions, query sizes, performance metrics
- ❌ Never collects: Cell values, range contents, user identifiers

**Performance**: <1ms overhead per operation

- Metrics stored in memory buffers
- Reporting triggered at intervals
- Zero overhead when `enabled: false`

## Integration with Google Apps Script

### Cloud Logging

```typescript
import { TelemetryCollector } from './src/telemetry/index.ts';

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
// Force report on document close or time trigger
function onDocumentClose() {
	telemetry.forceReport('HilbertLinearScanImpl', 'backgroundColor');
}

// Or set up time-based trigger
function flushTelemetry() {
	telemetry.forceReport('HilbertLinearScanImpl', 'backgroundColor');
}
// Set up: Edit > Current project's triggers > Add trigger
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

## Example: Data Collection Campaign

**Goal**: Collect 2 weeks of production data to validate optimization decisions

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
	new HilbertLinearScanImpl<string>(),
	'backgroundColor',
);
const fontWeights = telemetry.wrap(
	new HilbertLinearScanImpl<string>(),
	'fontWeight',
);
// ... etc
```

**Step 3**: Collect logs

Check your Google Apps Script logs (View > Logs) or external service.

**Step 4**: Analyze

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

### Metrics not being reported

**Problem**: `onReport` never called

**Fix**: Check `reportingInterval`. You need that many operations before reporting triggers.

```typescript
// For testing, use small interval
reportingInterval: 10;

// Or force report
telemetry.forceReport('ImplName', 'propertyName');
```

### Too much overhead

**Problem**: Telemetry slowing down app

**Fix**: Increase `reportingInterval` or disable telemetry.

```typescript
// Lower frequency
reportingInterval: 5000; // Every 5000 operations

// Or disable in production
enabled: false;
```

### Missing data

**Problem**: Some properties not tracked

**Fix**: Make sure you wrap **all** spatial indices.

```typescript
// Bad - only wraps one
const bg = telemetry.wrap(new HilbertLinearScanImpl(), 'bg');
const font = new HilbertLinearScanImpl(); // ❌ Not wrapped!

// Good - wraps all
const bg = telemetry.wrap(new HilbertLinearScanImpl(), 'bg');
const font = telemetry.wrap(new HilbertLinearScanImpl(), 'font');
```

## Next Steps

1. **Enable telemetry** in production (feature flag)
2. **Collect 1-2 weeks** of data
3. **Analyze results** using guide above
4. **Update recommendations** in PRODUCTION-GUIDE.md based on real data
5. **Consider adaptive implementation** if n varies widely

See [STRATEGIC-ACTION-PLAN.md](../.temp/STRATEGIC-ACTION-PLAN.md) for full context.
