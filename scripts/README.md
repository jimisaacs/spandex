# Scripts

The automation behind the `deno task` entries. Most are Deno programs; two are
bash, because they drive the toolchain itself.

Every file in this directory is documented below, and `deno task meta-check`
fails if one is not.

## Verification

### `ci-steps.sh`

The verification sequence, defined once so a local run and CI cannot drift
apart.

**Run**: `deno task ci`

It runs `fmt --check`, `lint`, `check`, `meta-check`, and `test` in order,
reporting each and failing on the first that fails. `.github/workflows/ci.yml`
runs this same file, so a green `deno task ci` means the same thing locally as
it does on a runner.

### `ci-local.sh`

Runs `ci-steps.sh` against specific Deno versions.

**Run**: `deno task ci:matrix`, or `bash scripts/ci-local.sh v2.8.0`

The failures this catches are toolchain drift rather than code drift. CI once
tracked a floating `canary`, so an upstream pre-release could break the build
with no change here, and no local run could reproduce it because local Deno was
whatever happened to be installed. Toolchains download into `.ci-deno/` and are
reused, each with its own module cache so one version cannot mask another's
resolution failure.

This runs the same steps as CI, not the same environment. It will not reproduce
a failure that depends on the runner image or on a cold cache.

### `meta-check.ts`

Checks the claims documentation makes about the repository.

**Run**: `deno task meta-check` (also part of `deno task ci`)

It verifies that the agent-scaffolding symlinks resolve, that the rule and skill
indexes match their directories, that relative links and heading anchors
resolve, that every `deno task` named in prose is a real task, that paths named
in code spans exist, that generated files keep their banners, and that this
README documents every script beside it. Read the file itself for the full
list; it is the authority, not this paragraph.

## Documentation Sync

### `sync-docs.ts`

Regenerates derived documentation after implementations or tests change.

**Run**: `deno task sync-docs`

It detects changed implementations, tests, and benchmarks, regenerates
`BENCHMARKS.md`, and reports what it updated. Run it after archiving or
unarchiving an implementation, or after changing an active one.

## Benchmarks

Two scripts, easily confused, and both must be current before work is done.

| Script                  | Writes                                  | Duration | When                        |
| ----------------------- | --------------------------------------- | -------- | --------------------------- |
| `update-benchmarks.ts`  | `BENCHMARKS.md`                         | ~16 min  | Frequently during iteration |
| `analyze-benchmarks.ts` | `docs/analyses/benchmark-statistics.md` | ~80 min  | Before finishing work       |

```bash
deno task bench:update                                             # quick feedback
deno task bench:analyze 5 docs/analyses/benchmark-statistics.md    # statistical validation
```

Both are slow enough to run in the background rather than blocking on.

### `update-benchmarks.ts`

Runs `deno bench benchmarks/performance.ts`, parses the table output, and writes
`BENCHMARKS.md`. It also measures each implementation's minified bundle size
with `deno bundle --minify`, which is why those numbers belong there and not in
hand-written prose.

**Run**: `deno task bench:update`

### `analyze-benchmarks.ts`

Runs the suite N times and reports mean, standard deviation, and CV% per
scenario.

**Run**: `deno task bench:analyze <runs> <output-file>`

Three runs is a quick validation. Five is the minimum for a number that lands in
an analysis document. Writing to a scratch path rather than the committed one is
the right move when you are only checking whether your machine reproduces the
published rankings.

### `compare-benchmarks.ts`

Compares two benchmark outputs and detects regressions.

**Run**: `deno task bench:compare <pr.txt> <main.txt> <output.md>`

```bash
deno bench benchmarks/performance.ts > pr-benchmarks.txt
# ... checkout main ...
deno bench benchmarks/performance.ts > main-benchmarks.txt
deno task bench:compare pr-benchmarks.txt main-benchmarks.txt comparison.md
```

It flags anything more than 20% slower as a regression and more than 20% faster
as an improvement. Exit code 0 means no regressions, 1 means regressions were
found, and 2 means bad input. Run it with no arguments to test the parser.

**Used by**: `.github/workflows/performance-regression.yml`

## Implementation Lifecycle

An archived implementation lives in git history, not on disk.
`archive/IMPLEMENTATION-HISTORY.md` carries the SHA to retrieve each one, and
`archive/src/implementations/` is empty. Retrieval is a git command:

```bash
git show <SHA>:packages/@jim/spandex/src/index/X.ts
```

### `archive-impl.ts`

Moves an implementation and its tests out of the active tree.

**Run**: `deno task archive:impl <name> <superseded|failed-experiments>`

It moves `packages/@jim/spandex/src/index/<name>.ts` and the matching test
directory `packages/@jim/spandex/test/index/<name>/` under `archive/`, adds a
header saying why the file was archived, and type-checks what remains.
Benchmarks discover implementations from the source directory, so removing the
file is the whole deregistration step.

**Treat this as one-way.** It rewrites the archived file's relative imports to
`@jim/spandex`, and `unarchive-impl.ts` does not reverse that, so a round trip
does not return the file you started with. The reliable way back is the SHA in
`archive/IMPLEMENTATION-HISTORY.md`.

**See**: `docs/IMPLEMENTATION-LIFECYCLE.md`

### `unarchive-impl.ts`

Moves an archived implementation back into the active tree.

**Run**: `deno task unarchive:impl <name> <superseded|failed-experiments>`

It reverses the file moves and strips the archive header. It does not reverse
the import rewriting described above, so check the imports after running it.

## Convention

Scripts here are automation you run through a `deno task`. Benchmark suites live
in `benchmarks/` and are run with `deno bench`.

## Adding a New Script

1. Create `scripts/your-script.ts`.
2. Give it the narrowest permissions that work, rather than `-A`.
3. Add a task to `deno.json`:
   ```json
   "your-task": "deno run --allow-read scripts/your-script.ts"
   ```
4. Document it in this README. `deno task meta-check` fails until you do.
