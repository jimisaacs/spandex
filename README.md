# Spandex

> Fast 2D spatial indexing with last-writer-wins semantics for JavaScript/TypeScript

[![JSR](https://jsr.io/badges/@jim/spandex)](https://jsr.io/@jim/spandex)
[![Score](https://jsr.io/badges/@jim/spandex/score)](https://jsr.io/@jim/spandex/score)

Insert overlapping rectangles, get back non-overlapping fragments. O(n) for <100 ranges, O(log n) for ≥100.

**Use cases**: Spreadsheet formatting, GIS overlays, game collision, spatial databases.

## Why Spandex?

You are tracking which 2D regions carry which properties, and the regions
overlap. Think of spreadsheet cells with formatting.

When `B2:D4` is written over `A1:C3`, the old region has to split into pieces
that do not overlap the new one, the new region has to survive intact, and
"what applies to C2?" still has to be fast. Splitting rectangles by hand is
where the bugs live. `index.insert()` does the decomposition for you.

## Quick Start

```bash
deno add jsr:@jim/spandex      # Deno
npx jsr add @jim/spandex       # Node.js
```

```typescript
import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
import { createA1Adapter } from '@jim/spandex/adapter/a1';
import { createRenderer } from '@jim/spandex-ascii';

const index = createMortonLinearScanIndex<'red' | 'blue'>();
const adapter = createA1Adapter(index);

// Insert first region (A1:C3 in spreadsheet notation)
adapter.insert('A1:C3', 'red');

// Insert overlapping region (B2:D4 - last-writer-wins)
adapter.insert('B2:D4', 'blue');

// Visualize the decomposition
const { render } = createRenderer();
console.log(render(adapter, { legend: { R: 'red', B: 'blue' } }));
// Output:
//     A   B   C   D
//   ┏━━━┳━━━┳━━━┓   ·
// 1 ┃ R ┃ R ┃ R ┃
//   ┣━━━╋━━━╋━━━╋━━━┓
// 2 ┃ R ┃ B ┃ B ┃ B ┃
//   ┣━━━╋━━━╋━━━╋━━━┫
// 3 ┃ R ┃ B ┃ B ┃ B ┃
//   ┗━━━╋━━━╋━━━╋━━━┫
// 4     ┃ B ┃ B ┃ B ┃
//   ·   ┗━━━┻━━━┻━━━┛
//
// B = "blue"
// R = "red"

// Query returns 3 non-overlapping fragments
for (const [rect, value] of adapter.query()) {
	console.log(rect, value);
}
// [0,0,2,0] 'red'
// [0,1,0,2] 'red'
// [1,1,3,3] 'blue'
```

Red region split into 2 fragments, blue wins the overlap (3 total fragments).

## Published Packages

| Package                                                   | Purpose                 |
| --------------------------------------------------------- | ----------------------- |
| [`@jim/spandex`](https://jsr.io/@jim/spandex)             | Core algorithms & types |
| [`@jim/spandex-ascii`](https://jsr.io/@jim/spandex-ascii) | Terminal visualization  |
| [`@jim/spandex-html`](https://jsr.io/@jim/spandex-html)   | Browser visualization   |

**Compatibility**: Pure JavaScript (ES2020+) - works in browsers, Node.js, Deno 2+, Bun, and constrained environments like Google Apps Script. No WASM or SharedArrayBuffer required.

## Algorithm Selection

| Data Pattern    | Use                           | Why                    |
| --------------- | ----------------------------- | ---------------------- |
| Multi-attribute | `createLazyPartitionedIndex`  | Per-attribute indexing |
| <100 ranges     | `createMortonLinearScanIndex` | Fastest write-heavy    |
| ≥100 ranges     | `createRStarTreeIndex`        | Scales O(log n)        |

See [PRODUCTION-GUIDE.md](./PRODUCTION-GUIDE.md) for decision tree and [BENCHMARKS.md](./BENCHMARKS.md) for measurements.

## Documentation

**Using**: [Getting Started](./docs/GETTING-STARTED.md) • [Production Guide](./PRODUCTION-GUIDE.md) • [Troubleshooting](./docs/TROUBLESHOOTING.md) • [API Reference](./packages/@jim/spandex/README.md) • [Benchmarks](./BENCHMARKS.md) • [Statistics](./docs/analyses/benchmark-statistics.md)

**Research**: [Summary](./docs/core/RESEARCH-SUMMARY.md) (5 min overview) • [All Docs](./docs/README.md) • [Theory](./docs/core/theoretical-foundation.md)

**Contributing**: [Implementation Lifecycle](./docs/IMPLEMENTATION-LIFECYCLE.md) • [Benchmark Framework](./docs/BENCHMARK-FRAMEWORK.md) • [Testing](./docs/TELEMETRY-GUIDE.md)
