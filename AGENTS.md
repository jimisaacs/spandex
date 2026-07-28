# spandex — Agent Guide

This file is the entry point for Claude Code and Cursor. It routes; it does not
restate. Canonical guidance lives under [`.agents/`](.agents/README.md), which
is loaded on demand rather than every session.

## What This Repository Is

A monorepo for 2D spatial indexing research and the library that came out of it.
It maintains non-overlapping rectangles with last-writer-wins semantics: insert
an overlapping rectangle and the existing one decomposes into at most four
disjoint fragments, so no two stored rectangles ever overlap.

It ships to pure JavaScript runtimes with no WASM and no `SharedArrayBuffer`.
Google Apps Script is a target, so bundle size sometimes matters.
`@jim/spandex`, `@jim/spandex-ascii`, and `@jim/spandex-html` publish to JSR and
carry real consumer migration cost.

Two things surprise people who have not worked here before:

- **`docs/active/experiments/` is a workspace, not storage.** It is empty
  between experiments. Completed work moves to `docs/analyses/` or `archive/`.
- **Archived implementations live in git history, not on disk.**
  `archive/IMPLEMENTATION-HISTORY.md` carries the SHA to retrieve each one.

## Start Here

Match depth to the task. Do not read the whole tree for a one-line fix.

| Task                                         | Load first                                                                                          | Check with                                                        |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Quick fix in one file                        | The focused rule for that surface ([rule index](.agents/README.md))                                 | `deno task test` or narrower                                      |
| Substantial feature, refactor, or API change | [work skill](.agents/skills/work/SKILL.md)                                                          | `deno task hooks:pre-commit`                                      |
| A research experiment, hypothesis to result  | [experiment skill](.agents/skills/experiment/SKILL.md)                                              | `deno task bench:analyze 5 docs/analyses/benchmark-statistics.md` |
| New or changed implementation                | [tests rule](.agents/rules/tests.md) + [IMPLEMENTATION-LIFECYCLE](docs/IMPLEMENTATION-LIFECYCLE.md) | `deno task test`                                                  |
| Interval semantics or an adapter             | [coordinate-system](docs/diagrams/coordinate-system.md)                                             | `deno test -A packages/@jim/spandex/test/adapter/`                |
| A performance claim                          | [research-integrity rule](.agents/rules/research-integrity.md)                                      | `deno task bench:update`                                          |
| Anything about correctness or invariants     | [tests rule](.agents/rules/tests.md)                                                                | `deno task test:adversarial`                                      |
| A published export or a version bump         | [project-values rule](.agents/rules/project-values.md) + [RELEASING](docs/RELEASING.md)             | `deno task check`                                                 |
| Doc edit                                     | [doc-drift](.agents/rules/doc-drift.md) + [doc-voice](.agents/rules/doc-voice.md)                   | `deno task meta-check`                                            |
| Agent scaffolding under `.agents/`           | [agent-scaffolding rule](.agents/rules/agent-scaffolding.md)                                        | `deno task meta-check`                                            |
| Which command to run                         | [commands rule](.agents/rules/commands.md)                                                          | —                                                                 |

**Context map**, for when you need authority rather than a tour:

- Choosing an algorithm: [PRODUCTION-GUIDE.md](PRODUCTION-GUIDE.md)
- Using the library: [docs/GETTING-STARTED.md](docs/GETTING-STARTED.md)
- What the research found: [docs/core/RESEARCH-SUMMARY.md](docs/core/RESEARCH-SUMMARY.md)
- The math behind the bounds: [docs/core/theoretical-foundation.md](docs/core/theoretical-foundation.md)
- Individual experiments: [docs/analyses/](docs/analyses/)
- Why an implementation was archived: [archive/IMPLEMENTATION-HISTORY.md](archive/IMPLEMENTATION-HISTORY.md)

## First Principles

- **Invariants before performance.** After every operation, no two stored
  rectangles overlap and no duplicate `(bounds, value)` pair exists. A faster
  implementation that breaks either is not faster, it is broken.
