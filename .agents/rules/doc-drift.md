# spandex — Doc Drift Prevention

This rule keeps doc claims _true_. Its sibling, [doc-voice](doc-voice.md), keeps
prose _readable_. Run the two together whenever you touch a doc.

Every doc surface that makes a state claim must satisfy one of:

1. the claim matches current code;
2. the doc is removed;
3. the state claim is removed.

## Living-State Surfaces

These describe the repository as it is now and must be updated in the same
change as the state they describe:

- `README.md`
- `CONTRIBUTING.md`
- `PRODUCTION-GUIDE.md`
- `CLAUDE.md`
- `docs/README.md`
- `docs/GETTING-STARTED.md`
- `docs/IMPLEMENTATION-LIFECYCLE.md`
- `docs/BENCHMARK-FRAMEWORK.md`
- `docs/TROUBLESHOOTING.md`
- `docs/RELEASING.md`
- `docs/TELEMETRY-GUIDE.md`
- `docs/RECTANGLE-DECOMPOSITION-PRIMER.md`
- `docs/active/README.md`
- `docs/core/**`
- `docs/diagrams/**`
- `archive/README.md`
- `archive/IMPLEMENTATION-HISTORY.md`
- `scripts/README.md`
- `benchmarks/README.md`
- `packages/@jim/spandex/README.md`
- `packages/@jim/spandex-ascii/README.md`
- `packages/@jim/spandex-html/README.md`
- `packages/@local/snapmark/README.md`
- `packages/@local/spandex-testing/README.md`
- `packages/@local/spandex-telemetry/README.md`
- `.github/workflows/README.md`
- `.agents/**`
- `.mcp.json`
- `docs/active/experiments/`
- test names that encode API contracts

`deno task meta-check` holds this registry honest in both directions: every
root-level `*.md` and every top-level `docs/*.md` must be listed here (a
covering glob like `docs/core/**` counts), and every non-glob path listed here
must exist.

## Generated Surfaces

Two files are generated and are never hand-edited. Both carry a
`GENERATED FILE - DO NOT EDIT MANUALLY` banner, and `meta-check` requires that
banner to stay:

| File                                    | Generator                       | Command                                                           |
| --------------------------------------- | ------------------------------- | ----------------------------------------------------------------- |
| `BENCHMARKS.md`                         | `scripts/update-benchmarks.ts`  | `deno task bench:update`                                          |
| `docs/analyses/benchmark-statistics.md` | `scripts/analyze-benchmarks.ts` | `deno task bench:analyze 5 docs/analyses/benchmark-statistics.md` |

To change wording or layout, edit the generating script and regenerate. To fix
wrong numbers, fix the implementation or the benchmark scenario and regenerate.
An edit made directly to either file is lost on the next CI run.

## Historical Surfaces

`docs/analyses/*-analysis.md` and everything under `archive/docs/` record what
was measured at a moment and say so. They are not living-state: their past-tense
findings stay as written even when the code moves on. What they must not do is
describe the current architecture, so a rename does not silently make an old
analysis read as today's shape.

## Discipline

- Prefer present-tense contracts over project-history narration.
- Do not write "future X" once X has landed; name what exists and what does not.
- **Do not hardcode a count the code can outgrow.** A doc that says
  `Active implementations (3)` is wrong the day a fourth lands, and nothing
  fails when it does. Describe the set and point at
  `packages/@jim/spandex/src/index/`, which is the source of truth.
  `meta-check` rejects a hardcoded implementation count in living-state docs.
- **Document process, not instances.** Structural docs describe how to decide;
  they do not enumerate today's algorithms by class name. Analysis files,
  example code, and operational guides may and should name implementations,
  because naming is the point there.
- When an API name changes, sweep docs, tests, and examples in the same change.
  A rename that updates its target file and leaves the referrers behind is the
  commonest drift here, and no type-checker catches it in prose: grep the old
  name across the tree before calling the rename done.
- A path or command named in a script is a claim too. `meta-check` resolves
  workspace paths that appear as string literals under `scripts/`, because a
  watched directory that was renamed out from under a script fails silently
  forever.
