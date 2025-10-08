# R-tree Shootout Experiment

**Status**: ❌ HYPOTHESIS REJECTED (Pattern-Dependent Winners)

**Hypothesis**: ArrayBufferRTreeImpl (midpoint split) is the optimal R-tree variant for all realistic spreadsheet workloads at n > 1000

**Research Question**: Which of our 3 R-tree implementations should be THE production recommendation?

**Result**: NO single winner - ArrayBufferRTree wins sequential (100%), RTree (R*) wins grid (67%) and overlapping (78%)

---

## Motivation

**Current confusion**:

- RStarTreeImpl (R* split): Claimed "Pareto optimal" but tree-quality experiment disproved this
- ArrayBufferRTreeImpl (midpoint): 21-28% faster construction, equivalent or better queries
- CompactRTreeImpl: Unknown performance, supposedly "compact"

**Need clarity**: Pick ONE winner for n > 1000 scenarios.

---

## Hypothesis

ArrayBufferRTreeImpl wins across:

- All data sizes (n = 1000, 2500, 5000)
- All patterns (sequential, grid, overlapping)
- All workloads (write-heavy, read-heavy, mixed)

**Why**: Simpler algorithm (midpoint split) + TypedArrays + no R* overhead = faster everywhere.

**Alternative outcomes**:

- RStarTreeImpl wins in specific scenarios (unlikely after tree-quality results)
- CompactRTreeImpl competitive (very unlikely - "compact" usually means slow)
- Different winner per workload (bad - want ONE recommendation)

---

## Methodology

### Comprehensive Head-to-Head

Test all 3 R-tree implementations:

**Data sizes**: 1000, 2500, 5000 (large data range)

**Patterns**:

- Sequential: Low overlap, naturally ordered
- Grid: Medium overlap, 2D tiling
- Overlapping: High overlap, heavy decomposition

**Workloads**:

- Construction only (write-heavy baseline)
- Construction + 1000 queries (balanced)
- Construction + 5000 queries (read-heavy)

**Metrics**:

- Total time (construction + queries)
- Winner per scenario
- Consistency (does same impl win across scenarios?)

### Success Criteria

**Minimal Success**:

- Clear winner identified for majority of scenarios
- Statistical stability (CV% < 10%)

**Full Success**:

- ONE implementation wins >80% of scenarios
- Clear recommendation possible

**Failure**:

- No consistent winner (need more experiments)
- CompactRTree competitive (undermines all prior research)

---

## Expected Outcomes

### Scenario A: ArrayBufferRTree Dominates (Most Likely)

**Result**: Wins 90%+ of scenarios

**Conclusion**: Demote RStarTreeImpl to "research baseline", promote ArrayBufferRTreeImpl to production

**Action**: Update all documentation, simplify recommendations

### Scenario B: Workload-Specific Winners

**Result**: RStarTreeImpl wins read-heavy, ArrayBufferRTree wins write-heavy

**Conclusion**: Need workload-specific recommendations

**Action**: Create decision matrix based on read/write ratio

### Scenario C: RStarTreeImpl Vindicated (Unlikely)

**Result**: RStarTreeImpl wins despite tree-quality experiment

**Conclusion**: Something wrong with tree-quality experimental design

**Action**: Re-examine tree-quality experiment, maybe different data distribution matters

---

## Implementation Plan

1. Create `benchmarks/rtree-shootout.ts`
2. Test 3 implementations × 3 sizes × 3 patterns × 3 workloads = 81 scenarios
3. Run benchmarks, collect data
4. Analyze: Which impl wins most scenarios?
5. Document findings
6. Update production recommendations

---

## References

- Tree quality experiment: Proved R* doesn't help queries
- Current benchmarks: Show ArrayBufferRTree faster construction
- Need: Comprehensive head-to-head to pick winner
