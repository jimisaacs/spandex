# Active Research Workspace

**Purpose**: Temporary workspace for experiments in progress

**Rule**: When experiment concludes (validated or rejected), work moves out of `active/`.

---

## Current Experiments

_None currently active_

---

## Workflow

### Starting New Experiment

1. Create `active/experiments/[name]-experiment.md` with hypothesis
2. Implement in `packages/@jim/spandex/src/implementations/[name].ts` + tests + benchmarks
3. Run analysis: `./scripts/analyze-benchmarks.ts 5 active/experiments/[name]-analysis-results.md`
4. Update experiment doc with status (⚙️ → ✅ or ❌)

### Completing Experiment

**If ✅ VALIDATED**:

- Create `analyses/[name]-analysis.md` with findings
- Update `core/RESEARCH-SUMMARY.md`
- Keep implementation in codebase
- **Delete** `active/experiments/[name]-*.md` (findings now in `analyses/`)

**If ❌ REJECTED and moving on**:

- **Move** `active/experiments/[name]-*.md` → `../../archive/docs/experiments/`
- Remove implementation, tests, benchmarks
- Update exports, regenerate BENCHMARKS.md

**If ❌ REJECTED but might revisit**:

- Leave in `active/experiments/` with notes
- Keep implementation for future reference

---

## Why "active/"?

**Mental model**: This is your scratch pad. Everything else is permanent record.

- `core/` = Immutable reference (textbook knowledge)
- `analyses/` = Validated findings (success stories)
- `active/` = Work in progress (messy, evolving)
- `archive/` = Rejected experiments (learn from failures)

**Graduate student tip**: Clean workspace = clear thinking. When experiment is done, move it out. Keep `active/` focused on current work only.
