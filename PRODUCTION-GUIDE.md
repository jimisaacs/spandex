# Production Guide

Quick reference for choosing algorithms in [@jim/spandex](https://jsr.io/@jim/spandex).

**New to spandex?** Start with [docs/GETTING-STARTED.md](./docs/GETTING-STARTED.md) for a tutorial.

## Pick an Algorithm

```typescript
// Less than 100 rectangles
import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
const index = createMortonLinearScanIndex<string>();

// 100+ rectangles
import createRStarTreeIndex from '@jim/spandex/index/rstartree';
const index = createRStarTreeIndex<string>();
```

**Why n=100?** Use linear scan below 100 (simpler, faster). Use R-tree at 100+ (tree traversal pays off). See "Special Cases" below for workload-specific thresholds.

## Available Algorithms

The library currently provides these implementations (auto-discovered from `packages/@jim/spandex/src/index/`):

**Core implementations:**

- **MortonLinearScan** - O(n) linear scan with Z-order spatial locality optimization
- **RStarTree** - O(log n) hierarchical indexing with R* split algorithm
- **LazyPartitionedIndex** - Wrapper that maintains separate indexes per attribute (spatial join pattern)

**To see all available:**

```bash
ls packages/@jim/spandex/src/index/
```

Each `.ts` file is an implementation that can be imported:

```typescript
import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
import createRStarTreeIndex from '@jim/spandex/index/rstartree';
import createLazyPartitionedIndex from '@jim/spandex/index/lazypartitionedindex';
```

**Historical note**: This is an active research project. Some experimental implementations are archived when superseded by better approaches. Current implementations represent validated, production-ready algorithms. See `archive/README.md` for research history.

## Algorithm Details

**Morton Linear Scan** - O(n), uses Z-order curve for spatial locality\
Bundle: ~2.3KB (minified)\
Best for: < 100 rectangles (2-8x faster than R-tree at sparse sizes)

**R-Star Tree** - O(log n), hierarchical with smart splits (Beckmann 1990)\
Bundle: ~5.9KB (minified)\
Best for: ≥ 100 rectangles (2x faster than linear scan at n=2500, scales better)

**Lazy Partitioned** - Separate indexes per attribute, spatial join on query\
Bundle: ~2.1KB (minified, wraps another index)\
Best for: Independent attributes (spreadsheet cells, GIS layers)

## Performance Data

All numbers from real benchmarks (5 runs, CV% < 5%). Absolute values vary by machine (±10-20%), but relative rankings hold.

See [BENCHMARKS.md](./BENCHMARKS.md) for current data or [benchmark-statistics.md](./docs/analyses/benchmark-statistics.md) for methodology.

## Special Cases

**High overlap workloads** - When many rectangles stack (e.g., conditional formatting in spreadsheets):

- Crossover shifts to n≈600 instead of n=100
- Why: Rectangle decomposition cost dominates, so linear scan stays competitive longer
- See [transition-zone-analysis](./docs/analyses/transition-zone-analysis.md) for workload-specific thresholds

**How to determine your workload**:

- **Read-heavy** (frequent queries): Use R*-tree at n > 100
- **High overlap** (many stacked rectangles): Use Morton until n > 600
- **Low overlap** (sparse inserts): Use R*-tree at n > 200
- **Mixed** (80% write / 20% read): Use Morton until n > 200

When in doubt, start with Morton (< 100) and measure your actual usage pattern before switching.

**Multiple independent attributes** - When tracking different properties per cell (backgrounds, borders, fonts):

- Use `LazyPartitionedIndex` - separate index per attribute, joins on query
- Best for properties updated independently (spreadsheet cells, GIS layers)

```typescript
import createLazyPartitionedIndex from '@jim/spandex/index/lazypartitionedindex';
import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';

const index = createLazyPartitionedIndex(createMortonLinearScanIndex);
index.set([0, 0, 10, 10], 'backgroundColor', 'red');
index.set([5, 5, 15, 15], 'fontSize', 14);
```

See [RECTANGLE-DECOMPOSITION-PRIMER](./docs/RECTANGLE-DECOMPOSITION-PRIMER.md) for the three strategies: LWW, Shallow Merge, and Spatial Join.

## Switching Algorithms

Same interface across all implementations - just swap the factory:

```typescript
// From this
const index = createMortonLinearScanIndex<string>();

// To this
const index = createRStarTreeIndex<string>();
```

That's it. No other code changes needed.

**Migrating data**: Export via `Array.from(index.query())`, create new index, re-insert. Complexity: O(n) export + O(n log n) or O(n²) depending on target algorithm.

**When to switch**: When n consistently >100-200 and profiling shows the spatial index is the bottleneck.

## Common Patterns

**"Deleting" data** - insert null:

```typescript
index.insert([0, 0, 10, 10], null); // LWW semantics
```

**Resetting index** - create new:

```typescript
index = createMortonLinearScanIndex<string>(); // Same cost as clear(), clearer intent
```

**Diagnostic methods** - use concrete types:

```typescript
import createRStarTreeIndex, { type RStarTreeIndex } from '@jim/spandex/index/rstartree';

const rtree = createRStarTreeIndex<string>();
rtree.size(); // O(1) count
rtree.getTreeQualityMetrics(); // { depth, overlapArea, deadSpace, nodeCount }
```

See [@jim/spandex README](./packages/@jim/spandex/README.md) for full API.

## References

- [BENCHMARKS.md](./BENCHMARKS.md) - Complete performance measurements
- [docs/analyses/transition-zone-analysis.md](./docs/analyses/transition-zone-analysis.md) - Crossover point empirical validation
- [docs/analyses/sparse-data-analysis.md](./docs/analyses/sparse-data-analysis.md) - Why O(n) dominates for n < 100
- [docs/core/RESEARCH-SUMMARY.md](./docs/core/RESEARCH-SUMMARY.md) - All research findings
