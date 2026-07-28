---
description: 'Measured versus hypothesized, archive as a research asset, current-state prose.'
globs: docs/**/*.md, archive/**/*.md, packages/@jim/spandex/src/index/*.ts, benchmarks/**/*.ts
---

# spandex — Research Integrity

This is an active research project. The rules below keep its record honest: what
was measured, what was guessed, and what is still open.

## Measured, Hypothesized, Expected

Three different claims, three different words. Never let one wear another's
clothes.

| Claim         | Means                                        | Example                                               |
| ------------- | -------------------------------------------- | ----------------------------------------------------- |
| **Measured**  | An experiment produced this number           | "Morton is 25% faster than Hilbert at n=50"           |
| **Mechanism** | Why we believe it happened, not yet isolated | "We attribute this to constant-time encoding"         |
| **Expected**  | A prediction no experiment has tested yet    | "We expect the crossover to move with rectangle size" |

A measured claim carries its conditions: which scenario, what n, how many runs,
what CV%. A number without conditions is not a measurement, it is a memory.

A mechanism is the easiest thing to overstate, because the number is real and
the story is plausible. "Morton is faster **because** of cache locality" claims
an isolated cause. "Morton is faster; the likely mechanism is cheaper encoding"
claims what the data supports. Prefer the second unless an experiment ruled the
alternatives out.

## Prose Tense

- Present tense for active work: "Morton provides spatial locality."
- Past tense only for completed and archived experiments: "The Hilbert variant
  reached parity on dense scenarios but cost more per insert."
- Avoid "completed", "final", "finished" in `docs/active/` and living-state
  docs. Findings are current understanding, not conclusions.

Keep transition narrative out of first-read surfaces. Scrub "formerly",
"previously", "renamed from", "originally", and "during the transition" — the
current shape is the fact, and the history is in `git log` and in the archive.
Where something is missing, state the present boundary ("multi-attribute queries
have no tree-backed implementation") rather than narrating a roadmap ("we will
later add...").

## The Workspace Invariant

`docs/active/experiments/` is a workspace, not storage, and it is **empty**
between experiments. An empty workspace means the research state is legible at a
glance: everything in it is in progress right now.

Completed work leaves in one of two directions:

- **Validated** → findings to `docs/analyses/[name]-analysis.md`, summary line
  to `docs/core/RESEARCH-SUMMARY.md`, implementation stays active, experiment
  doc deleted.
- **Rejected** → experiment doc moves to `archive/docs/experiments/`,
  implementation archived via `deno task archive:impl`.

An experiment you might revisit may stay, but it stays with a note saying so.
The procedure is in the [experiment skill](../skills/experiment/SKILL.md).

## Statistics Belong In One File

`docs/analyses/benchmark-statistics.md` holds the statistical validation of the
current active implementations. It is generic — win rates, CV%, per-scenario
breakdowns — so every experiment overwrites it rather than forking a variant.
Experiment-specific narrative lives in `docs/analyses/[name]-analysis.md`
alongside it.

Do not create `benchmark-statistics-morton.md`. The stats file answers "how do
the current implementations perform", and there is only ever one current answer.

Diagnosing is not recording. A local run to see whether your machine reproduces
the published rankings should write somewhere scratch, such as
`deno task bench:analyze 5 /tmp/results.md`, precisely so it does not overwrite
the committed file with a one-off measurement. What the rule forbids is a
_committed_ per-experiment variant, not a throwaway.

## Archive Is A Research Asset

Archived implementations exist in git history, not on disk;
`archive/IMPLEMENTATION-HISTORY.md` carries the SHA to retrieve each one. An
archive entry records the performance data, what superseded it or why it failed,
and a pointer to the analysis. That record is the whole value: a failed
hypothesis nobody wrote down gets re-tried.

Retrieve with `git show <SHA>:packages/@jim/spandex/src/index/X.ts`. Compare
against archived baselines with `deno task bench:archived`.

**Do not archive a hypothesis for an implementation's defect.** This is the
research form of the rule in
[project-values](project-values.md#a-bug-is-not-a-verdict-on-the-design), and it
is the more expensive one, because the archive is permanent and the next
researcher reads it as settled. A candidate that fails an axiom, or benchmarks
badly, is usually evidence that this code is wrong rather than that the idea is.
Separate the two before writing the entry: fix the defect and measure again, or
say plainly in the entry that the approach was abandoned with a known bug
outstanding. "Slower than baseline" and "slower than baseline, though the query
path was never optimized" are different claims, and only one of them stops
someone trying again.

## Reproducibility

- Benchmarks report the environment. CI runs on shared runners, so CV% above
  20% there is expected and the numbers are for regression detection, not for
  research-grade comparison. Say which one you ran.
- Three runs is a quick validation. Five is the minimum for a claim that lands
  in an analysis document.
- An implementation removed from the tree keeps its retrieval path working. If
  the import layout changes, the archive entry says so.
