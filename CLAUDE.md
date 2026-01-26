# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and Cursor IDE when working with code in this repository.

**Purpose**: Comprehensive reference + enforcement of project conventions and workflows.

## What's Unique About This Repo

**Active research project** - Experiments move from `docs/active/` → `docs/analyses/` or `archive/` when complete.

**Key invariant**: `docs/active/experiments/` must be **empty** after completing work (workspace, not storage).

**Archive approach**: Archived implementation code exists only in **git history** (not on filesystem). See `archive/IMPLEMENTATION-HISTORY.md` for git SHAs to retrieve code.

**Active implementations** (3): `mortonlinearscan`, `rstartree`, `lazypartitionedindex` in `packages/@jim/spandex/src/index/`

**Documentation structure**:
- `PRODUCTION-GUIDE.md` - When to use which algorithm
- `docs/GETTING-STARTED.md` - Complete tutorial
- `docs/IMPLEMENTATION-LIFECYCLE.md` - Add/archive workflows
- `BENCHMARKS.md` + `docs/analyses/benchmark-statistics.md` - Generated files (never edit directly)

## Project Overview

**Monorepo** for 2D spatial indexing research. Maintains non-overlapping rectangles with last-writer-wins semantics using closed intervals `[min, max]`.

**Core Problem**: Insert overlapping 2D rectangles, automatically decompose into disjoint fragments (≤4 per overlap).

**Deployment Targets**: Pure JavaScript environments including browsers, Node.js, Deno, and constrained runtimes. Optimized for environments without WASM or SharedArrayBuffer (TypedArrays supported). One target deployment is Google Apps Script for spreadsheet property tracking.

**Monorepo Structure**: Contains independent packages for spatial indexing (`@jim/spandex*`), general-purpose snapshot testing (`@local/snapmark`), and spandex-specific testing tools (`@local/spandex-testing`, `@local/spandex-telemetry`).

**Published Packages**:

- `@jim/spandex` - Core spatial indexing library
- `@jim/spandex-ascii` - ASCII visualization renderer
- `@jim/spandex-html` - HTML rendering utilities

**Project Philosophy**: Active research with rigorous documentation. Archive failed experiments (research asset), maintain reproducibility, distinguish empirical findings from hypotheses.

## Common Commands

### Testing

```bash
deno task test                    # Run all active tests
deno task test:watch              # Watch mode
deno task test:morton             # Test specific implementation (Morton)
deno task test:rstartree          # Test specific implementation (R-tree)
deno task test:adversarial        # Worst-case fragmentation tests
deno test packages/@jim/spandex/test/lazypartitionedindex.test.ts       # Run single test file

# Update fixtures when tests change
UPDATE_FIXTURES=1 deno test -A   # Regenerate all fixture files
```

**Fixture Update Workflow**: Tests use snapshot fixtures stored as markdown files. When test behavior changes intentionally:

1. Run with `UPDATE_FIXTURES=1` to regenerate fixtures
2. Review diffs carefully (ensure changes are intentional)
3. Commit updated fixture files with code changes

**Example**:

```bash
# After changing test behavior
UPDATE_FIXTURES=1 deno test -A packages/@jim/spandex/test/adapter/

# Or update specific implementation tests
UPDATE_FIXTURES=1 deno task test:morton
UPDATE_FIXTURES=1 deno task test:rstartree

# Review changes
git diff packages/@jim/spandex/test/**/fixtures/*.md
```

**Note**: `UPDATE_FIXTURES=1` requires `-A` flag (all permissions) to access environment variables.

### Benchmarking

**See [docs/BENCHMARK-FRAMEWORK.md](./docs/BENCHMARK-FRAMEWORK.md) for complete benchmarking workflows and when to use which command.**

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

- Auto-discovers from `packages/@jim/spandex/src/index/` (no manual registration)
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
- `extent(): ExtentResult` - Get minimum bounding rectangle with infinity edge flags

**`Rectangle`** - Core type-agnostic coordinate tuple:

```typescript
type Rectangle = readonly [xmin: number, ymin: number, xmax: number, ymax: number];
```

**Internal representation**: Closed intervals `[min, max]` where both endpoints are included

