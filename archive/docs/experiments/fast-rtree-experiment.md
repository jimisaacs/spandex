# FastRTree Experiment

**Status**: ❌ REJECTED (1.29x slower than midpoint)

**Hypothesis**: R* axis selection + midpoint split = better quality without O(m²) cost

**Result**: Added cost without benefit — axis selection (cheap) doesn't help without overlap minimization (expensive but valuable)

---

## Hypothesis

**Question**: Can we get R* tree quality without R* cost?

R* algorithm has two phases:

1. **Axis selection**: O(m log m) — choose X or Y axis (cheap)
2. **Overlap minimization**: O(m²) — choose split point (expensive)

**Claim**: Maybe axis selection alone gives 80% of benefit for 7% of cost?

## Cost Analysis

For m=10 entries (MAX_ENTRIES):

| Algorithm | Axis Selection | Split Point | Total Ops | Notes                                                  |
| --------- | -------------- | ----------- | --------- | ------------------------------------------------------ |
| Midpoint  | None           | O(1)        | ~10       | Sort once, split at median                             |
| FastRTree | O(m log m)     | O(1)        | ~30       | Sort twice (X, Y), compute perimeters, split at median |
| R*        | O(m log m)     | O(m²)       | ~300      | Sort twice, compute overlaps for all k splits          |

**Cost ratio**: FastRTree adds 20 ops vs midpoint (2x slower on split), R* adds 270 ops (27x slower on split).

## Expected Outcomes

### Construction Time

- **ArrayBufferRTree** (midpoint): 2.24ms (current fastest)
- **FastRTree** (axis + midpoint): 2.4-2.5ms (projected, ~10% slower)
- **RStarTreeImpl** (R*): 2.32ms (current)

**Projection**: FastRTree should be between ArrayBufferRTree and RStarTreeImpl.

### Tree Quality

- **ArrayBufferRTree**: Midpoint split can create unbalanced bboxes
- **FastRTree**: Axis selection should improve bbox overlap
- **RStarTreeImpl**: Full overlap minimization, best quality

**Projection**: FastRTree bbox overlap should be 50-70% of ArrayBufferRTree.

### Query Performance

**Not yet measured** — this is the key unknown.

If FastRTree produces significantly better tree quality (less overlap), query performance could be much better than ArrayBufferRTree, making it the **Pareto optimal** choice.

## Implementation Details

**Key design decisions**:

1. **TypedArrays**: Use Int32Array for coordinates (cache-friendly, from ArrayBufferRTree)
2. **Regular arrays for children**: Variable-length children lists (simpler than arena)
3. R* axis heuristic: Minimize perimeter sum to choose split axis
4. **Midpoint split**: After choosing axis, split at median (no overlap computation)

**Code comparison**:

```typescript
// ArrayBufferRTree (simple midpoint)
const mid = Math.floor(children.length / 2);
this.nodeChildren[siblingIdx] = children.splice(mid);

// FastRTree (axis selection + midpoint)
let bestAxis = 0, minPerimeterSum = Infinity;
for (let axis = 0; axis < 2; axis++) {
	// Sort, compute perimeter sum for midpoint split on this axis
	// Choose axis with minimum perimeter
}
// Then split at midpoint along best axis
```

## Success Criteria

### Minimal Success

- Construction: Within 10% of ArrayBufferRTree (2.24ms → 2.5ms)
- Tree quality: Measurably better bbox overlap than midpoint
- Query: TBD (need to measure)

### Full Success (Pareto Optimal)

- Construction: < 2.4ms (faster than R* at 2.32ms)
- Tree quality: 70-90% as good as R* (overlap area comparison)
- Query: Measurably faster than ArrayBufferRTree

### Failure Conditions

- Construction > R* (defeats the purpose)
- Tree quality = ArrayBufferRTree (axis selection didn't help)
- Complexity without benefit (simpler to just use RStarTreeImpl)

## Measurement Plan

### Phase 1: Construction Time

Run benchmarks on existing workloads:

- sparse-sequential (n=50)
- large-sequential (n=2500)
- large-overlapping (n=1250)

**Compare**: FastRTree vs ArrayBufferRTree vs RStarTreeImpl

### Phase 2: Tree Quality Metrics

Add instrumentation to measure:

- Total bbox overlap area at leaf level
- Tree depth
- Average bbox perimeter
- Dead space (bbox area not covered by entries)

### Phase 3: Query Performance

Benchmark query workload (currently minimal in benchmarks):

- Point queries (single cell lookup)
- Range queries (10x10, 100x100, full sheet)
- Worst-case queries (high overlap regions)

## References

- Beckmann, N. et al. (1990) "The R*-tree" — Section 3.2 (ChooseSplitAxis)
- Current empirical data: docs/r-star-analysis.md
- ArrayBufferRTree: src/implementations/arraybufferrtree.ts (midpoint baseline)
- RStarTreeImpl: src/implementations/rstartree.ts (R* full algorithm)

## Status

🔬 **EXPERIMENTAL** — Hypothesis untested, awaiting benchmark results.
