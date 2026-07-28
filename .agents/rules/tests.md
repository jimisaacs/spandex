# spandex — Tests and Conformance

Every test answers three questions: which **layer** is under test, what
**authority** decides "correct", and what a **failure** tells you. This rule is
the glossary that keeps the words for those answers honest and the map from each
answer to a directory. A test you cannot place on this map is a test whose
boundary is unclear — fix the test, not the map.

## Vocabulary

One meaning each. A word that drifts off these is a bug in the test surface, not
a synonym.

- **axiom** — a mathematical property every implementation must satisfy,
  asserted by a shared suite in `packages/@local/spandex-testing/src/axiom/` and
  run against each implementation. Authority is the specification of
  `SpatialIndex<T>`; a failure means that implementation is wrong, not that the
  test is picky.
- **conformance** — running the axiom suite against a given implementation. Every
  implementation runs the whole suite. There is no partial conformance.
- **fixture** — a committed snapshot, stored as Markdown, that pins observable
  output. Authority is the reviewed diff at the moment it was regenerated.
- **adversarial** — a pathological input pattern chosen to stress a bound
  (concentric, diagonal, checkerboard, random). Authority is the geometric
  bound being claimed; a failure means the bound is wrong or the implementation
  broke it.
- **benchmark** — a performance measurement. Benchmarks keep budgets visible;
  they never prove correctness, and a benchmark is never an authority for
  behavior.

## Authority

What decides "correct" is what a red test means:

| Authority                      | Where                                                    | A failure means                            |
| ------------------------------ | -------------------------------------------------------- | ------------------------------------------ |
| `SpatialIndex<T>` spec         | `spandex-testing/src/axiom/properties.ts`, `geometry.ts` | The implementation is wrong                |
| Cross-implementation agreement | `axiom/cross-implementation.ts`                          | Two implementations disagree; one is wrong |
| Canonical fragment counts      | `axiom/canonical-values.ts`                              | A coordinate or decomposition bug          |
| Reviewed snapshot              | `axiom/visual.ts` plus `**/fixtures/*.md`                | Observable output changed                  |
| Geometric bound                | `test/adversarial.test.ts`                               | A worst-case claim no longer holds         |
| Interval conversion            | `test/adapter/`                                          | A boundary conversion is off by one        |

**Canonical fragment counts are load-bearing.** The large-overlapping scenario
produces exactly 1375 fragments, and every implementation must produce the same
number. This catches coordinate and decomposition bugs that pass every invariant
check while still decomposing incorrectly. Do not relax it to make a new
implementation pass.

## Placement

- `packages/@local/spandex-testing/src/axiom/` — the shared axiom suite, one
  file per concern: `properties.ts`, `geometry.ts`, `visual.ts`,
  `canonical-values.ts`, `cross-implementation.ts`.
- `packages/@jim/spandex/test/index/<impl>/` — per-implementation conformance,
  one file per axiom group, with its `fixtures/` alongside.
- `packages/@jim/spandex/test/adapter/` — interval conversion at the API
  boundary, half-open `[start, end)` against closed `[min, max]`.
- `packages/@jim/spandex/test/adversarial.test.ts` — worst-case fragmentation
  patterns, run by `deno task test:adversarial`.
- `packages/@jim/spandex/test/boundary.test.ts` — extremes: infinity edges,
  `MAX_COORD`, empty and degenerate rectangles.
- `packages/@jim/spandex/test/integration.test.ts` — implementations composed
  with adapters and renderers end to end.
- `benchmarks/performance.ts` — measurement only, never correctness.

A new implementation is not done until it runs the full axiom suite. The pattern
is in [IMPLEMENTATION-LIFECYCLE](../../docs/IMPLEMENTATION-LIFECYCLE.md).

## Claims Need Tests

Any claim about decomposition behavior, disjointness, last-writer-wins ordering,
or interval semantics needs an axiom or a fixture behind it. A claim in a doc
with nothing running for it is a wish.

The converse also holds: **tests that pass while benchmarks fail mean the tests
are misconfigured**, not that the code is fine. A suite green against a
scenario nobody actually runs proves nothing.

## Regenerating Fixtures Is A Review Step

`UPDATE_FIXTURES=1 deno test -A` rewrites snapshots to match current behavior.
That makes any behavior change pass, including the ones you did not intend, so
regeneration without reading the diff destroys the only authority the fixture
had.

1. Regenerate.
2. Read `git diff` on the fixture files, all of it.
3. Confirm every change is one you meant to make.
4. Commit fixtures together with the code change that caused them.

A fixture diff you cannot explain is a finding, not noise.
