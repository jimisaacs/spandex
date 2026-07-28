---
name: experiment
description: >-
    Use when running a spatial-indexing research experiment end to end: forming a
    hypothesis, implementing a candidate algorithm, benchmarking it with
    statistical rigor, documenting findings, and resolving it into the archive or
    into production. Skip for ordinary implementation work with no hypothesis
    behind it, which is the work skill.
---

# spandex — Experiment Skill

An experiment starts with a question the benchmarks can answer and ends with a
clean workspace. Both ends matter: an experiment with no stated hypothesis
cannot be wrong, and one that never leaves `docs/active/` hides the research
state from everyone after you.

Read [research-integrity](../../rules/research-integrity.md) first. It owns the
vocabulary this skill uses.

## 1. State the hypothesis

Create `docs/active/experiments/[name]-experiment.md` before writing code:

```markdown
# [Name] Experiment

## Hypothesis

[What you expect to find, stated so it could turn out false]

## Motivation

[Why this matters — which workload, which current weakness]

## Approach

[How you'll test it]

## Success Criteria

[The number or behavior that decides it, chosen now rather than after the data]
```

Choosing the success criteria before the data is what stops a marginal result
from being narrated into a win.

## 2. Implement

Create `packages/@jim/spandex/src/index/[name].ts` implementing
`SpatialIndex<T>`, and the test directory
`packages/@jim/spandex/test/index/[name]/` with the property, geometry, and
visual conformance files. The shapes are in
[IMPLEMENTATION-LIFECYCLE](../../../docs/IMPLEMENTATION-LIFECYCLE.md); the
authority behind each is in [tests](../../rules/tests.md).

Generate fixtures on first run, then read the diff:

```sh
UPDATE_FIXTURES=1 deno test -A packages/@jim/spandex/test/index/[name]/
```

Benchmarks discover the implementation from the directory, so there is nothing
to register.

## 3. Iterate

```sh
deno task test && deno task check
deno task bench:update     # ~2 min, fast feedback
```

Stay on `bench:update` while the design is still moving. Statistical analysis on
a shape you are about to change is half an hour spent measuring the wrong thing.

## 4. Measure for the record

Once the design is settled:

```sh
deno task bench:analyze 5 docs/analyses/benchmark-statistics.md
```

Five runs minimum. It takes about thirty minutes, so run it in the background
and watch the log. It overwrites `benchmark-statistics.md` deliberately — do not
create an experiment-specific stats file.

## 5. Document the findings

Write `docs/analyses/[name]-analysis.md`:

```
Hypothesis → Method → Data → Conclusion → Impact
```

Separate what you measured from what you think caused it. A measured number
carries its conditions; a mechanism is labelled as a mechanism until an
experiment has ruled the alternatives out.

## 6. Resolve

**Validated:** update `docs/core/RESEARCH-SUMMARY.md`, keep the implementation
active, delete the experiment doc.

**Rejected, moving on:** move the experiment doc to
`archive/docs/experiments/`, then
`deno task archive:impl [name] failed-experiments`. The archive entry records
the performance data, why it failed, and the analysis pointer — that record is
the entire value of the negative result.

**Rejected, might revisit:** leave the doc in `docs/active/experiments/` with a
note saying why it is parked and what would restart it.

## 7. Clean the workspace

```sh
ls docs/active/experiments/     # only in-progress work may remain
deno task sync-docs
deno task bench:update
deno task hooks:pre-commit
deno task meta-check
```

## Done means

The hypothesis is answered either way, both benchmark documents are current, the
findings are in `docs/analyses/`, `RESEARCH-SUMMARY.md` reflects the outcome,
and `docs/active/experiments/` contains nothing that is finished.