- All coordinates included: `xmin, ymin, xmax, ymax`
- Example: `[0, 0, 4, 4]` represents x:[0,4], y:[0,4] (both endpoints included)
- Why closed? Simplifies geometric operations (no `±1` adjustments in intersection/subtraction)

**External API**: `GridRange` (Google Sheets) uses half-open intervals `[start, end)` where end is excluded

- Conversion happens at boundaries via `createGridRangeAdapter()` in `packages/@jim/spandex/src/adapter/gridrange.ts`
- Adapter handles transformation: half-open `[start, end)` ⟷ closed `[start, end-1]`

### Package Exports

**@jim/spandex** - Core library (tree-shakable via subpath exports):

- **Main**: `@jim/spandex` - Types only (Rectangle, SpatialIndex, etc.)
- **Implementations**:
  - `@jim/spandex/index/mortonlinearscan` - Factory for Morton-based linear scan (O(n), best for n<100)
  - `@jim/spandex/index/rstartree` - Factory for R* tree (O(log n), best for n≥100)
  - `@jim/spandex/index/lazypartitionedindex` - Factory for multi-attribute wrapper
- **Adapters**:
  - `@jim/spandex/adapter/gridrange` - Google Sheets GridRange adapter (half-open intervals)
  - `@jim/spandex/adapter/a1` - A1 notation adapter (e.g., "A1:D5")
- **Utilities**:
  - `@jim/spandex/r` - Rectangle utilities and operations
  - `@jim/spandex/extent` - Extent calculations
  - `@jim/spandex/render` - Rendering utilities (types and base renderer)

**@jim/spandex-ascii** - ASCII visualization for terminal/markdown output (see `packages/@jim/spandex-ascii/README.md`)

**@jim/spandex-html** - HTML rendering with customizable styling (see `packages/@jim/spandex-html/README.md`)

### Implementation Families

**Active implementations**: See `packages/@jim/spandex/src/index/` directory for current production algorithms.

**Active implementations** (3 total in `packages/@jim/spandex/src/index/`):

- **MortonLinearScan** - O(n), best for n<100 (Morton curve spatial locality)
- **RStarTree** - O(log n), best for n≥100 (R* split algorithm)
- **LazyPartitionedIndex** - Multi-attribute wrapper (vertical partitioning with spatial join)

**For detailed algorithm selection, performance data, and usage examples**: See [PRODUCTION-GUIDE.md](./PRODUCTION-GUIDE.md) and [GETTING-STARTED.md](./docs/GETTING-STARTED.md)

**Archived implementations**: See `archive/IMPLEMENTATION-HISTORY.md` for complete list with git SHAs.

- **Storage**: Archived code removed from filesystem, exists only in git history
- **Access**: Use git commands to retrieve (`git show <SHA>:path/to/file.ts`)
- **Documentation**: Experiment writeups preserved in `archive/docs/experiments/`
- **Types**: 7 superseded implementations, 2 failed experiments

All active implementations are auto-discovered by benchmarks from `packages/@jim/spandex/src/index/`.

### Testing Framework

**Conformance tests** (packages/@local/spandex-testing/src/axiom/):

- Core axioms validate mathematical correctness (empty state, LWW semantics, overlap resolution, disjointness, fragment counts)
- Modular axiom files: `properties.ts`, `geometry.ts`, `visual.ts`, `canonical-values.ts`, `cross-implementation.ts`
- ASCII snapshot tests validate visual rendering and round-trip parsing
- Every implementation must pass all conformance tests

**Adversarial tests** (run via `deno task test:adversarial`):

- Pathological patterns to validate O(n) fragmentation bound
- Concentric, diagonal, checkerboard, random patterns
- Validates geometric bounds under worst-case inputs

**Fragment Count Verification** (packages/@local/spandex-testing/src/axiom/canonical-values.ts):

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

