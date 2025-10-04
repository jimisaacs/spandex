# Archive

This directory contains archived implementations, experiments, and documentation from the spatial indexing research project.

## Purpose

Research asset, not trash bin:

- Reproducibility: Experiments remain runnable
- Historical comparison: Benchmark against archived baselines
- Research continuity: Document why abandoned
- Learning: Failed experiments teach

## Structure

```
archive/
├── benchmarks/          # One-off experiment benchmarks
├── src/
│   └── implementations/ # Archived implementations
│       ├── failed-experiments/  # Failed hypotheses
│       └── superseded/          # Working but obsolete
├── test/                # Archived tests
└── docs/                # Experiment documentation
```

## Running Archived Benchmarks

Archived benchmarks can still be run directly:

```bash
# Run specific archived benchmark
deno bench archive/benchmarks/hybrid-validation.ts

# Or run from archive directory
cd archive && deno bench benchmarks/hybrid-validation.ts
```

Archived benchmarks use the same `deno.json` configuration as the main project, so they have access to all imports and settings.

## Archived Implementations

### Structure

```
archive/src/implementations/
├── superseded/          # Working but replaced by better versions
└── failed-experiments/  # Failed validation or hypothesis testing
```

**To see what's archived**: Browse directories or check file headers for archival reasons.

**To compare against archived**: See `docs/BENCHMARK-FRAMEWORK.md` for how to include in benchmarks.

### Categories

**Superseded**: Implementation worked but was replaced by a better approach (e.g., faster, simpler, or more correct).

**Failed Experiments**: Implementation failed conformance tests, performed poorly, or added complexity without benefit.

Each archived file includes a header documenting:

- Why it was archived
- Performance data (if applicable)
- What replaced it (if superseded)
- Lessons learned

## Archived Benchmarks

One-off experiments that tested specific hypotheses:

- `corrected-transition.ts` - Transition point analysis (linear → R-tree)
- `hilbert-validation.ts` - Hilbert curve optimization validation
- `hybrid-validation.ts` - Hybrid R-tree validation
- `linearscan-championship.ts` - Linear scan variant comparison
- `rtree-shootout.ts` - R-tree variant comparison

These benchmarks can import from both active (`src/implementations/`) and archived (`archive/src/implementations/`) implementations.

## Archived Documentation

See `archive/docs/` for:

- Experiment documentation and results
- Failed hypothesis analysis
- Historical research summaries

Key document: `archive/docs/RESEARCH-ARCHIVE-SUMMARY.md` - Authoritative summary of archived research phases.

## Managing the Archive

### Archiving an Implementation

Use the automated script:

```bash
deno task archive:impl <ImplName> <category>

# Example
deno task archive:impl CompactRTree superseded
```

Or manually:

1. Move `src/implementations/X.ts` → `archive/src/implementations/[category]/X.ts`
2. Move `test/X.test.ts` → `archive/test/[category]/X.test.ts`
3. Fix import paths in archived files
4. Add documentation header to archived file
5. Update this README

### Restoring an Implementation

Use the automated script:

```bash
deno task unarchive:impl <ImplName> <category>

# Example
deno task unarchive:impl CompactRTree superseded
```

Benchmarks will automatically discover it via file system scanning.

## Research Integrity

Why we keep archives:

1. Reproducibility
2. Context for future work
3. Benchmark baselines
4. Honesty (failures + successes)

Maintenance: Keep code runnable, document WHY, consolidate periodically

---

For current research status, see `docs/core/RESEARCH-SUMMARY.md`.
