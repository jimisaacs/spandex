# Spatial Indexing Research

> 2D range decomposition algorithms for spreadsheet systems

[![Deno](https://img.shields.io/badge/deno-2.x+-green.svg)](https://deno.land/)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen.svg)](#testing)
[![TypeScript](https://img.shields.io/badge/typescript-5.0+-blue.svg)](https://www.typescriptlang.org/)

## Problem

Spreadsheet APIs track properties (colors, formats, validation rules) across 2D ranges. Ranges overlap. The challenge: maintain a **spatial partition** (non-overlapping regions) with **last-writer-wins** conflict resolution.

**Example** (0-indexed, half-open `[start, end)` coordinates):

1. Insert rows `[0, 5)`, cols `[0, 5)` → **Red** (25 cells: rows 0-4, cols 0-4)
2. Insert rows `[2, 7)`, cols `[2, 7)` → **Blue** (25 cells: rows 2-6, cols 2-6, overlaps!)
3. **Result**: 3 non-overlapping ranges:
   - Red top strip: `[0, 2) × [0, 5)` → 10 cells
   - Red left strip: `[2, 5) × [0, 2)` → 6 cells
   - Blue center: `[2, 7) × [2, 7)` → 25 cells (overwrites 9-cell overlap)

**Constraint**: Each point maps to its most recent value.

## Coordinate System

**Internal vs External Semantics**:

- **Core library** (`Rectangle`): Uses **closed intervals** `[min, max]` where both endpoints are included
  - Example: `[0, 0, 4, 4]` = x:[0,4], y:[0,4] (all coordinates 0-4 inclusive)
  - Why? Simplifies geometric operations (no ±1 adjustments)

- **GridRange adapter**: Uses **half-open intervals** `[start, end)` where end is excluded
  - Example: `{startRowIndex: 0, endRowIndex: 5}` = rows 0-4 (NOT 5!)
  - Why? Matches Google Sheets API and standard programming practice

**Common mistake**: Assuming `endRowIndex: 5` includes row 5. It doesn't!

**Visual** (GridRange format):

```
[0, 5) = [0, 1, 2, 3, 4]    ✅ Correct
       ≠ [0, 1, 2, 3, 4, 5]  ❌ Wrong!
```

**Why half-open for GridRange?** Matches Google Sheets API:

- Empty range: `[5, 5)` is empty (not invalid)
- Adjacent ranges: `[0, 5)` + `[5, 10)` = no gap, no overlap

**Visual guide**: See [coordinate-system.md](./docs/diagrams/coordinate-system.md) for more examples and common mistakes.

## Implementations

Two algorithm families (see `src/implementations/` for current active implementations):

### O(n) Linear Scan

Iterate through all ranges. Fast for small datasets (n < 100) due to low overhead and spatial locality.

**Production approach**: Morton curve (Z-order) spatial locality optimization (faster than naive scan)

### O(log n) R-Tree

Hierarchical spatial index with pruning. Fast for large datasets (n ≥ 100).

**Production approach**: R* split algorithm (optimal tree quality)

See `archive/` for historical experiments and alternative approaches.

## Quick Start

Track cell properties with automatic overlap resolution:

```typescript
import MortonLinearScanImpl from './src/implementations/mortonlinearscan.ts';

// Create a spatial index for background colors
const backgroundColors = new MortonLinearScanImpl<string>();

// Insert a red background: columns 0-4, rows 0-4 (25 cells)
// Rectangle format: [xmin, ymin, xmax, ymax] with CLOSED intervals
backgroundColors.insert([0, 0, 4, 4], 'red');

// Insert a blue background: columns 2-6, rows 2-6 (25 cells, overlaps!)
backgroundColors.insert([2, 2, 6, 6], 'blue');

// Result: 3 non-overlapping ranges (last-writer-wins)
const ranges = Array.from(backgroundColors.query());
console.log(ranges.length); // 3

// What happened?
// ├─ Red top strip: cols [0,4] × rows [0,1] → still red
// ├─ Red left strip: cols [0,1] × rows [2,4] → still red
// └─ Blue center: cols [2,6] × rows [2,6] → blue (overwrote overlap)
```

**Output**: The index automatically decomposed the overlapping ranges into 3 disjoint rectangles.

**Google Sheets Integration**: Use the adapter for GridRange compatibility:

```typescript
import MortonLinearScanImpl from './src/implementations/mortonlinearscan.ts';
import { createGridRangeAdapter } from './src/adapters/gridrange.ts';

const index = createGridRangeAdapter(new MortonLinearScanImpl<string>());

// Now uses Google Sheets GridRange format (half-open intervals)
index.insert({
	startRowIndex: 0,
	endRowIndex: 5, // Half-open: means rows 0,1,2,3,4 (NOT 5)
	startColumnIndex: 0,
	endColumnIndex: 5,
}, 'red');
```

## Installation

**Prerequisites**: Deno 2.x+ (TypeScript-native runtime with built-in testing)

```bash
# Clone repository
git clone <repository-url>
cd spatial-indexing-research

# Run tests (verifies everything works)
deno task test           # All tests passing
deno task bench          # Performance benchmarks
deno task bench:update   # Regenerate BENCHMARKS.md

# Or import directly from URL (Deno only)
import { MortonLinearScanImpl } from 'https://raw.githubusercontent.com/...';
```

**Note**: Core library uses generic `Rectangle` type `[xmin, ymin, xmax, ymax]`. For Google Sheets `GridRange` compatibility, use `createGridRangeAdapter()` from `src/adapters/gridrange.ts`.

## Development

```bash
deno task test               # All tests
deno task bench              # Run benchmarks
deno task bench:update       # Regenerate BENCHMARKS.md
deno task bench:analyze      # Statistical analysis (5 runs, ~4-5 min)
deno task test:morton        # Test specific implementation
deno task test:rstartree     # ...
deno task fmt                # Format
deno task lint               # Lint
deno task check              # Type check
```

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

```
src/
├── types.ts                          # Core types (Rectangle, SpatialIndex, QueryResult)
├── rect.ts                           # Rectangle utilities (canonicalization, sentinels)
├── implementations/                  # Active implementations
│   ├── mortonlinearscan.ts           # ✅ Production: O(n), n<100
│   └── rstartree.ts                  # ✅ Production: O(log n), n≥100
├── conformance/                      # Axiom-based testing
│   ├── testsuite.ts                  # 25 core axioms
│   ├── ascii-snapshot-axioms.ts      # 15 ASCII snapshot tests
│   ├── ascii-snapshot.ts             # ASCII rendering/parsing utilities
│   ├── cross-implementation.ts       # Cross-validation tests
│   └── mod.ts                        # Exports
├── adapters/                         # External API adapters
│   ├── gridrange.ts                  # GridRange ⟷ Rectangle conversion
│   └── a1.ts                         # A1 notation → Rectangle conversion
├── telemetry/                        # Production telemetry (opt-in)
│   └── index.ts                      # Metrics collection wrapper
└── lazypartitionedindex.ts           # Per-attribute spatial partitioning (lazy vertical partitioning)

test/                                 # Test entry points
├── mortonlinearscan.test.ts          # Conformance tests
├── rstartree.test.ts                 # Conformance tests
├── lazypartitionedindex.test.ts      # Partitioned index tests
├── telemetry.test.ts                 # Telemetry tests
├── adversarial.test.ts               # Worst-case pattern tests
└── integration.test.ts               # Cross-implementation tests

archive/                              # Historical implementations (docs + git history)
├── IMPLEMENTATION-HISTORY.md         # One-line index with git SHAs
└── docs/experiments/                 # Full analysis of archived work
```

## Testing

Comprehensive test suite validates:

- **Conformance axioms**: Core correctness properties (LWW semantics, overlap resolution, disjointness invariants)
- **ASCII snapshot tests**: Visual regression testing with human-readable grid representations
- **Adversarial patterns**: Worst-case fragmentation validation (concentric, diagonal, checkerboard patterns empirically validate O(n) bound, not exponential)
- **Integration tests**: Cross-implementation consistency verification

- [Conformance test suite](./src/conformance/testsuite.ts)
- [Test coverage improvements](./docs/analyses/test-coverage-improvements.md) - 4 new axioms added (Oct 2025)
- [Adversarial pattern analysis](./docs/analyses/adversarial-patterns.md) - Validates geometric bounds under worst-case insertion patterns

## Choosing an Implementation

| Ranges | Algorithm Approach      | Performance                    |
| ------ | ----------------------- | ------------------------------ |
| < 100  | Morton spatial locality | ~10µs @ n=50                   |
| ≥ 100  | R-tree (R* split)       | ~50µs @ n=100, ~800µs @ n=1000 |

See [PRODUCTION-GUIDE.md](./PRODUCTION-GUIDE.md) for implementation details and import statements. See [BENCHMARKS.md](./BENCHMARKS.md) for current data.

## Applications

- **Spreadsheets**: Range formatting, data validation, conditional formatting
- **GIS**: Spatial data management, overlay analysis
- **Games**: Collision detection, spatial partitioning
- **Databases**: Spatial indexing, range queries

## Research Process

This project maintains production implementations in `src/implementations/` and archives historical experiments in `archive/` for reproducibility.

See `archive/` for completed experiments and `BENCHMARKS.md` for current implementation performance.
