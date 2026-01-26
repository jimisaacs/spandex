# Implementation History

This is a quick reference for all the implementations that have been archived. Each row tells you what was tried, when it was archived, why it didn't work out, and where to find the full analysis.

## Superseded Implementations

These worked but were replaced by better alternatives:

| Name                    | SHA       | Date       | Replaced By             | Reason                                 | Wins  | Analysis                                      |
| ----------------------- | --------- | ---------- | ----------------------- | -------------------------------------- | ----- | --------------------------------------------- |
| LinearScan              | `c1390d3` | 2025-10-07 | HilbertLinearScan       | 2x slower                              | 0/35  | Reference implementation                      |
| OptimizedLinearScan     | `c1390d3` | 2025-10-07 | HilbertLinearScan       | 2x slower, no spatial locality         | 3/35  | V8 optimizations insufficient                 |
| HilbertLinearScan       | `454e5c9` | 2025-10-08 | MortonLinearScan        | 25% slower encoding                    | 13/35 | `docs/analyses/morton-vs-hilbert-analysis.md` |
| CompactLinearScan       | `74bf7af` | 2025-10-08 | CompactMortonLinearScan | 2.4x slower, no spatial locality       | 0/35  | Size-optimized baseline                       |
| CompactMortonLinearScan | `d45b2d3` | 2025-10-08 | MortonLinearScan        | Same size after opts, 7 vs 18 wins     | 7/35  | Simplified spatial hint                       |
| ArrayBufferLinearScan   | `c1390d3` | 2025-10-07 | HilbertLinearScan       | TypedArray complexity, worse perf      | 2/35  | TypedArray ≠ faster                           |
| ArrayBufferRTree        | `c1390d3` | 2025-10-07 | RStarTree               | 15% slower construct, 34% slower query | 8/35  | `docs/analyses/r-star-analysis.md`            |

## Failed Experiments

These didn't work at all:

| Name         | SHA       | Date       | Failure Reason                              | Hypothesis             | Analysis                                               |
| ------------ | --------- | ---------- | ------------------------------------------- | ---------------------- | ------------------------------------------------------ |
| CompactRTree | `c1390d3` | 2025-10-07 | TypedArray can't handle dynamic tree splits | Compact R-tree for GAS | `archive/docs/experiments/compact-rtree-experiment.md` |
| HybridRTree  | `c1390d3` | 2025-10-07 | Switching overhead > specialized impl gains | Adaptive linear→tree   | `archive/docs/experiments/hybrid-rtree-experiment.md`  |

## About the Table

**SHA** - The git commit where this implementation last existed. You can use `git show <SHA>:path/to/file.ts` to view the code.

**Wins** - How many benchmark scenarios this implementation won out of 35 total. Lower numbers mean it was consistently slower.

**Analysis** - Where to find the detailed writeup explaining what was tried and why it didn't work out.

## Getting the Code

If you want to actually look at the implementation code:

```bash
# View a specific file
git show 454e5c9:archive/src/implementations/hilbertlinearscan.ts

# Save it to a file
git show 454e5c9:archive/src/implementations/hilbertlinearscan.ts > /tmp/hilbert.ts

# Restore the entire archive directory as it was
git checkout 454e5c9 -- archive/
```

```
```