1. Create `packages/@jim/spandex/src/index/newimpl.ts` implementing `SpatialIndex<T>`
2. Create test files in `packages/@jim/spandex/test/index/newimpl/`:
   ```typescript
   // property.test.ts
   import createNewImplIndex from '@jim/spandex/index/newimpl';
   import { testPropertyAxioms } from '@local/spandex-testing/axiom';

   Deno.test('NewImpl - Property Axioms', async (t) => {
   	await testPropertyAxioms(t, createNewImplIndex);
   });

   // geometry.test.ts
   import createNewImplIndex from '@jim/spandex/index/newimpl';
   import { asciiStringCodec, createFixtureGroup } from '@local/snapmark';
   import { testGeometryAxioms } from '@local/spandex-testing/axiom';

   Deno.test('NewImpl - Geometry Axioms', async (t) => {
   	const { assertMatch, flush } = createFixtureGroup(asciiStringCodec(), {
   		context: t,
   		filePath: new URL('../fixtures/geometry-test.md', import.meta.url),
   	});

   	await testGeometryAxioms(t, createNewImplIndex, assertMatch);

   	await flush();
   });

   // visual.test.ts - similar pattern
   ```
3. Generate fixtures on first run:
   ```bash
   UPDATE_FIXTURES=1 deno test -A packages/@jim/spandex/test/index/newimpl/
   # Or for existing implementations:
   UPDATE_FIXTURES=1 deno task test:morton
   UPDATE_FIXTURES=1 deno task test:rstartree
   ```
4. During development:
   ```bash
   deno task test && deno task check
   deno task bench:update  # Quick feedback (~2 min)
   ```
5. Before completing/committing:
   ```bash
   deno task bench:analyze 5 docs/analyses/benchmark-statistics.md  # Final stats (~30 min)
   ```
6. Benchmarks auto-discover from `packages/@jim/spandex/src/index/`

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

This documents the implementation in `archive/IMPLEMENTATION-HISTORY.md`, deletes the code, and verifies type-checking. Manual archiving:

1. Document in `archive/IMPLEMENTATION-HISTORY.md` with:
   - Current git SHA (where implementation last existed)
   - Performance stats (win rate, relative performance)
   - Reason for archiving (superseded by what, or why it failed)
   - Analysis document reference
2. Delete `packages/@jim/spandex/src/index/X.ts`
3. Delete `packages/@jim/spandex/test/index/X/`
4. Run `deno task bench:update` to regenerate BENCHMARKS.md
5. Run `deno task check` to verify no broken imports

Benchmarks automatically exclude archived implementations (based on filesystem location). Archived code is retrievable via git history using the documented SHA.

### Experiment Workflow (MANDATORY)

**See [docs/active/README.md](./docs/active/README.md) for the complete experiment workflow.**

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
2. **Implement**: Create `packages/@jim/spandex/src/index/[name].ts` + test files in `packages/@jim/spandex/test/index/[name]/` + add to benchmarks
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

