# Research Archive Summary

Between October 7-8, 2025, six experiments were run. Three failed completely, three succeeded but were later superseded. Here's what was learned.

## Failed Experiments

### HybridRTree: Adaptive Index (1.9-27x slower)

Tried to automatically switch from linear scan to R-tree at n=100. Used TypedArray for compact storage with an R-tree for spatial queries.

**Why it failed**: Indirection overhead. Every operation needed to check which strategy to use, maintain two data structures, and coordinate between them. The switching logic cost more than the optimization saved.

**Lesson**: Don't try to combine fundamentally different approaches in one implementation. Specialize.

[Full writeup →](./experiments/hybrid-rtree-experiment.md)

### Fast R-tree: Cheap Quality (1.29x slower)

Used R* axis selection (which is smart) but midpoint splits (which are cheap). The idea was to get R* quality without the full R* cost.

**Why it failed**: Axis selection itself is expensive. Without overlap minimization, axis selection provides zero benefit - you're paying for the analysis but not using the insights.

**Lesson**: Half-measures in algorithms usually don't work. Either commit to the optimization or skip it entirely.

[Full writeup →](./experiments/fast-rtree-experiment.md)

### Tree Quality: Theory vs Practice (Midpoint faster!)

Hypothesis: R* produces better tree structure, so queries should be faster even if construction is slower.

**Why it failed**: Theoretical tree quality metrics (overlap, coverage) didn't correlate with actual query performance. Midpoint splits were 1-30% faster or equivalent despite having "worse" tree structure by academic metrics.

**Lesson**: Measure what matters. Real-world performance beats theoretical metrics.

[Full writeup →](./experiments/tree-quality-experiment.md)

## Successful Experiments (Later Superseded)

### Linear Scan Evolution

Tested four variants: basic → optimized → TypedArray → Hilbert curve. Each was better than the last:

- OptimizedLinearScan: 2x faster than basic
- ArrayBufferLinearScan: 1.7x faster than optimized
- HilbertLinearScan: 2x faster than ArrayBuffer
- MortonLinearScan: 25% faster than Hilbert (simpler encoding)

**Key insight**: Spatial locality matters more than data structure choice for small n.

[Evolution writeup →](./experiments/linearscan-comparison-analysis.md)

### R-tree Split Algorithms

Compared three approaches: quadratic (slow), midpoint (fast), R* (quality). R* won: 6% slower than midpoint but produced measurably better results.

**Key insight**: Unlike the tree quality experiment above, the R* advantage _does_ show up when you use the full algorithm.

[Comparison →](./experiments/rtree-comparison-analysis.md) • [Current analysis →](../../docs/analyses/r-star-analysis.md)

### Transition Zone Analysis

Measured crossover points where R-tree becomes faster than linear scan. Results were refined multiple times as faster implementations were discovered.

**Key insight**: Crossover depends heavily on workload characteristics, not just n. See current docs for full analysis.

[Early version →](./experiments/corrected-transition-analysis.md) • [Current analysis →](../../docs/analyses/transition-zone-analysis.md)

## Key Takeaways

**Specialization beats generalization** - HybridRTree tried to be good at everything, ended up 1.9-27x slower than specialized implementations. Better to have two separate implementations that each excel in their domain.

**All-or-nothing optimizations** - Fast R-tree tried to cherry-pick the good parts of R*. Didn't work. Complex optimizations need full commitment or should be skipped entirely.

**Measure what matters** - Tree quality metrics from academic papers didn't correlate with actual performance. Theory is a guide, not a destination.

**Iteration works** - Linear scan went through 4 versions before landing on Morton curves. Each experiment built on learnings from the previous one.

**Negative results have value** - These three failures saved future researchers from weeks of wasted effort. Now we know hybrid approaches don't work in JavaScript due to indirection overhead (though they might in WASM).

## Before You Start Something New

Check `experiments/` to see if it's been tried. The most common ideas that didn't work:

- Combining approaches (HybridRTree)
- Partial algorithm implementations (Fast R-tree)
- Optimizing for theoretical metrics (Tree Quality)

If you think you can solve one of these problems (e.g., eliminate indirection with WASM), document why your approach is different before implementing.

For current best practices, see `../../docs/core/RESEARCH-SUMMARY.md`.
