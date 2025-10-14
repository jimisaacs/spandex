# Production Guide

## Algorithm Selection

```
n < 100  → MortonLinearScanImpl  (O(n), ~7µs @ n=50)
n ≥ 100  → RStarTreeImpl         (O(log n), ~50µs @ n=100)
```

**Rationale**: Empirically validated crossover at n≈100 across write-heavy, read-heavy, and mixed workloads. Linear scan overhead (iteration) < tree overhead (traversal + maintenance) for sparse data.

## Implementation Details

### MortonLinearScanImpl

**Complexity**: O(n) insert, O(n) query\
**Storage**: Flat array, Morton-ordered\
**Optimization**: Spatial locality via Z-order curve (constant-time bit interleaving)

```typescript
import { MortonLinearScanImpl } from '@jim/spandex';
const index = new MortonLinearScanImpl<T>();
```

### RStarTreeImpl

**Complexity**: O(log n) expected insert/query\
**Storage**: Hierarchical bounding volume tree\
**Split algorithm**: R* (Beckmann et al. 1990) - minimizes overlap and area

```typescript
import { RStarTreeImpl } from '@jim/spandex';
const index = new RStarTreeImpl<T>();
```

## Empirical Validation

**Measurement**: 5 runs × Deno internal sampling (50-500 total iterations), CV% < 5% (stable)\
**Effect size**: Report performance differences >20% (well above measurement noise)\
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

**Sparse properties** (n < 100 per property type): Independent `MortonLinearScanImpl` per property.

**Large consolidated datasets** (n ≥ 100): Single `RStarTreeImpl` per property type.

**Spatial join**: Query across multiple indices, combine at query time. Simpler than merge-based approaches for independent properties.

---

## Interface

```typescript
interface SpatialIndex<T> {
	insert(bounds: Rectangle, value: T): void;
	query(bounds?: Rectangle): IterableIterator<[Rectangle, T]>;
}
```

Both implementations provide identical interface. Migration requires only constructor change.

---

## Migration

**Procedure**:

1. `data = Array.from(oldIndex.query())`
2. `newIndex.insert(...)` for each entry
3. Swap reference

**Complexity**: O(n) export + O(n log n) R-tree reconstruction or O(n²) linear scan reconstruction.

**Trigger**: Migrate MortonLinearScan → RStarTree when n consistently > 100-200 and profiling shows spatial index bottleneck.

## References

- [BENCHMARKS.md](./BENCHMARKS.md) - Complete performance measurements
- [docs/analyses/transition-zone-analysis.md](./docs/analyses/transition-zone-analysis.md) - Crossover point empirical validation
- [docs/analyses/sparse-data-analysis.md](./docs/analyses/sparse-data-analysis.md) - Why O(n) dominates for n < 100
- [docs/core/RESEARCH-SUMMARY.md](./docs/core/RESEARCH-SUMMARY.md) - All research findings