```
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
- ✅ **GOOD**: Describe algorithm families and optimization strategies, point to `packages/@jim/spandex/src/index/`
- ❌ **BAD**: "MortonLinearScanImpl is the production implementation"
- ✅ **GOOD**: "Spatial locality optimization is the production approach"

**When to use specific implementation names**:

| Context                               | Use Names? | Example                                                                         |
| ------------------------------------- | ---------- | ------------------------------------------------------------------------------- |
| Analysis files (`docs/analyses/*.md`) | ✅ Yes     | "MortonLinearScanImpl achieved 6.9µs"                                           |
| Example code                          | ✅ Yes     | `import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan'` |
| Operational guides                    | ✅ Yes     | Show what to import in PRODUCTION-GUIDE sections                                |
| Diagram files                         | ✅ Yes     | Explain specific algorithm details                                              |
| Structural docs (README, summaries)   | ❌ No      | "Spatial locality optimization" not "MortonLinearScanImpl"                      |
| Decision tables                       | ❌ No      | Use algorithm approaches, not class names                                       |

**Why this matters**: When implementations are added/removed/renamed, only `packages/@jim/spandex/src/index/` and generated files need updating. Documentation stays valid without edits.

**Source of truth**: `packages/@jim/spandex/src/index/` directory = current active implementations

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

**Why this matters**: Internal representation should be whatever is most performant (fewer branches, better symmetry).

**Boundary conversion pattern**: `Input → [convert] → Internal (optimized) → [convert] → Output`

**Constraint rule**: Don't impose semantic constraints internally unless they provide performance/correctness benefit.

**Examples in codebase**:

- ✅ __R_-tree_*: Uses `NEG_INF/POS_INF` constants instead of `Infinity` (works with TypedArrays, symmetric)
- ✅ **MortonLinearScan**: Uses `MAX_COORD = 65535 (0xFFFF)` constant (avoids `Infinity` checks in hot paths)

**See**: docs/active/semantic-vs-performance-principle.md for detailed rationale and optimization opportunities.

### Interval Semantics

**Critical**: Core library uses **closed intervals** `[min, max]`, adapter layer uses **half-open intervals** `[start, end)`.

- Core `Rectangle`: `[0, 0, 4, 4]` includes point (4,4)
- Adapter `GridRange`: `endRowIndex: 5` means rows 0-4 (5 is excluded)

**Why this matters**: Adapters convert at API boundaries. Internal algorithms use closed intervals for simpler geometry (no `±1` adjustments).

**For detailed explanation**: See [docs/diagrams/coordinate-system.md](./docs/diagrams/coordinate-system.md)

### Rectangle Decomposition

**Core algorithm**: Insert with overlap → Decompose existing rectangle into ≤4 non-overlapping fragments + store new rectangle (last-writer-wins).

**Invariant**: No two rectangles ever overlap (disjointness maintained after every operation).

**For visual explanation and examples**: See [docs/RECTANGLE-DECOMPOSITION-PRIMER.md](./docs/RECTANGLE-DECOMPOSITION-PRIMER.md)

### Space-Filling Curve Optimization

**Current approach**: Morton curve (Z-order) via bit interleaving for spatial locality in linear scan.

**Key insight**: 25% faster than Hilbert curve (constant-time encoding vs iterative).

**Limitation**: MAX_COORD = 65,535 (0xFFFF) - coordinates >65K wrap but geometry stays correct.

**For full experimental analysis**: See [docs/analyses/morton-vs-hilbert-analysis.md](./docs/analyses/morton-vs-hilbert-analysis.md)

### Performance Guidelines

**Quick decision**:
- n < 100 → Use MortonLinearScan
- n ≥ 100 → Use RStarTree
- Multi-attribute data → Use LazyPartitionedIndex

**For detailed decision tree, workload-specific thresholds, and performance data**: See [PRODUCTION-GUIDE.md](./PRODUCTION-GUIDE.md) and [BENCHMARKS.md](./BENCHMARKS.md)

**For statistical methodology and interpreting benchmark results**: See [docs/analyses/benchmark-statistics.md](./docs/analyses/benchmark-statistics.md)

## Code Conventions

**See [CONTRIBUTING.md](./CONTRIBUTING.md) for code style guidelines.**

**Key requirements**:

- No `any` types in source code
- All implementations must `implements SpatialIndex<T>`
- All public APIs need JSDoc comments
- Use subpath imports for tree-shaking

---

## Documentation Writing Style

**Key principle**: Lead with conclusions, front-load information, use high-density formats (tables/bullets), write imperatively.

**Philosophy**: Technical precision without unnecessary complexity. Write for the informed reader who values their time.

### Tone & Voice

**Technical Documentation** (README, PRODUCTION-GUIDE):

- Direct, imperative voice ("Use X", "Run Y")
- Assume reader knows basic CS concepts
- Provide examples, not lengthy explanations
- Front-load key information (what/why before how)

**Research Documentation** (docs/analyses/):

- Present tense for active research ("Morton provides...", not "Morton provided...")
- Past tense only for completed/archived experiments
- Empirical: "Measured X" vs Theoretical: "Expected Y"
- Always distinguish observation from inference

**Architecture Documentation** (CLAUDE.md, docs/core/):

- Descriptive of patterns, not instances
- "Use linear scan for sparse data" not "MortonLinearScanImpl is best"
- Process-oriented: HOW to decide, not WHAT to choose

### Structure Patterns

**Decision Documentation**:

```markdown
✅ Good:

## When to Use X

- Condition 1 → Use X
- Condition 2 → Use Y

❌ Bad:

## Our Choice

We chose X because...
```

**Algorithm Documentation**:

```markdown
✅ Good:
**Complexity**: O(n)
**Best for**: n < 100
**Trade-off**: Simple but quadratic worst-case

❌ Bad:
The algorithm runs in O(n) time complexity, which means...
```

**Example Code**:

```markdown
✅ Good:
// Concrete, runnable
import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
const index = createMortonLinearScanIndex<string>();

❌ Bad:
// Abstract, theoretical
const index = createSomeIndex<T>();
```

### Information Density

**High density** (lists, tables, code):

- Use bullet points for parallel facts
- Use tables for comparisons
- Use code blocks for concrete examples

**Low density** (explanations):

- One idea per paragraph
- Lead with conclusion ("X is faster. Here's why...")
- Use bold for scanning (**Key insight**: ...)

### Academic Rigor

**Always include**:

- Complexity claims: O(n), O(log n)
- Empirical data: "2x faster" with conditions
- Citations: (Beckmann 1990), (Guttman 1984)

**Always distinguish**:

- Measured: "Morton is 2x faster at n=50"
- Theoretical: "Morton should provide better locality"
- Hypothesis: "We expect X to outperform Y"

### Common Patterns

**Introducing concepts**:

```
Problem → Solution → Trade-offs → When to use
```

**Reporting findings**:

```
Hypothesis → Method → Data → Conclusion → Impact
```

**Comparing options**:

```
Use table with: Feature | Option A | Option B | Winner
```

---

## Markdown Technical Standards

**Syntax**: [Google Markdown Style Guide](https://google.github.io/styleguide/docguide/style.html) + [CommonMark](https://commonmark.org/)

### Critical Syntax Rules for This Repo

**1. Algorithm names with special characters:**

```markdown
✅ R* split (SAFE - asterisk followed by space)
✅ R*-tree (SAFE - asterisk followed by hyphen)
✅ `R*` tree (inline code - always safe)
❌ **R*** (BROKEN - deno fmt converts to __R_ _, renders as italic)
❌ __R_ split_* (BROKEN - deno fmt converts to __R_ split__, renders as italic)
✅ **R\* split** (WORKS - but prefer plain R* instead)
✅ R* split (BEST - plain text, no bold needed)
```

**Rule**: Plain `R*` followed by space/punctuation/end is ALWAYS safe and preferred. NEVER bold `R*` because `deno fmt` converts `**R*` to `__R_` which renders incorrectly.

**Why `**R***` breaks**: Ambiguous parse - different markdown renderers interpret the triple asterisk differently.

**2. Use ATX-style headers** (# syntax):

```markdown
## ✅ ## Heading❌ Heading
```

**3. Use fenced code blocks** with language tags:

````markdown
✅ ```typescript
const x = 1;
````

❌ ```
const x = 1;

```
```

**4. Escape underscores in math/algorithms:**

```markdown
❌ R_new (may render as italic if followed by another underscore)
✅ R\_new (escaped)
✅ `R_new` (code formatting for technical terms)
```

**5. Tables: Use consistent alignment:**

```markdown
| Left    | Center  |   Right |
| ------- | :-----: | ------: |
| Content | Content | Content |
```

**6. Lists: Use `-` for unordered, `1.` for ordered:**

```markdown
✅ - Item one

- Item two

✅ 1. First
2. Second

❌ * Item (use dash for lists to match repo style)
```

**7. Emphasis:**

```markdown
✅ _italic_ or _italic_
✅ **bold**
✅ _**bold italic**_
❌ Don't mix * and _ in same doc without reason
```

**8. Links: Prefer reference style for repeated URLs:**

```markdown
✅ [text][ref]
[ref]: https://example.com

✅ [text](https://example.com) (inline for one-offs)
```

**9. Line length: Aim for 120 characters** (matches code)

- Exception: Long URLs, code blocks, tables

**10. Horizontal rules: Use three dashes:**

```markdown
✅ ---
❌ ***
❌ ___
```

### Why These Rules

1. **Escaped characters** (`\*`, `\_`): Prevents auto-formatting from breaking algorithm names
2. **Inline code for technical terms**: When in doubt, use backticks for algorithm names, variables, types
3. **Consistency**: Same emphasis style throughout (prefer `**bold**` over `__bold__`)
4. **Readability**: Source must be readable (we edit markdown more than we render it)

### Quick Reference

| Element         | Style           | Example                      |
| --------------- | --------------- | ---------------------------- |
| Algorithm names | Plain or code   | `R*`, `O(log n)`, `` `R*` `` |
| Headings        | ATX             | `## Heading`                 |
| Bold            | Double asterisk | `**bold**`                   |
| Italic          | Single asterisk | `*italic*`                   |
| Code            | Backticks       | `` `code` ``                 |
| Lists           | Dash            | `- item`                     |
| Horizontal rule | Triple dash     | `---`                        |

### Validation

Run through markdown linter mentally:

- Do algorithm names render correctly? (R*, O(n))
- Are tables aligned?
- Are code blocks tagged with language?
- Is source readable without rendering?

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

**Retrieving archived implementations**:

```bash
# View archived implementation code
git show <SHA>:packages/@jim/spandex/src/index/X.ts

# Run benchmarks including archived implementations
deno task bench:archived  # or: deno task bench -- --include-archived

# Temporarily restore archived code for testing
git checkout <SHA> -- archive/
deno test archive/test/
git restore archive/  # Clean up when done
```

**Note**: Archived code exists only in git history. See `archive/IMPLEMENTATION-HISTORY.md` for git SHAs.

See archive/README.md for full archive philosophy and management.

## Quick Reference

### Common Scenarios

| Task                        | Commands                                                                                                                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Add new implementation**  | 1. Create `packages/@jim/spandex/src/index/name.ts` + test dir `packages/@jim/spandex/test/index/name/`<br>2. `deno task test && deno task bench:update && deno task check`                    |
| **Run experiment**          | 1. Create `docs/active/experiments/name-experiment.md`<br>2. Implement + test<br>3. `deno task bench:analyze 5 docs/active/experiments/name-results.md`<br>4. Resolve and clean `docs/active/` |
| **Archive implementation**  | `deno task archive:impl <name> <superseded\|failed-experiments>`                                                                                                                               |
| **Compare vs archived**     | `deno task bench:archived`                                                                                                                                                                     |
| **Focus on specific impls** | `deno task bench -- --exclude=X --exclude=Y`                                                                                                                                                   |
| **Validate adversarial**    | `deno task test:adversarial`                                                                                                                                                                   |
| **Statistical analysis**    | `deno task bench:analyze 5 output.md`                                                                                                                                                          |

### Directory Structure

```
packages/@jim/
├── spandex/              # Core spatial indexing
│   ├── src/
│   │   ├── index/        # Active implementations (mortonlinearscan, rstartree, lazypartitionedindex)
│   │   ├── adapter/      # GridRange and A1 notation adapters
│   │   ├── render/       # Rendering utilities
│   │   └── mod.ts        # Types-only export
│   └── test/             # Active tests
├── spandex-ascii/        # ASCII visualization
└── spandex-html/         # HTML rendering
packages/@local/
├── snapmark/             # Snapshot testing framework
├── spandex-testing/      # Testing utilities and axioms
└── spandex-telemetry/    # Telemetry collection (opt-in)
docs/
├── active/experiments/   # In-progress work (MUST be empty when done)
├── analyses/             # Validated findings
├── core/                 # Research summary + theory
└── diagrams/             # Visual explanations
archive/
├── IMPLEMENTATION-HISTORY.md  # All archived impls with git SHAs (code in git history only)
└── docs/                 # Experiment documentation and summaries
site/                     # Lume documentation site (publishes to GitHub Pages)
scripts/                  # Automation (update-benchmarks.ts, analyze-benchmarks.ts, sync-docs.ts)
benchmarks/               # Benchmark suites (performance.ts)
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
- Modified `packages/@jim/spandex/src/index/*.ts` → `deno task sync-docs`
- Added/removed test axioms in `packages/@local/spandex-testing/src/axiom/` → `deno task sync-docs`
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

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the complete pre-commit checklist.

## Key Documentation

### Quick Reference

- **README.md** - Project overview and quick start
- **docs/GETTING-STARTED.md** - Comprehensive tutorial for new users
- **PRODUCTION-GUIDE.md** - Decision tree for choosing implementations
- **docs/TROUBLESHOOTING.md** - Common issues and solutions
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
