# Spatial Indexing Research

> 2D range decomposition algorithms for spreadsheet systems

[![Deno](https://img.shields.io/badge/deno-2.x+-green.svg)](https://deno.land/)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen.svg)](#testing)
[![TypeScript](https://img.shields.io/badge/typescript-5.0+-blue.svg)](https://www.typescriptlang.org/)

## Problem

Maintain a spatial partition of 2D rectangles with last-writer-wins (LWW) conflict resolution. Given a sequence of insertions `(R_i, v_i)`, maintain a set of disjoint rectangles where each point maps to the value from its most recent covering rectangle.

**Formal definition**: After inserting `(R, v)`, decompose existing rectangles `R_i ∩ R` into `R_i \ R` (at most 4 fragments per overlap), then store `(R, v)`.

**Constraint**: All stored rectangles must be pairwise disjoint (`∀ i≠j: R_i ∩ R_j = ∅`).

## Coordinate Semantics

**Core library**: Closed intervals `[min, max]` where both endpoints are included.

- Rectangle: `[x_min, y_min, x_max, y_max]` represents `{(x,y) : x_min ≤ x ≤ x_max, y_min ≤ y ≤ y_max}`
- Simplifies geometric operations (intersection, subtraction require no ±1 adjustments)

**Adapter layer**: Half-open intervals `[start, end)` where end is excluded.

- Matches Google Sheets API and standard library conventions
- Conversion at boundaries: `[start, end)` ⟷ `[start, end-1]`

See [coordinate-system.md](./docs/diagrams/coordinate-system.md) for detailed semantics.

## Algorithms

Two complexity classes (implementations in `packages/@jim/spandex/src/implementations/`):

**O(n) Linear Scan**: Flat array storage with spatial locality optimization via space-filling curves (Morton Z-order). Constant-time encoding, cache-friendly iteration. Dominates for n < 100.

**O(log n) R-tree**: Hierarchical bounding volume hierarchy with R* split algorithm (Beckmann et al. 1990). Query pruning via spatial indexing. Dominates for n ≥ 100.

**Crossover analysis**: See `docs/analyses/transition-zone-analysis.md` for empirical validation of n=100 threshold.

## Usage

```typescript
import { MortonLinearScanImpl } from '@jim/spandex';

const index = new MortonLinearScanImpl<string>();
index.insert([0, 0, 4, 4], 'A'); // Rectangle [x_min, y_min, x_max, y_max]
index.insert([2, 2, 6, 6], 'B'); // Overlapping insert

// Query returns disjoint fragments
for (const [rect, value] of index.query()) {
	console.log(rect, value);
}
// Output: [0,0,4,1],'A'  [0,2,1,4],'A'  [2,2,6,6],'B'
```

**Adapter for external formats**:

```typescript
import { createGridRangeAdapter } from '@jim/spandex';

const adapted = createGridRangeAdapter(index);
adapted.insert({ startRowIndex: 0, endRowIndex: 5, ... }, value);
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
deno task test:adversarial   # Adversarial worst-case tests
deno task bench              # Run benchmarks (~2 min)
deno task bench:update       # Regenerate BENCHMARKS.md (~2 min)
deno task bench:analyze 5 docs/analyses/benchmark-statistics.md  # Statistical analysis (~30 min)
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
packages/@jim/spandex/               # Core spatial indexing library
├── src/
│   ├── implementations/             # Active production algorithms
│   ├── adapters/                    # External API adapters (GridRange, A1)
│   └── types, utilities
└── test/                            # Implementation tests

packages/@local/spandex-testing/     # Testing framework
├── src/
│   ├── axiom/                       # Conformance test axioms
│   └── ascii/                       # Visual debugging utilities
└── test/

packages/@local/spandex-telemetry/   # Production metrics (opt-in)

archive/                             # Historical research
├── src/implementations/             # Archived algorithms
└── docs/experiments/                # Experiment analyses
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

Spreadsheet property tracking (formatting, validation), GIS overlay analysis, game collision detection, database spatial indexing. Any domain requiring LWW conflict resolution over 2D regions.

## Research Process

This project maintains production implementations in `packages/@jim/spandex/src/implementations/` and archives historical experiments in `archive/` for reproducibility.

See `archive/` for completed experiments and `BENCHMARKS.md` for current implementation performance.
