# @local/spandex-telemetry

Opt-in telemetry for [@jim/spandex](https://jsr.io/@jim/spandex) implementations.

```typescript
import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
import { TelemetryCollector } from '@local/spandex-telemetry';

const telemetry = new TelemetryCollector({
	enabled: true,
	reportingInterval: 1000,
	onReport: (metrics) => console.log(metrics),
	sessionId: 'optional-identifier',
});

const index = telemetry.wrap(createMortonLinearScanIndex<string>(), 'backgroundColor');
```

## Metrics (see `TelemetrySnapshot` in `src/types.ts`)

**Distribution**: n (range count) min/max/mean/median/P95/P99\
**Operations**: Insert/query counts, unbounded query count\
**Patterns**: Sequential vs overlapping inserts, viewport vs full-export queries\
**Performance**: Insert/query P50/P95/P99 latency

**Privacy**: Zero overhead when disabled. No data sent unless you provide `onReport` callback.

**License**: MIT
