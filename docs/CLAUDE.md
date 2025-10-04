# Documentation Framework

**Purpose**: Maintain consistent, rigorous, scannable research documentation

---

## Directory Structure

```
docs/
├── README.md              # Navigation hub
├── core/                  # Foundational documents (immutable)
├── analyses/              # Validated research findings (stable)
├── active/                # WORKSPACE (work in progress)
│   └── experiments/       # Active experiments (hypothesis testing)
└── archive/               # Historical record (read-only)
    └── experiments/       # Rejected experiments (moved from active/)
```

**Principle**: Logical organization = physical organization

**Workspace Concept**: `active/` is where current work lives. Everything else is either foundational (`core/`), validated (`analyses/`), or historical (`archive/`).

**Archive Policy**: When experiment is rejected and we're moving on → Move `active/experiments/[name]` → `../archive/docs/experiments/[name]`, remove implementation code.

---

## Document Types & Tone

### core/ (Foundational, Neutral)

**Purpose**: Timeless foundation that rarely changes

**Tone**: Neutral, comprehensive, reference-quality

**Documents**:

- `RESEARCH-SUMMARY.md` - Executive summary, production recommendations, all findings
- `theoretical-foundation.md` - Mathematical proofs, algorithm correctness

**Style**:

```markdown
# Document Title

**Problem**: [one-line problem statement]
**Algorithm**: [one-line solution]
**Constraint**: [key limitation]

## Section

Neutral, comprehensive explanation...
```

### analyses/ (Findings, Past Tense)

**Purpose**: Specific research findings with empirical validation

**Tone**: Objective, data-first, past tense ("we found...")

**Naming**: `[topic]-analysis.md` (e.g., `sparse-data-analysis.md`)

**Style**:

```markdown
# [Topic] Analysis: [Key Finding]

**Finding**: [One sentence result]

## Result

| Metric | Value | Reason |
| ------ | ----- | ------ |
| ...    | ...   | ...    |

**Impact**: [How this changed our approach]

---

## Evidence

[Empirical data, benchmarks, measurements]
```

**Requirements**:

- Lead with finding, not methodology
- Tables for comparisons (scannable)
- Empirical data with units (µs, ms, not "faster")
- Past tense ("found", "measured", "validated")

### active/experiments/ (Hypothesis, Question Form)

**Purpose**: Document active experiments (work in progress)

**Tone**: Hypothesis-driven, question-first, updated as work progresses

**Naming**: `[name]-experiment.md` + `[name]-analysis-results.md`

**Location**: `active/` = workspace for current research

**Style**:

```markdown
# [Name] Experiment

**Status**: ✅ VALIDATED / ❌ REJECTED
**Hypothesis**: [One sentence claim]
**Result**: [One sentence outcome]

---

## Hypothesis

**Question**: [Research question]
[Detailed hypothesis with reasoning]

## Methodology

[How we tested it]

## Results

[What we found - link to *-analysis-results.md]
```

**Requirements**:

- Status badge at top (✅/❌)
- Question-first format
- Failed experiments are valuable (document them!)
- Results in separate `*-analysis-results.md` (auto-generated)

### ../archive/docs/experiments/ (Rejected Experiments)

**Purpose**: Historical record of rejected experiments

**Tone**: Same as experiments/ - hypothesis-driven, full analysis preserved

**Naming**: Same as experiments/ - `[name]-experiment.md` + `[name]-analysis-results.md`

**Archive Criteria**:

- ❌ Hypothesis definitively rejected (not "needs more work")
- ❌ No plans to revisit (except for inspiration)
- ✅ Implementation removed from codebase
- ✅ Full experiment docs preserved (moved, not rewritten)

**When to Archive**:

1. Experiment fails conclusively → Document in `active/experiments/` with full analysis
2. Decision made: won't pursue further → Archive time!
3. **Move** experiment docs: `active/experiments/[name]-*.md` → `../../archive/docs/experiments/`
4. Remove implementation code, test files, benchmark entries
5. Update exports and regenerate `BENCHMARKS.md`
6. Update navigation in `docs/README.md`

**Workspace Concept**: `active/` = ephemeral workspace. When done (validated or rejected), work moves out.

**CRITICAL RULE**: `active/experiments/` directory should be **EMPTY** after experiment completion:

- ✅ VALIDATED → Findings go to `analyses/`, remove from `active/`
- ❌ REJECTED → Full docs move to `../../archive/docs/experiments/`, remove from `active/`
- 🔬 IN PROGRESS → Keep in `active/experiments/` only

