# Production Guide

Quick reference for choosing algorithms in [@jim/spandex](https://jsr.io/@jim/spandex).

## Pick an Algorithm

```typescript
// Less than 100 rectangles
import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
const index = createMortonLinearScanIndex<string>();

// 100+ rectangles
import createRStarTreeIndex from '@jim/spandex/index/rstartree';
const index = createRStarTreeIndex<string>();
```

**Why n=100?** That's where tree traversal overhead starts paying off. Below that, simple iteration is faster.

## The Algorithms

**Morton Linear Scan** - O(n), uses Z-order curve for spatial locality\
Best for: < 100 rectangles, ~7µs @ n=50

**R-Star Tree** - O(log n), hierarchical with smart splits (Beckmann 1990)\
Best for: ≥ 100 rectangles, ~50µs @ n=100

**Lazy Partitioned** - Separate indexes per attribute, spatial join on query\
Best for: Independent attributes (spreadsheet cells, GIS layers)

## Performance Data

All numbers from real benchmarks (5 runs, CV% < 5%). Absolute values vary by machine (±10-20%), but relative rankings hold.

See [BENCHMARKS.md](./BENCHMARKS.md) for current data or [benchmark-statistics.md](./docs/analyses/benchmark-statistics.md) for methodology.

## Special Cases

**High overlap workloads** (lots of rectangles stacking on each other): Crossover shifts to n≈600 because decomposition dominates.

**Multiple independent attributes**: Use `LazyPartitionedIndex` - it creates separate indexes per attribute and joins results on query.

```typescript
import createLazyPartitionedIndex from '@jim/spandex/index/lazypartitionedindex';
import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';

const index = createLazyPartitionedIndex(createMortonLinearScanIndex);
index.set([0, 0, 10, 10], 'backgroundColor', 'red');
index.set([5, 5, 15, 15], 'fontSize', 14);
```

## Switching Algorithms

Same interface across all implementations - just swap the factory:

```typescript
// From this
const index = createMortonLinearScanIndex<T>();

// To this
const index = createRStarTreeIndex<T>();
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
index = createMortonLinearScanIndex<T>(); // Same cost as clear(), clearer intent
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
