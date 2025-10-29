# Spandex

> Fast 2D spatial indexing with last-writer-wins semantics for JavaScript/TypeScript

[![JSR](https://jsr.io/badges/@jim/spandex)](https://jsr.io/@jim/spandex)
[![Score](https://jsr.io/badges/@jim/spandex/score)](https://jsr.io/@jim/spandex/score)

Insert overlapping rectangles, get back non-overlapping fragments. O(n) for <100 ranges, O(log n) for ≥100.

**Use cases**: Spreadsheet formatting, GIS overlays, game collision, spatial databases.

## Quick Start

```bash
deno add jsr:@jim/spandex      # Deno
npx jsr add @jim/spandex       # Node.js
```

```typescript
import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
import { createRenderer } from '@jim/spandex-ascii';

const index = createMortonLinearScanIndex<string>();

// Insert first region
index.insert([0, 0, 2, 2], 'A');

// Insert overlapping region (last-writer-wins)
index.insert([1, 1, 3, 3], 'B');

// Visualize the decomposition
const { render } = createRenderer();
console.log(render(index, { gridOnly: true }));
// Output:
//     A   B   C
//   ┏━━━┳━━━┳━━━┓
// 1 ┃ A ┃ A ┃ A ┃
//   ┣━━━╋━━━╋━━━┫
// 2 ┃ A ┃ B ┃ B ┃
//   ┣━━━╋━━━╋━━━┫
// 3 ┃ A ┃ B ┃ B ┃
//   ┗━━━╋━━━╋━━━┫
// 4     ┃ B ┃ B ┃
//       ┗━━━┻━━━┛

// Query returns 4 non-overlapping fragments
for (const [rect, value] of index.query()) {
	console.log(rect, value);
}
// [0,0,2,0] 'A'
// [0,1,0,2] 'A'
// [0,3,0,3] 'A'
// [1,1,3,3] 'B'
```

Region A split into 3 fragments, B wins the overlap.

## Published Packages

| Package                                                   | Purpose                 |
| --------------------------------------------------------- | ----------------------- |
| [`@jim/spandex`](https://jsr.io/@jim/spandex)             | Core algorithms & types |
| [`@jim/spandex-ascii`](https://jsr.io/@jim/spandex-ascii) | Terminal visualization  |
| [`@jim/spandex-html`](https://jsr.io/@jim/spandex-html)   | Browser visualization   |

## Algorithm Selection

| Ranges | Use                           | Why             |
| ------ | ----------------------------- | --------------- |
| <100   | `createMortonLinearScanIndex` | Fastest O(n)    |
| ≥100   | `createRStarTreeIndex`        | Scales O(log n) |

See [PRODUCTION-GUIDE.md](./PRODUCTION-GUIDE.md) for decision tree and [BENCHMARKS.md](./BENCHMARKS.md) for measurements.

## Documentation

**Using**: [Production Guide](./PRODUCTION-GUIDE.md) • [API Reference](./packages/@jim/spandex/README.md) • [Benchmarks](./BENCHMARKS.md) • [Statistics](./docs/analyses/benchmark-statistics.md)

**Research**: [Summary](./docs/core/RESEARCH-SUMMARY.md) (5 min overview) • [All Docs](./docs/README.md) • [Theory](./docs/core/theoretical-foundation.md)

**Contributing**: [Implementation Lifecycle](./docs/IMPLEMENTATION-LIFECYCLE.md) • [Benchmark Framework](./docs/BENCHMARK-FRAMEWORK.md) • [Testing](./docs/TELEMETRY-GUIDE.md)
