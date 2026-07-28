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

**Performance**: exactly zero when `enabled: false`, because `wrap` returns the
index unwrapped. When enabled the overhead is a counter increment per operation,
which no benchmark here has been able to separate from noise.

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

Four questions decide whether the defaults are right for your workload.

| Question             | Read                                                        | Then                                                                                   |
| -------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Is n < 100 typical?  | `nDistribution.p95`                                         | Under 100, linear scan is the right default. Over 200, make the R-tree the default.    |
| What is the balance? | `operations.inserts` against `operations.queries`           | Whichever dominates is the side worth optimizing.                                      |
| Are overlaps common? | `insertPatterns.overlapping / insertPatterns.sequential`    | Below 0.1, sequential inserts dominate. Above 0.5, decomposition cost dominates.       |
| How big are queries? | `queryPatterns.viewportQueries` against `fullExportQueries` | Mostly viewport reads favour locality. Frequent full exports make tree pruning matter. |

A p95 between 100 and 200 means neither default is clearly right, and the choice
depends on the read/write balance above.

## Troubleshooting

**Metrics not reported**: Use small `reportingInterval: 10` or `forceReport()`

**Too much overhead**: Increase `reportingInterval` or disable

**Missing data**: Wrap all spatial indices

## Next Steps

1. Enable telemetry (feature flag)
2. Collect 1-2 weeks
3. Analyze results
4. Update PRODUCTION-GUIDE.md with findings