- **Measured, hypothesized, and expected are three different claims.** Keep the
  words apart. A number without its conditions is a memory, not a measurement.
- **Semantics live at the boundary; internals optimize.** Closed intervals
  `[min, max]` inside, half-open `[start, end)` in the `GridRange` adapter. An
  external constraint moves inward only when it buys correctness or speed.
- **The directory is the registry.** Benchmarks discover implementations from
  `packages/@jim/spandex/src/index/`. Adding a file is the whole registration
  step, so docs describe the set rather than counting it.
- **Document process, not instances.** Structural docs say how to decide.
  Analyses, examples, and operational guides name implementations, because
  naming is the point there.
- **Generated files are regenerated, never edited.** `BENCHMARKS.md` and
  `docs/analyses/benchmark-statistics.md` are outputs. To change them, change
  the generator or the code they measure.
- **Internal shape is free; published shape is versioned.** Reshape an
  algorithm's internals whenever the assessment says so. Changing
  `SpatialIndex<T>`, `Rectangle`, or the set of subpath exports is a deliberate
  version event.
- **Tests that pass while benchmarks fail mean the tests are misconfigured.**

## The Gate

```sh
deno task hooks:pre-commit    # fmt --check, lint, check, meta-check, test
```

That is the same sequence CI runs. A check passes by its exit code, so never
read one through `tail` or `grep`. Focused steps, the two benchmark scripts, the
fixture workflow, and git posture are all in the
[commands rule](.agents/rules/commands.md).

Two commands are easy to confuse and both must be current before work is done:

| Command                                                           | Writes                                  | Takes   |
| ----------------------------------------------------------------- | --------------------------------------- | ------- |
| `deno task bench:update`                                          | `BENCHMARKS.md`                         | ~16 min |
| `deno task bench:analyze 5 docs/analyses/benchmark-statistics.md` | `docs/analyses/benchmark-statistics.md` | ~80 min |

After implementations or tests change, run `deno task sync-docs` before
reporting the work done.

## Agent Scaffolding

Canonical agent guidance lives under [`.agents/`](.agents/README.md); its index
names every rule and skill and what each governs. This file is `AGENTS.md`, and
`CLAUDE.md` is a symlink to it, so both tools read one entry point. Claude gets
rules, skills, and agents through directory symlinks under `.claude/`. Cursor
needs one `.mdc` symlink per rule under `.cursor/rules/`, because that is what
its loader discovers.

The scaffolding is itself a public API for agents, and it has its own check.
Read [agent-scaffolding](.agents/rules/agent-scaffolding.md) before changing
anything under `.agents/`, the `.claude/` overlay, or `scripts/meta-check.ts`.

Edit only the canonical files. A bulk in-place edit that follows a symlink turns
it into a regular file and the overlay dies silently. `deno task meta-check`
rejects that, but it is better not to create the failure.

## Layout

```text
packages/@jim/
├── spandex/              # core library
│   ├── src/index/        # implementations — the registry is this directory
│   ├── src/adapter/      # GridRange and A1 notation, where intervals convert
│   ├── src/render/       # rendering utilities
│   └── test/             # conformance, adversarial, boundary, integration
├── spandex-ascii/        # ASCII visualization
└── spandex-html/         # HTML rendering
packages/@local/
├── snapmark/             # snapshot testing framework
├── spandex-testing/      # the axiom suite every implementation runs
└── spandex-telemetry/    # opt-in telemetry
docs/
├── active/experiments/   # in-progress work only; empty between experiments
├── analyses/             # findings, one file per experiment
├── core/                 # research summary and theory
└── diagrams/             # visual explanations
archive/                  # what was tried, why it was dropped, how to retrieve it
scripts/                  # automation you `deno run`
benchmarks/               # measurement suites you `deno bench`
site/                     # documentation site
```

`.temp/` is a gitignored scratch directory for work-in-progress notes. Research
findings do not go there.