**WHY**: `active/` is a workspace, not storage. Clean workspace = clear research state.

---

## Content Principles

### 1. Data Over Prose

❌ **Bad**: "It's much faster"
✅ **Good**: "11.5µs vs 19.8µs (1.7x faster)"

❌ **Bad**: "The algorithm is very efficient"
✅ **Good**: "O(n) for n<100 achieves 0.01ms"

### 2. Tables Over Paragraphs

Use tables for:

- Comparisons (A vs B)
- Results (metric, value, reason)
- Algorithms (name, complexity, use case)

**Format**:

```markdown
| Column A | Column B | Column C |
| -------- | -------- | -------- |
| Value    | Value    | Value    |
```

### 3. Scannable Structure

```markdown
# Title

**TL;DR**: One sentence summary

## Section 1

- Bullet points for quick scanning
- Tables for comparisons
- Code blocks for examples

---

## Section 2

Next topic...
```

### 4. Empirical > Theoretical

Every claim must be backed by:

- Benchmark data (mean ± stddev, CV%)
- Test results (pass/fail counts)
- Code examples (runnable)

❌ "Should be faster"
✅ "Measured 2.3x faster (2.0ms vs 4.6ms, n=5 runs, CV=1.2%)"

### 5. One Fact, One Place

Avoid redundancy:

- Link between docs instead of copying
- DRY principle applies to documentation
- Update RESEARCH-SUMMARY.md when adding findings

---

## Writing Guidelines

### Conciseness

**Target**: 40-60% reduction from prose to tables/bullets

Before (verbose):

```markdown
The algorithm works by first checking if the data is sparse,
and if it is sparse then we use a linear scan approach which
has been shown through testing to be faster than the R-tree
approach when the number of elements is less than 100.
```

After (concise):

```markdown
**Finding**: Linear scan beats R-tree for n<100 (11.5µs vs 19.8µs)
```

### Hierarchy

```markdown
# Title (one per document)

## Major Section

### Subsection

**Bold** for emphasis
_Italic_ for technical terms on first use
`Code` for identifiers
```

### Cross-References

```markdown
**See**: [sparse-data-analysis.md](./sparse-data-analysis.md)
**See also**: [../core/theoretical-foundation.md](../core/theoretical-foundation.md)
**Details**: [BENCHMARKS](../../BENCHMARKS.md)
```

### Code Examples

```typescript
// ✅ Good: Runnable, complete, realistic
const index = new OptimizedLinearScanImpl<string>();
index.insert({ startRowIndex: 0, endRowIndex: 10 }, 'red');
```

```typescript
// ❌ Bad: Pseudocode, incomplete, unrealistic
algorithm.do_thing(data);
```

---

## Maintenance Rules

### Auto-Generated (NEVER edit manually)

- `../../BENCHMARKS.md` - via `deno task bench:update`
- `active/experiments/*-analysis-results.md` - via `./scripts/analyze-benchmarks.ts 5 output.md`

**If you edit these**: Your changes will be overwritten on next run.

### Workspace (active development)

- `active/experiments/*` - Current experiments (move when done)

### Living Documents (update as research evolves)

- `core/RESEARCH-SUMMARY.md` - Add new findings, update recommendations
- `README.md` - Add new documents to navigation

### Stable Documents (rarely change)

- `core/theoretical-foundation.md` - Core math doesn't change
- `analyses/*` - Individual findings are historical records

### Archived (read-only)

- `../archive/docs/experiments/*` - Rejected experiments (moved from active/)

---

## Quality Checklist

Before committing documentation:

- [ ] **Scannable**: Can reader find answer in <30 seconds?
- [ ] **Empirical**: All claims backed by data?
- [ ] **Concise**: Could this be a table instead of prose?
- [ ] **Consistent**: Tone matches directory (core/analyses/experiments)?
- [ ] **Cross-referenced**: Links to related docs?
- [ ] **No redundancy**: Is this the only place this fact appears?
- [ ] **Formatted**: Tables aligned, code blocks have language tags?

---

## Examples

### Good Analysis Document

```markdown
# Sparse Data Analysis: Why Linear Scan Wins

**Finding**: Linear scan O(n) beats R-tree O(log n) for n<100

## Result

| n     | Winner      | Time   | Speedup |
| ----- | ----------- | ------ | ------- |
| <100  | Linear scan | 11.5µs | 1.7x    |
| >1000 | R-tree      | 2.0ms  | 15x     |

**Impact**: Changed from "always R-tree" to "linear scan for sparse"

## Evidence

[Detailed benchmarks with statistical rigor]
```

