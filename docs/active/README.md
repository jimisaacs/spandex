# Active Research Workspace

**CRITICAL RULE**: `docs/active/experiments/` must be **EMPTY** after experiment completion.

This directory is for experiments currently in progress. An empty workspace = clear research state.

## Experiment Lifecycle

### 1. Start Experiment

Create `experiments/[name]-experiment.md` with hypothesis:

```markdown
# [Name] Experiment

## Hypothesis

[What you expect to find]

## Motivation

[Why this matters]

## Approach

[How you'll test it]

## Success Criteria

[How you'll know if it worked]
```

### 2. Implement

- Create `packages/@jim/spandex/src/index/[name].ts`
- Add test files in `packages/@jim/spandex/test/index/[name]/`
- Generate fixtures: `UPDATE_FIXTURES=1 deno test -A`

### 3. Iterate with Quick Benchmarks

```bash
deno task bench:update  # Quick feedback (~2 min)
```

### 4. Run Full Statistical Analysis (Before Completing)

```bash
deno task bench:analyze 5 docs/analyses/benchmark-statistics.md  # ~30 min
```

**CRITICAL**: Always outputs to `benchmark-statistics.md` (OVERWRITES, don't create experiment-specific files).

The data is generic (win rates, CV%, scenarios) - same structure for all experiments.

### 5. Document Findings

Create `docs/analyses/[name]-analysis.md`:

```markdown
# [Name] Analysis

**Finding**: [Key result]

**Impact**: [What changed]

---

## Hypothesis

[What you expected]

## Methodology

[How you tested]

## Results

[Data table]

## Conclusion

[What this means]
```

### 6. Update Status

Mark experiment doc with:

- ✅ **VALIDATED** - Hypothesis confirmed
- ❌ **REJECTED** - Hypothesis disproven

### 7. Resolution

**✅ VALIDATED**:

- Update `docs/core/RESEARCH-SUMMARY.md`
- Keep implementation active
- **DELETE experiment doc from `active/experiments/`**

**❌ REJECTED (moving on)**:

- Move experiment doc to `archive/docs/experiments/`
- Archive implementation (see [IMPLEMENTATION-LIFECYCLE](../IMPLEMENTATION-LIFECYCLE.md))
- **DELETE from `active/experiments/`**

**❌ REJECTED (might revisit)**:

- Leave in `active/experiments/` with notes
- Mark clearly: "ON HOLD - [reason]"

### 8. Clean Workspace

**CRITICAL**: **DELETE completed experiments from `docs/active/experiments/`**

Before ending any experiment, verify:

- [ ] **Both benchmark docs are current**:
  - [ ] `BENCHMARKS.md` updated (via `bench:update`)
  - [ ] `docs/analyses/benchmark-statistics.md` updated (via `bench:analyze`)
- [ ] Findings documented in `[name]-analysis.md`
- [ ] Summary updated in `RESEARCH-SUMMARY.md`
- [ ] Experiment files removed from `docs/active/experiments/`
- [ ] `ls docs/active/experiments/` shows ONLY in-progress work

## File Naming Convention

Prevents confusion:

- `docs/analyses/benchmark-statistics.md` - Statistical validation (ALWAYS this filename, always overwrite)
- `docs/analyses/[name]-analysis.md` - Experiment narrative (hypothesis, methodology, findings)
- `docs/active/experiments/[name]-experiment.md` - Work-in-progress tracking (**DELETE when done**)

## Example Workflow

```bash
# WRONG - Completed experiments still in active/
docs/active/experiments/
├── experiment-1.md (COMPLETED) ❌
├── experiment-1-results.md ❌
├── experiment-2.md (IN PROGRESS)

# CORRECT - Only active work
docs/active/experiments/
└── experiment-2.md (IN PROGRESS) ✅

# Completed work properly archived
docs/analyses/experiment-1-analysis.md ✅
archive/docs/experiments/failed-experiment-1.md ✅
```

## Why Keep It Empty?

An empty `active/experiments/` directory means:

- All research questions have been answered (for now)
- Clean workspace ready for next experiment
- Clear distinction between in-progress and completed work

**Mental model**: `docs/active/` is your scratch pad (work in progress), everything else is permanent record.

New experiments will be added when:

- New use cases emerge that existing implementations don't handle well
- Technology changes (e.g., WASM becomes practical, new JS engine optimizations)
- Someone has a promising idea that hasn't been tried yet (check `archive/` first!)

## See Also

- [RESEARCH-SUMMARY.md](../core/RESEARCH-SUMMARY.md) - Current validated findings
- [IMPLEMENTATION-LIFECYCLE.md](../IMPLEMENTATION-LIFECYCLE.md) - Managing implementations
- [BENCHMARK-FRAMEWORK.md](../BENCHMARK-FRAMEWORK.md) - Benchmarking workflows
