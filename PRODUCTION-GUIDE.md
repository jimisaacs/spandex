# Production Guide

Algorithm selection for `@jim/spandex` spatial indexing.

## Algorithm Selection

```
n < 100  → createMortonLinearScanIndex()  (O(n), ~7µs @ n=50)
n ≥ 100  → createRStarTreeIndex()         (O(log n), ~50µs @ n=100)
```

**Rationale**: Empirically validated crossover at n≈100 across write-heavy, read-heavy, and mixed workloads. Linear scan overhead (iteration) < tree overhead (traversal + maintenance) for sparse data.

## Implementation Details

### Morton Linear Scan

**Complexity**: O(n) insert, O(n) query\
**Storage**: Flat array, Morton-ordered\
**Optimization**: Spatial locality via Z-order curve

```typescript
import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
const index = createMortonLinearScanIndex<T>();
```

### R-Star Tree

**Complexity**: O(log n) expected insert/query\
**Storage**: Hierarchical bounding volume tree\
**Split algorithm**: R* (Beckmann et al. 1990)

```typescript
import createRStarTreeIndex from '@jim/spandex/index/rstartree';
const index = createRStarTreeIndex<T>();
```

## Empirical Validation

**Measurement**: 5 runs × Deno internal sampling (50-500 total iterations), CV% < 5%\
**Effect size**: Report performance differences >20%\
**Cross-platform**: Relative rankings stable, absolute values vary ±10-20%

See [BENCHMARKS.md](./BENCHMARKS.md) for complete data, [benchmark-statistics.md](./docs/analyses/benchmark-statistics.md) for methodology.

## Workload Sensitivity

| Workload     | Crossover | Notes                                        |
| ------------ | --------- | -------------------------------------------- |
| Write-heavy  | n ≈ 100   | Tree construction overhead vs scan cost      |
| Read-heavy   | n ≈ 100   | Query pruning benefit vs traversal cost      |
| High overlap | n ≈ 600   | Decomposition cost dominates both algorithms |

**Transition zone** (100 < n < 600): Both competitive. R-tree preferred if n expected to grow.

See `docs/analyses/transition-zone-analysis.md` for detailed empirical analysis.

---

## Usage Patterns

**Independent attributes** (n < 100 per attribute): Use `LazyPartitionedIndex` with Morton backend per attribute.

**Large consolidated data** (n ≥ 100): Use R-Star tree for single large dataset.

**Spatial join**: Query across multiple independent indexes, combine at query time.

---

## Interface

```typescript
interface SpatialIndex<T> {
	insert(bounds: Rectangle, value: T): void;
	query(bounds?: Rectangle): IterableIterator<[Rectangle, T]>;
	extent(): ExtentResult;
}
```

Identical interface. Migration = swap factory function.

### Implementation-Specific Methods

**Diagnostic methods** available on concrete types (not on `SpatialIndex<T>` interface):

```typescript
// MortonLinearScanIndex
import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
const morton = createMortonLinearScanIndex<string>();
morton.size(); // Count of stored rectangles (O(1))

// RStarTreeIndex
import createRStarTreeIndex from '@jim/spandex/index/rstartree';
const rtree = createRStarTreeIndex<string>();
rtree.size(); // Count of stored rectangles (O(1))
rtree.getTreeQualityMetrics(); // { depth, overlapArea, deadSpace, nodeCount }
```

**Why not on base interface?** These expose internal implementation details. Use the concrete type when needed:

```typescript
import type { MortonLinearScanIndex } from '@jim/spandex/index/mortonlinearscan';

function analyzeFragmentation(index: MortonLinearScanIndex<string>) {
	return index.size(); // Type-safe access
}
```

### Common Patterns

**"Deleting" formatting** (use Last-Writer-Wins):

```typescript
// Clear formatting in region
index.insert([0, 0, 10, 10], null); // LWW overwrites previous values
```

**Resetting entire index**:

```typescript
// Create new index instead of clear()
index = createMortonLinearScanIndex<CellStyle>();
```

**Why no `delete()` or `clear()`?**

- Delete = insert null (LWW semantics)
- Clear = create new index (same performance, clearer intent)

---

## Migration

**Procedure**:

1. `data = Array.from(oldIndex.query())`
2. `newIndex = createRStarTreeIndex<T>()`
3. `newIndex.insert(...)` for each entry
4. Swap reference

**Complexity**: O(n) export + O(n log n) R-tree reconstruction or O(n²) linear scan reconstruction.

**Trigger**: Migrate MortonLinearScan → RStarTree when n consistently > 100-200 and profiling shows spatial index bottleneck.

## References

- [BENCHMARKS.md](./BENCHMARKS.md) - Complete performance measurements
- [docs/analyses/transition-zone-analysis.md](./docs/analyses/transition-zone-analysis.md) - Crossover point empirical validation
- [docs/analyses/sparse-data-analysis.md](./docs/analyses/sparse-data-analysis.md) - Why O(n) dominates for n < 100
- [docs/core/RESEARCH-SUMMARY.md](./docs/core/RESEARCH-SUMMARY.md) - All research findings
