# Archived Experiments

Detailed writeups for 9 experiments that were tried between 2025-10-07 and 2025-10-08. Some failed completely, others worked but got replaced by better ideas.

## The Big Three Failures

| Experiment   | The Idea                                | What Happened      | The Problem                             |
| ------------ | --------------------------------------- | ------------------ | --------------------------------------- |
| HybridRTree  | Adaptive: linear scan → R-tree at n=100 | ❌ 1.9-27x slower  | Maintaining two structures, indirection |
| Fast R-tree  | R* axis selection + midpoint splits     | ❌ 1.29x slower    | Axis selection cost > savings           |
| CompactRTree | R-tree using TypedArrays                | ❌ Can't even work | TypedArrays can't handle dynamic splits |

These looked reasonable on paper but turned out to be dead ends. Read [RESEARCH-ARCHIVE-SUMMARY.md](./RESEARCH-ARCHIVE-SUMMARY.md) for the full story.

## What's Valuable Here

The `experiments/` directory has the full methodology and data for each attempt. This is useful when:

1. **You have a similar idea** - Check if it's already been tried. "What about combining X and Y?" → HybridRTree already tried that.

2. **Conditions changed** - HybridRTree failed due to JavaScript indirection overhead. In WASM with direct memory access, it might work differently.

3. **You want to understand the evolution** - Linear scan went through 4 iterations (basic → optimized → TypedArray → Hilbert) before landing on the current approach.

## Navigation

**One-line summaries**: [../IMPLEMENTATION-HISTORY.md](../IMPLEMENTATION-HISTORY.md) table with performance numbers

**Detailed writeups**: [RESEARCH-ARCHIVE-SUMMARY.md](./RESEARCH-ARCHIVE-SUMMARY.md) narrative with findings

**Raw experiments**: [experiments/](./experiments/) individual documents with full data

**Current research**: `../../docs/core/RESEARCH-SUMMARY.md` validated findings
