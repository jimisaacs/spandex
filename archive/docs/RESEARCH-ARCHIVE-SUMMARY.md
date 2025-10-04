# Research Archive Summary

**Date**: October 2025\
**Status**: All experiments concluded

---

## Archived Experiments

All experiments in this archive were **rejected** after rigorous testing. They are preserved for:

1. **Transparency**: Show what doesn't work (scientific integrity)
2. **Learning**: Understand why approaches failed
3. **Reproducibility**: Enable verification of negative results

---

## Experiments

### 1. Fast R-tree (R* Axis + Midpoint Split)

**Hypothesis**: R* axis selection without overlap minimization provides quality at lower cost\
**Result**: ❌ **REJECTED** - 1.29x slower than full midpoint, no benefit\
**Finding**: Axis selection cost is significant; without overlap minimization, there's no quality gain

**See**: [experiments/fast-rtree-experiment.md](./experiments/fast-rtree-experiment.md)

---

### 2. Tree Quality (R* Split for Queries)

**Hypothesis**: R* tree quality produces measurably faster queries\
**Result**: ❌ **REJECTED** - Midpoint split 1-30% faster or equivalent\
**Finding**: Theoretical tree quality doesn't translate to empirical query performance for this workload

**See**: [experiments/tree-quality-experiment.md](./experiments/tree-quality-experiment.md)

---

### 3. Hybrid R-tree (TypedArray + R-tree Index)

**Hypothesis**: TypedArray storage + R-tree spatial index = single optimal solution\
**Result**: ❌ **REJECTED** - 1.9-27x slower than specialized implementations\
**Finding**: Indirection overhead and double structure nullified benefits

**See**: [experiments/hybrid-rtree-experiment.md](./experiments/hybrid-rtree-experiment.md)

---

### 4. Corrected Transition Zone Analysis

**Hypothesis**: After Hilbert discovery, transition points need re-measurement\
**Result**: ✅ **SUPERSEDED** - Findings integrated into main documentation\
**Finding**: Crossover points refined with Hilbert data

**See**: [experiments/corrected-transition-analysis.md](./experiments/corrected-transition-analysis.md)

**Note**: This was later superseded by comprehensive transition-zone-analysis in main docs

---

### 5. Linear Scan Championship

**Hypothesis**: Which linear scan variant wins?\
**Result**: ✅ **SUPERSEDED** - ArrayBufferLinearScan won, then superseded by Hilbert\
**Finding**: ArrayBufferLinearScan 1.7x faster than Optimized, but Hilbert 2x faster than ArrayBuffer

**See**: [experiments/linearscan-comparison-analysis.md](./experiments/linearscan-comparison-analysis.md)

---

### 6. R-tree Comparison

**Hypothesis**: Which R-tree split algorithm wins?\
**Result**: ✅ **SUPERSEDED** - Findings in r-star-analysis.md\
**Finding**: R* is Pareto optimal (best quality at 6% cost)

**See**: [experiments/rtree-comparison-analysis.md](./experiments/rtree-comparison-analysis.md)

---

## Key Learnings from Rejected Experiments

### What Didn't Work:

1. **Hybrid approaches**: Complexity without benefit (1.9-27x slower)
2. __Partial R_ optimizations_*: Half-measures don't work (1.29x slower)
3. **Tree quality focus**: Theoretical metrics ≠ empirical performance

### What Did Work:

4. **Comprehensive testing**: 258+ scenarios revealed true patterns
5. **Willingness to reject**: 3/6 hypotheses rejected = good science
6. **Iterative refinement**: Hilbert discovery came from systematic exploration

---

## Relationship to Current Documentation

**Archive** (this directory):

- Temporal research summaries (4 files)
- Rejected experiments (9 files)
- Historical benchmark scripts (5 files)

**Main docs** (`../../docs/`):

- `core/RESEARCH-SUMMARY.md` - Authoritative summary of ALL findings
- `analyses/` - Individual validated findings (6 analyses)

**Rule**: Archive documents research PROCESS, main docs document RESULTS

---

## For Future Researchers

If you're exploring a new approach:

1. **Check archive first**: Has this been tried?
2. **Understand why it failed**: Don't repeat mistakes
3. **If trying again**: Document why you think it will work this time

**Example**: Hybrid R-tree failed because indirection overhead > benefits. If you have a way to eliminate indirection (e.g., WASM direct memory access), that's worth trying.

---

## Archive Philosophy

> "In research, negative results are as valuable as positive ones. We preserve them not as failures, but as learnings that narrow the search space."

**Archive ≠ Trash**\
**Archive = Historical Record**

These experiments represent rigorous scientific work. The hypotheses were reasonable, the methodology was sound, the results were honestly reported. They failed - but that's how science works.

---

## Completeness

**All experiments concluded**: ✅\
**All findings documented**: ✅\
**All implementations archived or promoted**: ✅\
**Active workspace clean**: ✅

This archive is complete and requires no further updates unless new experiments are attempted and rejected.
