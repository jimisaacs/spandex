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

**Important**: This library uses **half-open intervals** `[start, end)` where:

- `start` is **included** (closed)
- `end` is **excluded** (open)

**Example**: `startRowIndex: 0, endRowIndex: 5` means rows **0, 1, 2, 3, 4** (NOT 5!)

**Visual**:

```
[0, 5) = [0, 1, 2, 3, 4]    ✅ Correct
       ≠ [0, 1, 2, 3, 4, 5]  ❌ Wrong!
```

**Why half-open?** Matches Google Sheets API (`GridRange`) and standard programming practice:

- Array slice: `arr[0:5]` means indices 0-4
- Empty range: `[5, 5)` is empty (not invalid)
- Adjacent ranges: `[0, 5)` + `[5, 10)` = no gap, no overlap

**Common mistake**: Assuming `endRowIndex: 5` includes row 5. It doesn't!

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

// Insert a red background for rows 0-4, columns 0-4 (25 cells)
backgroundColors.insert({
	startRowIndex: 0,
	endRowIndex: 5, // Remember: [0, 5) means 0,1,2,3,4 NOT including 5!
	startColumnIndex: 0,
	endColumnIndex: 5,
}, 'red');

// Insert a blue background for rows 2-6, columns 2-6 (25 cells, overlaps!)
backgroundColors.insert({
	startRowIndex: 2,
	endRowIndex: 7,
	startColumnIndex: 2,
	endColumnIndex: 7,
}, 'blue');

// Result: 3 non-overlapping ranges (last-writer-wins)
const ranges = backgroundColors.getAllRanges();
console.log(ranges.length); // 3

// What happened?
// ├─ Red top strip: rows [0,2) × cols [0,5) → still red
// ├─ Red left strip: rows [2,5) × cols [0,2) → still red
// └─ Blue center: rows [2,7) × cols [2,7) → blue (overwrote overlap)
```

**Output**: The index automatically decomposed the overlapping ranges into 3 disjoint rectangles.

## Installation

**Prerequisites**: Deno 2.x+ (TypeScript-native runtime with built-in testing)

```bash
# Clone repository
git clone <repository-url>
cd spatial-indexing-research

# Run tests (verifies everything works)
deno task test           # 95 axiom-based tests
deno task bench          # Performance benchmarks
deno task bench:update   # Regenerate BENCHMARKS.md

# Or import directly from URL (Deno only)
import { MortonLinearScanImpl } from 'https://raw.githubusercontent.com/...';
```

Uses `GoogleAppsScript.Sheets.Schema.GridRange` from `@types/google-apps-script`.

## Development

```bash
deno task test               # All tests
deno task bench              # Run benchmarks
deno task bench:update       # Regenerate BENCHMARKS.md
deno task bench:analyze      # Statistical analysis (5 runs, ~4-5 min)
deno task test:linearscan    # Test specific implementation
deno task test:hilbert       # ...
deno task test:compact       # ...
deno task test:optimized     # ...
deno task test:rtree         # ...
deno task fmt                # Format
deno task lint               # Lint
deno task check              # Type check
```

## Documentation

- **[Production Guide](./PRODUCTION-GUIDE.md)** - Quick decision tree for choosing implementations
- **[Research Summary](./docs/core/RESEARCH-SUMMARY.md)** - Complete research findings
- **[Theoretical Foundation](./docs/core/theoretical-foundation.md)** - Mathematical model and proofs
- **[Benchmarks](./BENCHMARKS.md)** - Performance data across all implementations
- **[Documentation Index](./docs/README.md)** - Complete documentation navigation

## Architecture

```
src/
├── implementations/        # Active implementations (see directory for current list)
│   ├── hilbertlinearscan.ts          # ✅ Production: O(n), n<100
│   ├── rtree.ts                      # ✅ Production: O(log n), n≥100
│   └── compactlinearscan.ts          # ✅ Production: smallest bundle
└── conformance/            # Axiom-based testing
    ├── testsuite.ts                  # Test axioms + property tests
    └── mod.ts                        # Exports

archive/                    # Historical implementations
└── src/implementations/    # Superseded and failed experiments
```

## Testing

**Conformance**: 17 axioms per implementation validate mathematical correctness (empty state, overlap resolution, LWW semantics, boundary conditions, query edge cases, value reachability, coordinate extremes). 51 core tests + 6 adversarial tests, 100% passing.

**Adversarial**: Pathological patterns (concentric, diagonal, checkerboard, random) empirically validate O(n) fragmentation bound. Worst-case shows 2.3x avg fragmentation (not exponential).

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
