# Active Research Workspace

`docs/active/experiments/` holds experiments that are in progress right now, and
nothing else. It is empty between experiments, and that emptiness is the point:
anyone can see the current research state at a glance, because everything in the
directory is live work.

Completed work leaves. Findings go to `docs/analyses/`, rejected approaches go
to `archive/`, and the experiment document itself is deleted once its outcome is
recorded somewhere permanent. Think of this directory as a scratch pad and
everything around it as the record.

## 1. State the hypothesis

Create `experiments/[name]-experiment.md` before writing code:

```markdown
# [Name] Experiment

## Hypothesis

[What you expect to find, stated so it could turn out false]

## Motivation

[Why this matters — which workload, which current weakness]

## Approach

[How you'll test it]

## Success Criteria

[The number or behavior that decides it]
```

Choosing the success criteria now, rather than after seeing the data, is what
keeps a marginal result from being narrated into a win.

## 2. Implement and iterate

Create the implementation at `packages/@jim/spandex/src/index/[name].ts` and its
tests under `packages/@jim/spandex/test/index/[name]/`, then generate fixtures
with `UPDATE_FIXTURES=1 deno test -A` and read the resulting diff.

While the design is still moving, stay on quick feedback:

```bash
deno task bench:update   # ~16 min
```

Running the full statistical analysis on a shape you are about to change is half
an hour spent measuring the wrong thing.

## 3. Measure for the record

Once the design has settled:

```bash
deno task bench:analyze 5 docs/analyses/benchmark-statistics.md   # ~80 min
```

Five runs is the minimum for a claim that lands in an analysis document; three
is a quick validation. The command overwrites `benchmark-statistics.md` on
purpose. That file answers "how do the current implementations perform", there
is only one current answer, and the data it holds is the same shape for every
experiment. Do not create a per-experiment variant of it.

## 4. Document the findings

Write `docs/analyses/[name]-analysis.md` following the arc from hypothesis
through method and data to conclusion and impact:

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

Keep what you measured separate from what you think caused it. A measured number
carries its conditions: which scenario, what n, how many runs, what CV%. A
proposed mechanism stays labelled as a proposal until an experiment rules the
alternatives out.

## 5. Resolve and clean up

Mark the experiment document validated or rejected, then take one of three
paths:

| Outcome                 | What happens                                                                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Validated               | Update `docs/core/RESEARCH-SUMMARY.md`, keep the implementation active, delete the experiment document                                          |
| Rejected, moving on     | Move the document to `archive/docs/experiments/` and archive the implementation, per [IMPLEMENTATION-LIFECYCLE](../IMPLEMENTATION-LIFECYCLE.md) |
| Rejected, might revisit | Leave it here with a note saying why it is parked and what would restart it                                                                     |

Before you call the experiment done, check that both benchmark documents are
current, that the findings are in `docs/analyses/[name]-analysis.md`, that
`RESEARCH-SUMMARY.md` reflects the outcome, and that
`ls docs/active/experiments/` shows only work still in progress.

## Starting the next one

New experiments tend to come from three places: a use case the current
implementations handle badly, a change in the platform such as WASM becoming
practical, or an untried idea. Check `archive/` before the third one. Someone
may have tried it already, and the record of why it failed is the reason that
archive exists.

## See Also

- [RESEARCH-SUMMARY](../core/RESEARCH-SUMMARY.md) — current validated findings
- [IMPLEMENTATION-LIFECYCLE](../IMPLEMENTATION-LIFECYCLE.md) — managing implementations
- [BENCHMARK-FRAMEWORK](../BENCHMARK-FRAMEWORK.md) — benchmarking workflows
