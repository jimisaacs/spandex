# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and Cursor IDE when working with code in this repository.

**Purpose**: Comprehensive reference + enforcement of project conventions and workflows.

## Project Overview

Spatial indexing research for 2D range decomposition in spreadsheet systems. Maintains non-overlapping ranges with last-writer-wins semantics using closed intervals `[min, max]`.

**Core Problem**: Insert overlapping 2D rectangles, automatically decompose into disjoint fragments (≤4 per overlap).

**Target Environment**: Google Apps Script (limits: no WASM, no SharedArrayBuffer, TypedArrays OK)

**Project Philosophy**: Active research with rigorous documentation. Archive failed experiments (research asset), maintain reproducibility, distinguish empirical findings from hypotheses.

## Common Commands

### Testing

```bash
deno task test                    # Run all active tests (113 tests)
deno task test:watch              # Watch mode
deno task test:morton             # Test specific implementation
deno task test:rstartree          # Test specific implementation
deno task test:adversarial        # Worst-case fragmentation tests
deno test test/specific.test.ts   # Run single test file
```

### Benchmarking

**⚠️ CRITICAL: TWO BENCHMARK SCRIPTS**

1. **`bench:update`** → Generates `BENCHMARKS.md` (quick, ~2 min)
2. **`bench:analyze`** → Generates `docs/analyses/benchmark-statistics.md` (slow, ~30 min)

**When to run each**:

- **During iteration**: Run `bench:update` frequently for quick feedback
- **Before completing task**: Run BOTH `bench:update` AND `bench:analyze` to ensure both docs are current
- **In CI/CD**: Always run BOTH to keep documentation complete

```bash
deno task bench                                      # Run active implementations only (default)
deno task bench:archived                             # Include archived implementations (opt-in)
deno task bench:update                               # Regenerate BENCHMARKS.md (auto-discovers implementations)
deno task bench:analyze <runs> <output-file>         # Statistical analysis (WARNING: 20-30 min for 5 runs)

# Statistical analysis - always overwrites benchmark-statistics.md
deno task bench:analyze 5 docs/analyses/benchmark-statistics.md  # Standard (20-30 min)
deno task bench:analyze 3 docs/analyses/benchmark-statistics.md  # Quick validation (10-15 min, less rigorous)

# Advanced options
deno task bench -- --exclude=CompactRTree            # Exclude specific impl
deno task bench -- --include-archived                # Same as bench:archived
```

**⚠️ IMPORTANT: `bench:analyze` Output File**

Always outputs to: `docs/analyses/benchmark-statistics.md`

- **Purpose**: Statistical validation of current active implementations
- **Usage**: `deno task bench:analyze 5 docs/analyses/benchmark-statistics.md`
- **Behavior**: OVERWRITES existing file (this is the canonical stats file)
- **When**: After replacing an implementation (e.g., Hilbert→Morton) or adding new active implementation
- **Content**: Performance rankings, CV% stability, detailed scenario breakdowns for all active implementations

**Note**: Don't create separate experiment result files - just overwrite `benchmark-statistics.md` when the experiment concludes and becomes production. The experiment hypothesis/methodology goes in `docs/analyses/[name]-analysis.md`, not in a separate stats file.

**⚠️ IMPORTANT: `bench:analyze` Duration**

The statistical analysis command runs VERY SLOWLY:

- **5 runs**: 20-30 minutes (recommended minimum for statistical validity)
- **3 runs**: 10-15 minutes (quick validation, less confidence)
- Each run: ~90 seconds × (number of implementations × number of scenarios)
- Includes 3-second cooldown between runs

**When to run**:

- ✅ After major implementation changes (e.g., replacing algorithm)
- ✅ When comparing archived vs active implementations
- ✅ For research experiments requiring statistical rigor (CV%, confidence intervals)
- ❌ NOT for quick checks (use `deno task bench` instead - takes ~2 min)

**Typical usage**:

```bash
# Run in background (recommended)
nohup deno run --allow-read --allow-write --allow-run scripts/analyze-benchmarks.ts 5 output.md > /tmp/bench.log 2>&1 &

# Monitor progress
tail -f /tmp/bench.log

# Quick 3-run analysis for validation (10-15 min)
deno task bench:analyze 3 docs/analyses/quick-check.md
```

**Benchmark Philosophy**: "Active by default, archived by choice"

- Auto-discovers from `packages/@jim/spandex/src/implementations/` (no manual registration)
- Archived implementations require `--include-archived` flag
- Use `--exclude=` for selective filtering during development

### Code Quality

```bash
deno task fmt                     # Format code (tabs, width 120, single quotes)
deno task lint                    # Lint
deno task check                   # Type check entire project (includes archive/)
```

### Implementation Management

```bash
deno task archive:impl <name> <category>    # Archive an implementation
deno task unarchive:impl <name>             # Restore from archive
```

## Architecture

### Core Interfaces

**`SpatialIndex<T>`** (packages/@jim/spandex/src/types.ts) - All implementations must implement this interface:

- `insert(bounds: Rectangle, value: T): void` - Last-writer-wins semantics
- `query(bounds?: Rectangle): IterableIterator<[Rectangle, T]>` - Find intersecting ranges, or all ranges if no argument

**`Rectangle`** - Core type-agnostic coordinate tuple:

```typescript
type Rectangle = readonly [xmin: number, ymin: number, xmax: number, ymax: number];
```

**Internal representation**: Closed intervals `[min, max]` where both endpoints are included

- All coordinates included: `xmin, ymin, xmax, ymax`
- Example: `[0, 0, 4, 4]` represents x:[0,4], y:[0,4] (both endpoints included)
- Why closed? Simplifies geometric operations (no `±1` adjustments in intersection/subtraction)

**External API**: `GridRange` (Google Sheets) uses half-open intervals `[start, end)` where end is excluded

- Conversion happens at boundaries via `createGridRangeAdapter()` in `packages/@jim/spandex/src/adapters/gridrange.ts`
- Adapter handles transformation: half-open `[start, end)` ⟷ closed `[start, end-1]`

### Implementation Families

**Current active implementations** (see `packages/@jim/spandex/src/implementations/` directory):

- **Morton spatial locality linear scan** - Production choice for sparse data (n < 100), uses Morton curve (Z-order) for spatial locality
- __R-Tree with R_ split_* - Production choice for large data (n ≥ 100), O(log n) hierarchical indexing

**Archived implementations** (see `archive/src/implementations/` for historical research):

- Reference implementations (test oracles)
- Superseded optimizations
- Failed experiments (TypedArray approaches, alternative split algorithms)
- Educational/minimal implementations

All implementations are auto-discovered by benchmarks from their filesystem location.

### Testing Framework

**Conformance tests** (packages/@local/spandex-testing/src/axioms/core.ts):

- Core axioms validate mathematical correctness (empty state, LWW semantics, overlap resolution, disjointness, fragment counts)
- ASCII snapshot tests validate visual rendering and round-trip parsing
- Every implementation must pass all conformance tests

**Adversarial tests** (test/adversarial.test.ts):

- Pathological patterns to validate O(n) fragmentation bound
- Concentric, diagonal, checkerboard, random patterns
- Validates geometric bounds under worst-case inputs

**Fragment Count Verification** (packages/@local/spandex-testing/src/axioms/core.ts:450-537):

- **Canonical correctness check**: Large-overlapping scenario MUST produce exactly 1375 fragments
- **Cross-implementation consistency**: All implementations must produce identical fragment counts
- **Purpose**: Catches coordinate bugs and algorithmic differences that pass invariant tests but produce incorrect decompositions

**Testing Philosophy**: Tests that pass while benchmarks fail indicate misconfigured tests, not correct code.

### Key Invariants

After every operation, these must hold:

1. **Non-duplication**: No duplicate (bounds, value) pairs
2. **Disjointness**: No overlapping rectangles (∀ i≠j: rᵢ ∩ rⱼ = ∅)

Validated by `assertInvariants()` in conformance tests.

## Development Workflow

### Adding a New Implementation

1. Create `packages/@jim/spandex/src/implementations/newimpl.ts` implementing `SpatialIndex<T>`
2. Create `test/newimpl.test.ts` with conformance tests
3. During development:
   ```bash
   deno task test && deno task check
   deno task bench:update  # Quick feedback (~2 min)
   ```
4. Before completing/committing:
   ```bash
   deno task bench:analyze 5 docs/analyses/benchmark-statistics.md  # Final stats (~30 min)
   ```
5. Benchmarks auto-discover from `packages/@jim/spandex/src/implementations/`

See docs/IMPLEMENTATION-LIFECYCLE.md for details.

### Archiving an Implementation

Use the automated script:

```bash
deno task archive:impl <name> <category>
# Update benchmark docs after archiving:
deno task bench:update  # Quick update BENCHMARKS.md to remove archived impl
# Before completing: also run bench:analyze to update stats
deno task bench:analyze 5 docs/analyses/benchmark-statistics.md  # (~30 min)
```

This moves files, fixes imports, and verifies type-checking. Manual archiving:

1. Move `packages/@jim/spandex/src/implementations/X.ts` → `archive/src/implementations/<category>/X.ts`
2. Move `test/X.test.ts` → `archive/test/X.test.ts`
3. Add header comment explaining why archived
4. Run `deno task bench:update` to regenerate BENCHMARKS.md
5. Update archive README if needed

Benchmarks automatically exclude archived implementations (based on filesystem location).

### Experiment Workflow (MANDATORY)

**CRITICAL RULE**: `docs/active/experiments/` must be **EMPTY** after experiment completion.

**Why this matters**:

- `docs/active/` is a **workspace**, not storage
- Empty workspace = clear research state
- Completed work goes to `analyses/` or `archive/`
- Only in-progress experiments stay in `active/`

**Experiment lifecycle**:

```
1. Create hypothesis → docs/active/experiments/[name]-experiment.md
2. Run benchmarks → OVERWRITES docs/analyses/benchmark-statistics.md
3. Document findings → docs/analyses/[name]-analysis.md
4. Resolution:
   ✅ VALIDATED → Update RESEARCH-SUMMARY.md, DELETE experiment doc
   ❌ REJECTED → Move experiment doc to archive/docs/experiments/
5. Clean workspace → DELETE from docs/active/experiments/
```

**Key insight**: `benchmark-statistics.md` is generic stats (win rates, CV%), not experiment-specific. Always overwrite it, don't create variants.

**Full workflow**:

1. **Start experiment**: Create `docs/active/experiments/[name]-experiment.md` with hypothesis
2. **Implement**: Create `packages/@jim/spandex/src/implementations/[name].ts` + `test/[name].test.ts` + add to benchmarks
3. **Iterate with quick benchmarks**:
   ```bash
   deno task bench:update  # Quick feedback during development (~2 min)
   ```
