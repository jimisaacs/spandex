# Archive

**Note**: Archived implementation code has been removed from the filesystem but is preserved in git history.

The code for archived implementations has been removed, but documentation and git history preserve everything. This keeps the repository maintainable while preserving the research record.

## What's Archived

**7 superseded implementations** - Worked but were replaced by better alternatives (e.g., HilbertLinearScan → MortonLinearScan was 25% faster)

**2 failed experiments** - Didn't work at all (e.g., HybridRTree had 1.9-27x overhead from indirection)

**4 analysis docs** - Early findings later refined in main documentation

See [IMPLEMENTATION-HISTORY.md](./IMPLEMENTATION-HISTORY.md) for the complete table with performance numbers and git SHAs.

## Why This Matters

Three implementations seemed reasonable but failed spectacularly:

1. **HybridRTree** (1.9-27x slower) - Tried to adaptively switch between linear scan and R-tree. Indirection overhead killed it.

2. **Fast R-tree** (1.29x slower) - Used R* axis selection with midpoint splits to get quality cheaply. Axis selection cost more than it saved.

3. **CompactRTree** - Couldn't handle dynamic splits with TypedArrays. Fundamentally incompatible with how R-trees work.

If you're thinking "what if we combine X and Y?" or "what if we optimize Z?", check here first. Chances are it's been tried.

## Getting Archived Code

Each entry in IMPLEMENTATION-HISTORY.md has a git SHA. Use it to retrieve the code:

```bash
# View the implementation
git show 454e5c9:archive/src/implementations/hilbertlinearscan.ts

# Run benchmarks from that point
git checkout 454e5c9 -- archive/
deno bench archive/benchmarks/
git restore archive/  # Clean up
```

The code is fully runnable from git history - tests, benchmarks, everything.

## What to Read

**Quick lookup**: [IMPLEMENTATION-HISTORY.md](./IMPLEMENTATION-HISTORY.md) has a one-line summary of each archived implementation

**Experiment details**: [docs/RESEARCH-ARCHIVE-SUMMARY.md](./docs/RESEARCH-ARCHIVE-SUMMARY.md) explains what was tried and why it failed

**Current state**: `../docs/core/RESEARCH-SUMMARY.md` documents validated findings and active implementations
