# Tree Quality vs Query Performance Experiment

**Status**: 🔬 IN PROGRESS

**Hypothesis**: R* split's overlap minimization produces measurably better query performance that justifies its 6% construction cost overhead

**Research Question**: Does theoretical tree quality (low overlap, balanced depth) translate to empirical query performance gains?

---

## Motivation

Current research validates R* as "Pareto optimal" based on construction time vs theoretical tree quality. However:

**Gap**: No empirical measurement of:

1. Actual tree quality metrics (overlap, depth, dead space)
2. Query performance correlation with tree quality
3. Whether R*'s 6% cost is justified by query speedup

**Risk**: We might be recommending a more complex algorithm without measurable benefit.

---

## Hypothesis

R* split produces trees with:

- 20-40% less node overlap than midpoint split
- 10-20% faster query performance due to better pruning
- More balanced tree depth (±1 level)
- 10-15% better space efficiency

**Justification**: Beckmann et al. (1990) claim R* minimizes overlap and perimeter, leading to fewer node visits during queries.

---

## Methodology

### Phase 1: Tree Quality Metrics

Instrument RTreeImpl and ArrayBufferRTreeImpl to collect:

```typescript
interface TreeQualityMetrics {
	// Structure
	depth: number; // Maximum tree depth
	nodeCount: number; // Total internal nodes
	leafCount: number; // Total leaf nodes

	// Overlap
	totalOverlapArea: number; // Sum of all node overlap areas
	avgOverlapPerNode: number; // Mean overlap per internal node
	maxOverlap: number; // Worst-case overlap

	// Space efficiency
	totalBoundingArea: number; // Sum of all node MBRs
	actualDataArea: number; // Sum of actual data rectangles
	deadSpaceRatio: number; // (bounding - actual) / bounding
}
```

### Phase 2: Query Performance Benchmark

Test query performance on IDENTICAL data:

1. Build tree with RTreeImpl (R* split)
2. Build tree with ArrayBufferRTreeImpl (midpoint split)
3. Run 1000 random viewport queries on both
4. Measure: time per query, nodes visited, pruning efficiency

**Query patterns**:

- Point queries (single cell)
- Small viewports (10×10)
- Medium viewports (50×50)
- Large viewports (100×100)

### Phase 3: Correlation Analysis

Correlate tree quality metrics with query performance:

- Does lower overlap → faster queries?
- Does balanced depth → consistent query time?
- Does dead space ratio matter?

---

## Success Criteria

### Minimal Success

✅ Tree quality metrics collected for both implementations

✅ Query performance measured across 4 viewport sizes

✅ Statistical significance (CV% < 10%, p < 0.05)

### Full Success

✅ R* queries 10%+ faster than midpoint (justifies 6% construction cost)

✅ R* has 20%+ less overlap (validates theoretical claim)

✅ Clear correlation between overlap and query performance

### Failure Conditions

❌ No measurable query performance difference (< 5%)

❌ Midpoint queries faster than R* (algorithm choice wrong)

❌ High variance makes comparison inconclusive (CV% > 15%)

---

## Expected Outcomes

### If R* Wins (Expected)

**Result**: R* queries 10-20% faster, overlap 30% lower

**Conclusion**: R* choice validated empirically, not just theoretically

**Impact**: Can confidently recommend R* for query-heavy workloads

### If Midpoint Wins (Surprising)

**Result**: Queries within 5% performance, midpoint 21% faster construction

**Conclusion**: Simpler algorithm is Pareto optimal for most workloads

**Impact**: Change default to ArrayBufferRTreeImpl, demote RTreeImpl to "academic"

### If No Clear Winner

**Result**: Query performance similar (< 5% difference)

**Conclusion**: Construction time matters more than tree quality for this use case

**Impact**: Workload-dependent recommendation (writes → midpoint, reads → R*)

---

## Implementation Plan

1. Add `getMetrics()` method to both R-tree implementations
2. Collect metrics during tree construction
3. Create benchmark: `benchmarks/tree-quality.ts`
4. Run 5 iterations for statistical validity
5. Analyze correlation: overlap vs query time
6. Document findings

---

## References

- Beckmann, N. et al. (1990) "The R*-tree" - Claims overlap minimization improves queries
- Guttman, A. (1984) "R-trees" - Original quadratic split algorithm
- Current analysis: [r-star-analysis.md](../../analyses/r-star-analysis.md) - Construction time only