### Good Experiment Document

```markdown
# FastRTree Experiment

**Status**: ❌ REJECTED (1.29x slower)
**Hypothesis**: R* axis + midpoint = quality without cost
**Result**: Cost without benefit

## Hypothesis

**Question**: Can we get R* quality without R* cost?
[Detailed reasoning]

## Results

See [fastrtree-analysis-results.md](./fastrtree-analysis-results.md)
```

---

## When to Create New Documents

### Create new analysis/ doc when:

- ✅ You have a specific, validated finding
- ✅ It's not already covered in existing analyses
- ✅ You have empirical data to support it

### Create new experiment/ doc when:

- ✅ You're testing a hypothesis
- ✅ It's worth documenting (even if it fails)
- ✅ You have methodology + results

### Update core/RESEARCH-SUMMARY.md when:

- ✅ New finding changes recommendations
- ✅ New implementation added
- ✅ Key insight emerged

### DON'T create doc when:

- ❌ It's a minor clarification (edit existing doc)
- ❌ It's redundant with existing content (link instead)
- ❌ It's work-in-progress (use comments/issues)

---

## Research Workflow

### Full Experimental Cycle

1. **Hypothesis** → Create `active/experiments/[name]-experiment.md`
2. **Implementation** → Code in `src/implementations/`, tests, benchmarks
3. **Testing** → `deno task test` (axiom-based conformance)
4. **Benchmarking** → `./scripts/analyze-benchmarks.ts 5 active/experiments/[name]-analysis-results.md`
5. **Analysis** → Review generated results in `active/experiments/`
6. **Validation/Rejection** → Update experiment doc with status

**If ✅ VALIDATED**:
7. **Documentation** → Create `analyses/[name]-analysis.md` with findings
8. **Integration** → Update `core/RESEARCH-SUMMARY.md` with finding
9. **Code updates** → Keep implementation, update headers/docs
10. **Cleanup workspace** → Delete `active/experiments/[name]-*.md` (findings now in `analyses/`)

**If ❌ REJECTED**:
7. **Archive Decision** → Will we revisit? Or move on?

**If needs more work (might revisit)**:
8. Leave in `active/experiments/` with notes

**If moving on (no plans to revisit)**:
8. **Archive** → Move `active/experiments/[name]-*.md` → `../../archive/docs/experiments/`
9. **Cleanup code** → Remove implementation, tests, benchmark entries
10. **Update** → Regenerate benchmarks, update navigation

### Archiving Checklist

Before archiving a rejected experiment:

- [ ] Hypothesis definitively rejected (not "needs more work")
- [ ] No compelling reason to revisit (except for inspiration)
- [ ] Full experiment doc exists in `active/experiments/` with analysis
- [ ] **Move** `active/experiments/[name]-*.md` → `../../archive/docs/experiments/`
- [ ] Remove implementation from `src/implementations/[name].ts`
- [ ] Remove test file `test/[name].test.ts`
- [ ] Remove benchmark entry from `benchmarks/performance.ts`
- [ ] Remove export from `src/mod.ts`
- [ ] Remove test task from `deno.json`
- [ ] Regenerate `BENCHMARKS.md` via `deno task bench:update`
- [ ] Update `docs/README.md` navigation (remove from active, add to archive)

**Philosophy**:

- `active/` = ephemeral workspace (experiments in flight)
- `analyses/` = validated findings (permanent)
- `archive/` = rejected experiments (historical record)

---

## Tone Examples

### core/ (Neutral, Foundational)

```
"The algorithm maintains non-overlapping rectangles through
geometric set difference, generating at most 4 fragments per operation."
```

### analyses/ (Objective, Past Tense)

```
"We found linear scan outperforms R-tree for n<100 by 1.7x
(11.5µs vs 19.8µs, 5-run mean ± 0.3µs stddev)."
```

### active/experiments/ (Hypothesis, Question)

```
"Can axis selection alone provide 80% of R*'s quality benefit?
We hypothesized that the O(m log m) cost would be justified..."
[Status: ⚙️ IN PROGRESS / ✅ VALIDATED / ❌ REJECTED]
```

### ../archive/docs/experiments/ (Same format, moved from active/)

```
[Full experiment docs preserved - same format as active/experiments/]
[Status always: ❌ REJECTED]
[Documents are moved, not rewritten]
```

---

**Remember**: This framework ensures rigor without verbosity, transparency without redundancy, and accessibility without sacrificing depth.
