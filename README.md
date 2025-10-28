# Spatial Indexing Research

> Fast 2D spatial indexing with last-writer-wins semantics

[![JSR @jim/spandex](https://jsr.io/badges/@jim/spandex)](https://jsr.io/@jim/spandex)
[![JSR @jim/spandex-ascii](https://jsr.io/badges/@jim/spandex-ascii)](https://jsr.io/@jim/spandex-ascii)
[![JSR @jim/spandex-html](https://jsr.io/badges/@jim/spandex-html)](https://jsr.io/@jim/spandex-html)

[![Deno](https://img.shields.io/badge/deno-2.x+-green.svg)](https://deno.land/)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen.svg)](#testing)
[![TypeScript](https://img.shields.io/badge/typescript-5.0+-blue.svg)](https://www.typescriptlang.org/)

## What is this?

Monorepo for 2D spatial indexing with last-writer-wins semantics. Insert overlapping rectangles, get back non-overlapping fragments (≤4 per overlap).

**Performance**: O(n) for < 100 rectangles, O(log n) for ≥ 100. Validated across 35 scenarios.

**Use cases**: Spreadsheet formatting, GIS overlays, game collision, spatial databases.

## Quick Start

**Install:**

```bash
# Deno
deno add jsr:@jim/spandex

# Node.js / npm
npx jsr add @jim/spandex
```

**Use:**

```typescript
import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';

const index = createMortonLinearScanIndex<string>();
index.insert([0, 0, 4, 4], 'region-A'); // Insert rectangle [0,0] to [4,4]
index.insert([2, 2, 6, 6], 'region-B'); // Overlapping rectangle (LWW: B wins in overlap)

// Query returns non-overlapping fragments
for (const [rect, value] of index.query()) {
	console.log(rect, value);
}
// region-A fragments: [0,0,4,1], [0,2,1,4]
// region-B covers: [2,2,6,6]
```

## Published Packages

| Package                                                   | Purpose                        | Docs                                                  |
| --------------------------------------------------------- | ------------------------------ | ----------------------------------------------------- |
| [`@jim/spandex`](https://jsr.io/@jim/spandex)             | Core algorithms & types        | [README](./packages/@jim/spandex/README.md)           |
| [`@jim/spandex-ascii`](https://jsr.io/@jim/spandex-ascii) | ASCII visualization (terminal) | [README](./packages/@jim/spandex-ascii/README.md)     |
| [`@jim/spandex-html`](https://jsr.io/@jim/spandex-html)   | HTML visualization (browser)   | [README](./packages/@jim/spandex-html/README.md)      |
| `@local/snapmark`                                         | Snapshot testing framework     | [README](./packages/@local/snapmark/README.md)        |
| `@local/spandex-testing`                                  | Conformance axioms & scenarios | [README](./packages/@local/spandex-testing/README.md) |
| `@local/spandex-telemetry`                                | Optional production metrics    | [Guide](./docs/TELEMETRY-GUIDE.md)                    |

**Architecture**: Core + rendering backends. `@jim/spandex` provides algorithms, rendering packages (`-ascii`, `-html`) provide visualization.

## Algorithm Selection

| Rectangles | Use                           | Why             |
| ---------- | ----------------------------- | --------------- |
| < 100      | `createMortonLinearScanIndex` | Fastest O(n)    |
| ≥ 100      | `createRStarTreeIndex`        | Scales O(log n) |

See [PRODUCTION-GUIDE.md](./PRODUCTION-GUIDE.md) for decision tree.

## Adapters & Visualization

Core uses `Rectangle = [xmin, ymin, xmax, ymax]`. Adapters convert external coordinate systems:

```typescript
// Google Sheets GridRange (half-open intervals)
import { createGridRangeAdapter } from '@jim/spandex/adapter/gridrange';
createGridRangeAdapter(index).insert({ startRowIndex: 0, endRowIndex: 5, ... }, value);

// A1 notation ("A1:C3", "B:B")
import { createA1Adapter } from '@jim/spandex/adapter/a1';
createA1Adapter(index).insert('A1:C3', value);
```

Rendering backends visualize the index:

```typescript
// ASCII (terminal/logs)
import { createRenderer } from '@jim/spandex-ascii';
console.log(createRenderer().render(index, { legend }));

// HTML (browser)
import { createRenderer } from '@jim/spandex-html';
const html = createRenderer().render(index, { legend, showCoordinates: true });
```

Development: See [CLAUDE.md](./CLAUDE.md) for conventions and [@jim/spandex README](./packages/@jim/spandex/README.md) for full API.

## Architecture

**Core + Backends**: `@jim/spandex` provides algorithms and adapters, rendering packages (`-ascii`, `-html`) provide visualization.

**Independent packages**: `@local/snapmark` is general-purpose snapshot testing (no spandex dependency).

**Dev-only**: `@local/spandex-testing` for axiom tests, `@local/spandex-telemetry` for opt-in metrics.

See individual package READMEs for details.

## Testing

Mathematical invariants (disjointness, LWW semantics, O(n) fragmentation) tested via axioms. Adversarial patterns (concentric, diagonal, checkerboard) validate worst-case bounds. Cross-implementation consistency via reference oracle.

See `@local/spandex-testing` package and [adversarial-patterns.md](./docs/analyses/adversarial-patterns.md).

## Performance

| n     | Algorithm   | Complexity | Empirical     |
| ----- | ----------- | ---------- | ------------- |
| < 100 | Linear scan | O(n)       | ~7µs @ n=50   |
| ≥ 100 | R-tree      | O(log n)   | ~50µs @ n=100 |

Crossover at n≈100 validated across multiple workloads. See [BENCHMARKS.md](./BENCHMARKS.md) for detailed measurements.

## Applications

| Domain       | Use Case                                    |
| ------------ | ------------------------------------------- |
| Spreadsheets | Cell formatting across overlapping ranges   |
| GIS          | Land parcels, zoning, administrative bounds |
| Games        | Collision detection, area-of-effect         |
| Databases    | 2D spatial queries (time + category, etc)   |

## Technical Details

**Coordinates**: Closed intervals `[xmin, ymin, xmax, ymax]` - all endpoints included (simplifies math). Adapters convert external formats.

**Algorithms**: Morton (Z-order) for n<100, R* tree for n≥100. See [analyses](./docs/analyses/) for validation, [archive](./archive/) for experiments.

## Documentation

### Package Documentation

- **[@jim/spandex](./packages/@jim/spandex/README.md)** - Core library API, algorithms, types
- **[@jim/spandex-ascii](./packages/@jim/spandex-ascii/README.md)** - ASCII rendering for terminal/logs
- **[@jim/spandex-html](./packages/@jim/spandex-html/README.md)** - HTML rendering for browser visualization
- **[@local/snapmark](./packages/@local/snapmark/README.md)** - General-purpose snapshot testing
- **[@local/spandex-testing](./packages/@local/spandex-testing/README.md)** - Spatial index test axioms

### Guides

- **[PRODUCTION-GUIDE.md](./PRODUCTION-GUIDE.md)** - Algorithm selection decision tree
- **[BENCHMARKS.md](./BENCHMARKS.md)** - Performance measurements (auto-generated)
- **[TELEMETRY-GUIDE.md](./docs/TELEMETRY-GUIDE.md)** - Real-world metrics collection

### Research Documentation

- **[docs/core/RESEARCH-SUMMARY.md](./docs/core/RESEARCH-SUMMARY.md)** - Executive summary of findings
- **[docs/core/theoretical-foundation.md](./docs/core/theoretical-foundation.md)** - Mathematical proofs
- **[docs/analyses/](./docs/analyses/)** - Individual experiment results
  - `morton-vs-hilbert-analysis.md` - Spatial locality comparison
  - `r-star-analysis.md` - Split algorithm validation
  - `benchmark-statistics.md` - Statistical methodology

### Development

- **[CLAUDE.md](./CLAUDE.md)** - AI assistant / development conventions
- **[docs/IMPLEMENTATION-LIFECYCLE.md](./docs/IMPLEMENTATION-LIFECYCLE.md)** - Add/archive implementations
- **[docs/BENCHMARK-FRAMEWORK.md](./docs/BENCHMARK-FRAMEWORK.md)** - Benchmark execution
