# Implementation History

**Ultra-compact index of all archived implementations.** One line per implementation.
Code removed from repo (available in git history). Full analysis in linked docs.

---

## Superseded (replaced by better alternatives)

| Name                    | SHA       | Date       | Replaced By             | Why                                    | Perf       | Analysis                                      |
| ----------------------- | --------- | ---------- | ----------------------- | -------------------------------------- | ---------- | --------------------------------------------- |
| LinearScan              | `c1390d3` | 2025-10-07 | HilbertLinearScan       | 2x slower                              | 0/35 wins  | Reference impl                                |
| OptimizedLinearScan     | `c1390d3` | 2025-10-07 | HilbertLinearScan       | 2x slower, no spatial locality         | 3/35 wins  | V8 opts insufficient                          |
| HilbertLinearScan       | `454e5c9` | 2025-10-08 | MortonLinearScan        | 25% slower encoding                    | 13/35 wins | `docs/analyses/morton-vs-hilbert-analysis.md` |
| CompactLinearScan       | `74bf7af` | 2025-10-08 | CompactMortonLinearScan | 2.4x slower, no spatial locality       | 0/35 wins  | Size-optimized baseline                       |
| CompactMortonLinearScan | `d45b2d3` | 2025-10-08 | MortonLinearScan        | Same size after opts, 18 vs 7 wins     | 7/35 wins  | Simplified spatial hint                       |
| ArrayBufferLinearScan   | `c1390d3` | 2025-10-07 | HilbertLinearScan       | TypedArray complexity, worse perf      | 2/35 wins  | TypedArray ≠ faster                           |
| ArrayBufferRTree        | `c1390d3` | 2025-10-07 | RStarTree               | 15% slower construct, 34% slower query | 8/35 wins  | `docs/analyses/r-star-analysis.md`            |

## Failed Experiments (didn't work)

| Name         | SHA       | Date       | Why Failed                                  | Hypothesis             | Analysis                                               |
| ------------ | --------- | ---------- | ------------------------------------------- | ---------------------- | ------------------------------------------------------ |
| CompactRTree | `c1390d3` | 2025-10-07 | TypedArray can't handle dynamic tree splits | Compact R-tree for GAS | `archive/docs/experiments/compact-rtree-experiment.md` |
| HybridRTree  | `c1390d3` | 2025-10-07 | Switching overhead > specialized impl gains | Adaptive linear→tree   | `archive/docs/experiments/hybrid-rtree-experiment.md`  |

---

**Legend:**

- **SHA**: Git commit where code last existed (use `git show SHA:path/to/file.ts`)
- **Perf**: Benchmark wins out of 35 scenarios (from `docs/analyses/benchmark-statistics.md`)
- **Analysis**: Full experiment writeup with hypothesis, data, conclusion

**Retrieving archived code:**

```bash
# View file at specific commit
git show 454e5c9:src/implementations/hilbertlinearscan.ts

# Checkout entire archive state
git checkout 454e5c9 -- archive/
```
