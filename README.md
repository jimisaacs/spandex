# Spatial Indexing Research

> Fast 2D spatial indexing with last-writer-wins semantics

[![Deno](https://img.shields.io/badge/deno-2.x+-green.svg)](https://deno.land/)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen.svg)](#testing)
[![TypeScript](https://img.shields.io/badge/typescript-5.0+-blue.svg)](https://www.typescriptlang.org/)

## What is this?

**Monorepo** for 2D spatial indexing with last-writer-wins semantics. Insert overlapping rectangles, library decomposes them into disjoint fragments (≤4 per overlap).

**Performance**: O(n) for sparse (< 100), O(log n) for large (≥ 100). Validated across 35 scenarios.

**Use cases**: Spreadsheet properties, GIS overlays, game collision, database indexing.

## Quick Start

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

## Packages

| Package                    | Purpose                             |
| -------------------------- | ----------------------------------- |
| `@jim/spandex`             | Core algorithms & types             |
| `@jim/spandex-ascii`       | ASCII visualization (terminal)      |
| `@jim/spandex-html`        | HTML visualization (browser)        |
| `@local/snapmark`          | Snapshot testing (general-purpose)  |
| `@local/spandex-testing`   | Conformance axioms & test scenarios |
| `@local/spandex-telemetry` | Optional production metrics         |

See each package's README for details.

## Algorithm Selection

| Rectangles | Use                           | Why             |
| ---------- | ----------------------------- | --------------- |
| < 100      | `createMortonLinearScanIndex` | Fastest O(n)    |
| ≥ 100      | `createRStarTreeIndex`        | Scales O(log n) |

See [PRODUCTION-GUIDE.md](./PRODUCTION-GUIDE.md) for decision tree.

## Adapters

Core uses `Rectangle = [xmin, ymin, xmax, ymax]`. Adapters convert external formats:

```typescript
// Google Sheets GridRange (half-open intervals)
import { createGridRangeAdapter } from '@jim/spandex/adapter/gridrange';
createGridRangeAdapter(index).insert({ startRowIndex: 0, endRowIndex: 5, ... }, value);

// A1 notation ("A1:C3", "B:B")
import { createA1Adapter } from '@jim/spandex/adapter/a1';
createA1Adapter(index).insert('A1:C3', value);

// ASCII visualization (terminal)
import { createRenderer } from '@jim/spandex-ascii';
console.log(createRenderer().render(index, { legend }));

// HTML visualization (browser)
import { createRenderer as createHTMLRenderer } from '@jim/spandex-html';
const html = createHTMLRenderer().render(index, { legend, showCoordinates: true });
```

### Implementation-Specific Methods

**Core interface** (`SpatialIndex<T>`): `insert()`, `query()`, `extent()`

**Diagnostic methods** (implementation-specific):

```typescript
// Morton and R-tree implementations
import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
import createRStarTreeIndex from '@jim/spandex/index/rstartree';

const morton = createMortonLinearScanIndex<string>();
const rtree = createRStarTreeIndex<string>();

morton.size(); // Count of stored rectangles (O(1))
rtree.size(); // Count of stored rectangles (O(1))
rtree.getTreeQualityMetrics(); // { depth, overlapArea, deadSpace, nodeCount }

// Partitioned index
import createLazyPartitionedIndex from '@jim/spandex/index/lazypartitionedindex';

const partitioned = createLazyPartitionedIndex<{ color: string; bold: boolean }>(
	createMortonLinearScanIndex,
);

partitioned.keys(); // Iterator of partition keys
partitioned.sizeOf('color'); // Count for specific partition
partitioned.isEmpty; // True if no partitions (getter)
partitioned.clear(); // Remove all partitions
```

**Why not on base interface?** Implementation details. Use concrete types when needed.

## Installation

```bash
# Deno
import createMortonLinearScanIndex from 'jsr:@jim/spandex@0.1/index/mortonlinearscan';

# Node.js
npx jsr add @jim/spandex @jim/spandex-ascii @jim/spandex-html
```

Development: See [docs/active/README.md](./docs/active/README.md) and [CLAUDE.md](./CLAUDE.md).

## Documentation

### Learning

- **[Rectangle Decomposition Primer](./docs/RECTANGLE-DECOMPOSITION-PRIMER.md)** - Understand the core problem and three solution strategies
- **[Three-part deep dive](./docs/diagrams/)** - Last-Writer-Wins, Shallow Merge, and Spatial Join approaches

### Using

- **[Production Guide](./PRODUCTION-GUIDE.md)** - Quick decision tree for choosing implementations
- **[Benchmarks](./BENCHMARKS.md)** - Performance data across all implementations

### Research

- **[Research Summary](./docs/core/RESEARCH-SUMMARY.md)** - Complete research findings
- **[Theoretical Foundation](./docs/core/theoretical-foundation.md)** - Mathematical model and proofs
- **[Documentation Index](./docs/README.md)** - Complete documentation navigation

## Architecture

This monorepo separates concerns into independent packages:

**`@jim/spandex`** - Core spatial indexing library:

```
src/
├── index/          # Active production algorithms (Morton, R*-tree, LazyPartitioned)
├── adapter/        # External format adapters (GridRange, A1 notation)
├── render/         # Backend-agnostic render framework (strategy, layout)
├── types.ts        # Core types (SpatialIndex, Rectangle, EdgeFlags)
└── r.ts, extent.ts # Rectangle utilities, MBR computation
```

**`@jim/spandex-ascii`** - ASCII visualization backend:

```
src/
├── backend.ts      # Implements RenderBackend for ASCII output
├── parse.ts        # ASCII → rectangles parser (testing, round-trip validation)
└── box-drawing.ts, coordinates.ts, sparse.ts  # ASCII grid utilities
```

**`@jim/spandex-html`** - HTML table visualization backend:

```
src/
├── backend.ts      # Implements RenderBackend for HTML tables
├── types.ts        # HTML-specific render params (colors, gradients, tooltips)
└── mod.ts          # Renderer factory
```

**`@local/snapmark`** - General-purpose snapshot testing:

```
src/
├── codec.ts        # Pluggable encode/decode (JSON, binary, string, image)
├── group.ts        # Test fixture grouping and auto-inference
└── disk.ts, markdown.ts  # Markdown storage with fenced code blocks
```

_(Independent library - no spandex dependency. Happens to live in this monorepo.)_

**`@local/spandex-testing`** - Spatial index conformance testing:

```
src/
├── axiom/          # Mathematical invariants (disjointness, LWW, fragmentation bounds)
├── regression-scenarios.ts  # Shared test scenarios for render backends
└── utils.ts        # Seeded random, test data generation
```

**`@local/spandex-telemetry`** - Production metrics (opt-in):

```
src/
├── collector.ts    # Metrics collection (insert/query timing, size tracking)
└── types.ts        # Telemetry event types
```

**Research & Development**:

```
docs/               # Research documentation and analysis
archive/            # Archived implementations and rejected experiments
benchmarks/         # Performance measurement suites
scripts/            # Automation (benchmarking, archiving, doc generation)
```

## Testing

**Axiom-based conformance**: Mathematical invariants (disjointness, LWW semantics, O(n) fragmentation bound) verified via property-based testing. See `packages/@local/spandex-testing/src/axiom/`.

**Adversarial validation**: Pathological insertion patterns (concentric, diagonal, checkerboard) empirically validate linear fragmentation bound. See `docs/analyses/adversarial-patterns.md`.

**Cross-implementation consistency**: Reference implementation oracle validates algorithmic correctness across O(n) and O(log n) variants.

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

### Coordinate Semantics

**Closed intervals**: `[xmin, ymin, xmax, ymax]` includes all endpoints (simplifies geometry, no ±1).

**Adapters**: Convert external formats (e.g., GridRange half-open `[start, end)`).

See [coordinate-system.md](./docs/diagrams/coordinate-system.md).

### Algorithms

- **Morton Linear Scan** (O(n)): Spatial locality via Z-order. Wins n<100.
- __R_-tree_* (O(log n)): Hierarchical with R* split (Beckmann 1990). Wins n≥100.

See [docs/analyses/](./docs/analyses/) for empirical validation and [archive/](./archive/) for experiment history.