4. **Before completing - run full statistical analysis**:
   ```bash
   deno task bench:analyze 5 docs/analyses/benchmark-statistics.md  # Final stats (~30 min)
   ```
   - **CRITICAL**: Always outputs to `benchmark-statistics.md` (OVERWRITES, don't create experiment-specific files)
   - The data is generic (win rates, CV%, scenarios) - same structure for all experiments
5. **Document findings**: Create `docs/analyses/[name]-analysis.md` with hypothesis, methodology, outcome
6. **Update status**: Mark experiment doc with ✅ VALIDATED or ❌ REJECTED
7. **Resolution**:
   - ✅ **VALIDATED**: Update `docs/core/RESEARCH-SUMMARY.md`, keep implementation active, DELETE experiment doc
   - ❌ **REJECTED (moving on)**: Move experiment docs to `archive/docs/experiments/`, archive implementation
   - ❌ **REJECTED (might revisit)**: Leave in `active/experiments/` with notes
8. **Clean workspace**: **DELETE completed experiments from `docs/active/experiments/`**

**File naming convention** (prevents confusion):

- `docs/analyses/benchmark-statistics.md` - Statistical validation (ALWAYS this filename, always overwrite)
- `docs/analyses/[name]-analysis.md` - Experiment narrative (hypothesis, methodology, findings)
- `docs/active/experiments/[name]-experiment.md` - Work-in-progress tracking (DELETE when done)

**Before ending any experiment, verify**:

- [ ] **Both benchmark docs are current**:
  - [ ] `BENCHMARKS.md` updated (via `bench:update`)
  - [ ] `docs/analyses/benchmark-statistics.md` updated (via `bench:analyze`)
- [ ] Findings documented in `[name]-analysis.md`
- [ ] Summary updated in `RESEARCH-SUMMARY.md`
- [ ] Experiment files removed from `docs/active/experiments/`
- [ ] `ls docs/active/experiments/` shows ONLY in-progress work

**Example**:

```bash
# WRONG - Completed experiments still in active/
docs/active/experiments/
├── experiment-1.md (COMPLETED)
├── experiment-1-results.md
├── experiment-2.md (IN PROGRESS)

# CORRECT - Only active work
docs/active/experiments/
└── experiment-2.md (IN PROGRESS)

# Completed work properly archived
docs/analyses/experiment-1-analysis.md
archive/docs/experiments/failed-experiment-1.md
```

**Mental model**: `docs/active/` is your scratch pad (work in progress), everything else is permanent record.

See docs/active/README.md for full workflow details.

### Documentation Rules (CRITICAL)

**Generated files** (NEVER edit directly):

⚠️ **TWO benchmark documentation files**:

1. `BENCHMARKS.md` - Generated by `deno task bench:update` (~2 min, run frequently during iteration)
2. `docs/analyses/benchmark-statistics.md` - Generated by `deno task bench:analyze 5 docs/analyses/benchmark-statistics.md` (~30 min, run before completing tasks)

**Both must be current before completing/committing work.**

**Why not edit these files?** Your changes will be lost on next regeneration. If you need to fix:

- **Formatting/wording**: Edit `scripts/update-benchmarks.ts` or `scripts/analyze-benchmarks.ts` (the template generators)
- **Wrong data**: Fix the source (implementation code, benchmark scenarios), then regenerate
- **Missing info**: Add to the generating script's output template, then regenerate

**When to regenerate**:

```bash
# During development - quick feedback:
deno task bench:update  # Updates BENCHMARKS.md (~2 min)

# Before completing/committing - ensure both current:
deno task bench:update  # Updates BENCHMARKS.md (~2 min)
deno task bench:analyze 5 docs/analyses/benchmark-statistics.md  # Updates stats (~30 min)
```

**Document process, not state**:

- ❌ **BAD**: List all current implementations by name in structural docs
- ✅ **GOOD**: Describe algorithm families and optimization strategies, point to `packages/@jim/spandex/src/implementations/`
- ❌ **BAD**: "MortonLinearScanImpl is the production implementation"
- ✅ **GOOD**: "Spatial locality optimization is the production approach"

**When to use specific implementation names**:

- ✅ **Analysis files** (`docs/analyses/*.md`) - Report experimental results with specific names
- ✅ **Example code** - Show concrete usage examples
- ✅ **Operational guides** (PRODUCTION-GUIDE sections) - Show what to import
- ✅ **Diagram files** - Explain specific algorithm details
- ✅ **Experimental data** - "MortonLinearScanImpl achieved 6.9µs" (factual measurement)
- ❌ **Structural docs** (README, summaries) - Use generic terms in prescriptive sections
- ❌ **Decision tables** - Use algorithm approaches, not class names

**Why this matters**: When implementations are added/removed/renamed, only `packages/@jim/spandex/src/implementations/` and generated files need updating. Documentation stays valid without edits.

**Source of truth**: `packages/@jim/spandex/src/implementations/` directory = current active implementations

**After archiving implementations**: Run `deno task bench:update` to regenerate BENCHMARKS.md

**Research tone**: This is an ACTIVE research project

- Use present tense for ongoing work
- Use past tense only for completed/archived experiments
- Avoid "completed", "final", "finished" language in active docs
- Frame findings as "current understanding" not "conclusions"

## Important Concepts

### Internal Representation vs External Semantics

**Principle**: Algorithm internals should optimize for performance/compactness, not semantic constraints from external APIs.

**Key rule**: Semantic constraints (e.g., "Google Sheets coordinates start at 0") apply only at **API boundaries** (input/output), NOT internally.

**Why this matters**:

- Internal representation should be whatever is most performant (fewer branches, better symmetry)
- Conversion happens at boundaries: `Input → [convert] → Internal (optimized) → [convert] → Output`
- Don't impose semantic constraints internally unless they provide performance/correctness benefit

**Examples in codebase**:

- ✅ __R_-tree_*: Uses `NEG_INF/POS_INF` constants instead of `Infinity` (works with TypedArrays, symmetric)
- ✅ **MortonLinearScan**: Uses `MAX_COORD = 65536` constant (avoids `Infinity` checks in hot paths)

**See**: docs/active/semantic-vs-performance-principle.md for detailed rationale and optimization opportunities.

### Interval Semantics

**Critical**: Core library uses **closed intervals**, adapter uses **half-open intervals**.

**Core library (`Rectangle`)**: Closed intervals `[min, max]` where both endpoints are **included**

```typescript
[0, 0, 4, 4] = x:[0,4], y:[0,4] (all inclusive)
```

**Adapter layer (`GridRange`)**: Half-open intervals `[start, end)` where `end` is **excluded**

```typescript
// startRowIndex: 0, endRowIndex: 5 means rows 0, 1, 2, 3, 4 (NOT 5!)
[0, 5) = [0, 1, 2, 3, 4]
```

The adapter converts between Google Sheets' half-open semantics and the core library's closed intervals.

### Rectangle Decomposition

Insert algorithm (A \ B → ≤4 fragments):

- Given existing rectangle A and new rectangle B (overlap)
- Decompose A into ≤4 non-overlapping fragments
- Store B (last-writer-wins)
- Maintains disjointness invariant

### Space-Filling Curve Optimization

**Current approach**: Morton curve (Z-order) via bit interleaving

**Empirical Finding** (validated): Morton provides spatial locality benefits with simpler encoding

**Mechanism**: Bit interleaving maps 2D coordinates to 1D while preserving spatial locality. Constant-time encoding (vs iterative Hilbert) provides 25% speedup at small n.

**Limitation**: MAX_COORD = 65,536 (2^16). Coordinates ≥65K wrap/collide but algorithm remains correct (spatial locality may degrade).

**Historical note**: Originally used Hilbert curve, replaced with Morton after benchmarking showed 25% improvement. See docs/analyses/morton-vs-hilbert-analysis.md for full experimental analysis.

### Performance Guidelines

| Ranges          | Use                                 | Performance                     |
| --------------- | ----------------------------------- | ------------------------------- |
| < 100           | Spatial locality optimized (Morton) | Fastest for sparse data         |
| ≥ 100           | R-Tree with R* split                | Fastest for large datasets      |
| Bundle-critical | Compact linear scan                 | Smallest size, acceptable speed |

See PRODUCTION-GUIDE.md and BENCHMARKS.md for detailed decision tree and current performance data.

### Statistical Interpretation

When analyzing benchmark results (from `deno task bench:analyze`):

**Metrics**:

- **Mean (μ)**: Average performance
- **CV%**: Coefficient of Variation = `(σ/μ) × 100`
  - CV% <5% = Stable ✅
  - CV% >5% = Variable ⚠️
- **Sample size**: 5 runs × Deno's 10-100 internal iterations = 50-500 total iterations

**When to trust differences**:

- Report differences **>10%** with CV% <5% (large effect size + stable measurement)
- Expect ±10-20% absolute variance across different machines (relative rankings stay stable)
- All major findings (e.g., "2x faster") show >20% differences, well above noise

**Philosophy**: Focus on **effect size** (magnitude) over statistical significance (p-values)

- In microbenchmarks: "2x faster" matters, "2% faster" doesn't
- We measure magnitude and stability, not hypothesis testing

See docs/analyses/benchmark-statistics.md for full methodology.

## Code Conventions

**Formatting** (enforced by `deno fmt`):

- Tabs (width 4), line width 120
- Semicolons, single quotes

**Type Safety**:

- No `any` types in source code
- All implementations must `implements SpatialIndex<T>`
- All public APIs need JSDoc comments

**Imports**:

```typescript
✅ import { MortonLinearScanImpl } from '@jim/spandex';
✅ import HybridRTree from '../archive/src/implementations/failed-experiments/hybridrtree.ts';
```

## Research Integrity & Archive Management

**Philosophy**: Archive is a **research asset**, not trash. Failed experiments teach as much as successful ones.

**Why we keep archives**:

1. **Reproducibility**: All experiments remain runnable
2. **Historical comparison**: Benchmark against archived baselines
3. **Research continuity**: Document why approaches were abandoned
4. **Learning**: Failed hypotheses prevent repeated mistakes

**Hypothesis vs Validation**:

- **Empirical findings** (validated): What we measured (e.g., "2x faster")
- **Hypothesized mechanisms** (not validated): Why we think it works (e.g., "cache locality")
- Always distinguish between observation and inference

**Archive management**:

- Archived code must remain runnable
- Document WHY archived (performance data, validation failure, superseded by what)
- Keep tests with archived implementations
- Maintain import paths for reproducibility

**Running archived tests** (opt-in, may include failures from failed experiments):

```bash
deno test archive/test/specific.test.ts    # Specific test
deno test archive/test/                    # All archived tests
```

**Note**: Archived tests may fail (e.g., failed experiments) - this is expected and documented. Use `deno task test` or `deno test test/` for active tests only.

See archive/README.md for full archive philosophy and management.

## Quick Reference

### Common Scenarios

| Task                        | Commands                                                                                                                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Add new implementation**  | 1. Create `packages/@jim/spandex/src/implementations/name.ts` + `test/name.test.ts`<br>2. `deno task test && deno task bench:update && deno task check`                                        |
| **Run experiment**          | 1. Create `docs/active/experiments/name-experiment.md`<br>2. Implement + test<br>3. `deno task bench:analyze 5 docs/active/experiments/name-results.md`<br>4. Resolve and clean `docs/active/` |
| **Archive implementation**  | `deno task archive:impl <name> <superseded\|failed-experiments>`                                                                                                                               |
| **Compare vs archived**     | `deno task bench:archived`                                                                                                                                                                     |
| **Focus on specific impls** | `deno task bench -- --exclude=X --exclude=Y`                                                                                                                                                   |
| **Validate adversarial**    | `deno task test:adversarial`                                                                                                                                                                   |
| **Statistical analysis**    | `deno task bench:analyze 5 output.md`                                                                                                                                                          |

### Directory Structure

```
packages/@jim/spandex/src/implementations/  # Active implementations (auto-discovered by benchmarks)
test/                                        # Active tests (all passing)
docs/
├── active/experiments/  # In-progress work (MUST be empty when done)
├── analyses/            # Validated findings
└── core/                # Research summary + theory
archive/
├── src/implementations/ # Archived impls (opt-in via --include-archived)
├── test/                # Archived tests (may include failures)
├── benchmarks/          # One-off experiment benchmarks
└── docs/experiments/    # Rejected experiment documentation
scripts/                 # Automation (update-benchmarks.ts, analyze-benchmarks.ts)
benchmarks/              # Benchmark suites (performance.ts)
```

### Scripts vs Benchmarks

- **scripts/**: Automation tools you `deno run` (generators, analyzers, archiving)
- **benchmarks/**: Benchmark suites you `deno bench` (performance measurements)

## Temporary Workspace

**`.temp/` directory** - For AI assistant work-in-progress documents:

- Gitignored ephemeral workspace
- Use for temporary summaries, analysis docs, planning notes
- No pressure to clean up (but can delete when done)
- NOT for research findings (use `docs/active/experiments/`)

**Example use cases**:

- Multi-step review summaries
- Intermediate analysis results
- Scratch benchmarks
- Planning documents

---

## AI Assistant Auto-Sync Protocol

**CRITICAL**: After implementations, tests, or benchmarks change, run `deno task sync-docs` BEFORE responding to user.

### When to Run `sync-docs`

**Trigger patterns**:

- Archived/unarchived implementation → `deno task sync-docs`
- Modified `packages/@jim/spandex/src/implementations/*.ts` → `deno task sync-docs`
- Added/removed test axioms in `packages/@local/spandex-testing/src/axioms/core.ts` → `deno task sync-docs`
- Changed active implementation count → `deno task sync-docs`

**What it does**:

- Detects changed files (implementations, tests)
- Regenerates `BENCHMARKS.md` if implementations changed
- Reports test axiom count if tests changed

**Example workflow**:

```
1. User: "Archive SomeImplementation"
2. You: [runs archive command]
3. You: [runs `deno task sync-docs` - regenerates BENCHMARKS.md]
4. You: "✅ Archived SomeImplementation. Updated BENCHMARKS.md (now N implementations)"
```

### Response Template

When `sync-docs` updates files, mention it:

```
✅ [Task completed]
📝 Updated: BENCHMARKS.md (auto-discovered N implementations)
```

This prevents user frustration ("why is X still in the docs?").

---

## Pre-Commit Checklist

Before committing:

- [ ] All tests pass: `deno task test`
- [ ] Code formatted: `deno task fmt`
- [ ] Linted: `deno task lint`
- [ ] **Type-checked (ENTIRE PROJECT)**: `deno check` (no args - includes archive)
- [ ] Docs updated if behavior changed
- [ ] No `any` types in source code
- [ ] All public APIs have JSDoc comments
- [ ] `docs/active/experiments/` is EMPTY (or only has in-progress work)
- [ ] `.temp/` cleaned up (optional, but nice)
- [ ] If archiving: reason documented in archived file header

## Key Documentation

### Quick Reference

- **README.md** - Project overview and quick start
- **PRODUCTION-GUIDE.md** - Decision tree for choosing implementations
- **BENCHMARKS.md** - Performance data (auto-generated)
- **CLAUDE.md** (this file) - AI assistant context and project conventions

### Research Documentation

- **docs/core/RESEARCH-SUMMARY.md** - Executive summary of all findings
- **docs/core/theoretical-foundation.md** - Mathematical model, proofs, complexity analysis
- **docs/analyses/** - Individual experiment results
  - `hilbert-curve-analysis.md` - Spatial locality breakthrough (2x speedup)
  - `adversarial-patterns.md` - Worst-case fragmentation validation
  - `benchmark-statistics.md` - Statistical methodology and results
  - `r-star-analysis.md` - Split algorithm comparison
  - `sparse-data-analysis.md` - Why linear scan wins for n<100

### Development Workflows

- **docs/IMPLEMENTATION-LIFECYCLE.md** - Adding/archiving implementations
- **docs/BENCHMARK-FRAMEWORK.md** - Benchmark auto-discovery and philosophy
- **docs/active/README.md** - Experiment workflow
- **archive/README.md** - Archive philosophy and management
