---
description: 'The canonical command surface: gates, the two benchmark scripts, fixtures, generated state, git posture.'
globs: deno.json, scripts/**/*.ts, .github/workflows/*.yml, .deno-version*
---

# spandex — Execution Model

This is the canonical command surface. Other documents point here rather than
restating it, and `deno task meta-check` verifies that every `deno task`
mentioned anywhere in the docs is a real task in `deno.json`.

## The Gate

Run before calling code work complete:

```sh
deno task hooks:pre-commit
```

That runs `fmt --check`, `lint`, `check`, and `test` in sequence, and it is the
same sequence CI runs on every push. A gate passes by its exit code, not by its
output: piping through `tail` or `grep` reports the pipe's status and turns a
failing run into a false green.

Use focused steps while iterating:

```sh
deno task test                  # all tests
deno task test:watch            # watch mode
deno task test:morton           # one implementation
deno task test:rstartree
deno task test:adversarial      # worst-case fragmentation patterns
deno task test:spandex          # one package
deno task fmt                   # format in place
deno task lint
deno task check                 # type check packages, scripts, benchmarks
deno task meta-check            # scaffolding and doc claims
```

To run a single file, invoke `deno test` directly:

```sh
deno test -A packages/@jim/spandex/test/index/rstartree/geometry.test.ts
```

## Fixtures

Snapshot fixtures are committed Markdown. When behavior changes on purpose:

```sh
UPDATE_FIXTURES=1 deno test -A                       # all fixtures
UPDATE_FIXTURES=1 deno task test:morton              # one implementation
```

`UPDATE_FIXTURES=1` needs `-A`, because it reads an environment variable.
Regenerating is a review step, not a formality — see the
[tests rule](tests.md).

## The Two Benchmark Scripts

They are different tools and the difference is the thing most often forgotten.

| Task                                                              | Writes                                  | Takes   | Run it                      |
| ----------------------------------------------------------------- | --------------------------------------- | ------- | --------------------------- |
| `deno task bench:update`                                          | `BENCHMARKS.md`                         | ~16 min | The cheaper of the two      |
| `deno task bench:analyze 5 docs/analyses/benchmark-statistics.md` | `docs/analyses/benchmark-statistics.md` | ~80 min | Once, before finishing work |

Both must be current before work is complete, and CI regenerates both on pushes
to `main`. A single pass over the suite measures about sixteen minutes, so five
runs is well over an hour. Run it in the background and watch the log rather
than blocking on it. Three runs is a quick validation and is not enough for a
claim that lands in an analysis document.

These are slow because the query benchmarks iterate their results. They once
appeared to take two minutes, which was the cost of allocating generators that
were never consumed.

Other benchmark entry points:

```sh
deno task bench                          # active implementations only
deno task bench:archived                 # include archived implementations
deno task bench:compare                  # compare two benchmark runs
deno task bench -- --exclude=RStarTree   # skip one during development
```

## Implementation Lifecycle

```sh
deno task archive:impl <name> <superseded|failed-experiments>
deno task unarchive:impl <name>
deno task sync-docs        # regenerate derived docs after implementations or tests change
```

Benchmarks discover implementations from
`packages/@jim/spandex/src/index/`, so adding a file is the whole registration
step and archiving one removes it. After either, run `deno task sync-docs`
before reporting the work done.

## Generated State

Ignored, never committed: `.temp/`, `_site/`, `.serena/cache/`, `.serena/logs/`,
and `coverage/`. If generated output appears in `git status`, fix `.gitignore`
rather than deleting by hand.

Generated and committed, never hand-edited: `BENCHMARKS.md` and
`docs/analyses/benchmark-statistics.md`. Both carry a banner saying so, and
`meta-check` requires the banner to stay. See [doc-drift](doc-drift.md).

`deno task fixtures:clear` deletes every committed fixture. It is a recovery
tool, not part of a normal loop.

## Git Posture

Agents do not mutate git history. Read-only commands are fine: `status`, `diff`,
`log`, `show`, `blame`, `branch`, `rev-parse`, `ls-files`.

`git checkout -- <path>` and `git restore` are working-tree writes, not reads.
On a tree carrying uncommitted work they destroy that work. To undo a probe
edit, restore from a copy saved beside the scratchpad, never from git.

A commit made when directed stages explicit paths, never `-a`, `-u`, or
`add .`. Read `git status` immediately before staging and claim only your own
files. Message discipline is in
[agent-scaffolding](agent-scaffolding.md#commit-messages).
