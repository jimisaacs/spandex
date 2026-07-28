---
description: 'Invariants before performance, boundary-owned semantics, published-package posture.'
globs: packages/**/*.ts, deno.json, packages/**/deno.json
---

# spandex — Project Values

spandex is a 2D spatial indexing library and the research project around it. It
maintains non-overlapping rectangles with last-writer-wins semantics, and it
ships to pure JavaScript runtimes with no WASM and no `SharedArrayBuffer`. Keep
the repository small, direct, and library-grade.

## Values

- **Invariants before performance.** After every operation, no two stored
  rectangles overlap and no duplicate `(bounds, value)` pair exists. A faster
  implementation that breaks either is not a faster implementation. The
  conformance axioms decide this, not inspection.
- **Measured over theorized.** A performance claim carries the number and the
  conditions that produced it. A mechanism claim is labelled as a hypothesis
  until an experiment separates it from its alternatives. See
  [research-integrity](research-integrity.md).
- **Semantics live at the boundary; internals optimize.** Closed intervals
  `[min, max]` inside, whatever the external API wants outside. Half-open
  `GridRange` and A1 notation convert in the adapter, never in the algorithm.
  Do not push an external constraint inward unless it buys correctness or
  speed — `MAX_COORD` and `NEG_INF`/`POS_INF` exist because they remove branches
  from hot paths, not because a caller asked for them.
- **One interface, many implementations.** Everything under
  `packages/@jim/spandex/src/index/` implements `SpatialIndex<T>` and is
  discovered from that directory by the benchmarks. There is no registry to
  update, so there is no registry to forget.
- **The deployment target is a constraint, not a footnote.** No WASM, no
  `SharedArrayBuffer`, TypedArrays fine, bundle size sometimes critical. An
  optimization that assumes otherwise does not ship.
- **Tree-shakable surface.** Subpath exports so a consumer pays for the one
  implementation it imports. The root export carries types only.
- **Types are the contract.** No `any` in source. `strict`,
  `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes` are on, and the
  correct move when they complain is to fix the shape, not to cast.
- **Archive is a research asset.** A failed experiment that is documented
  teaches the next one. Deleting it without a record costs more than keeping it.
- **Polish matters.** A rough edge in the tasks, README, or agent rules becomes
  a rough edge in every contribution that follows.

## Published-Package Posture

`@jim/spandex`, `@jim/spandex-ascii`, and `@jim/spandex-html` publish to JSR, so
this repository does carry consumer migration cost. That is the opposite of a
pre-release license, and it changes the default verdict on two kinds of change:

- **Internal shape is free.** Algorithm internals, private helpers, module
  layout, and anything under `@local/` can be reshaped whenever the assessment
  says so. Do not accept a workaround inside an implementation to protect a
  structure that no consumer can see.
- **Public shape is versioned.** `SpatialIndex<T>`, `Rectangle`, `ExtentResult`,
  the adapter signatures, and the set of subpath exports are what consumers
  import. Changing one is a deliberate, documented, version-bumped event, not a
  side effect of a refactor. Check [RELEASING](../../docs/RELEASING.md) before
  changing an export.

The honest move when a clean fix would break a published surface is to name the
break and let it be decided, never to quietly leave the workaround in and never
to quietly ship the break.

## Release Bar

- **Assess, then act or prove inaction.** Substantial work uses the
  [work skill](../skills/work/SKILL.md): fix what the assessment finds, or show
  the checks and documented boundaries that justify leaving it.
- **Names are architecture.** A misleading module, type, or task name is a
  boundary bug, not cosmetics.
- **Order findings by severity and blast radius together.** Severity says what
  has to be fixed; blast radius says in what order, because a finding that moves
  a type or a boundary decides the shape the others get fixed into. Where a fix
  sits inside a pending structural change, do the structural one first — its
  interim spelling is not "quick", it is rework with a delay.
- **No half measures on touched surfaces.** If you open a layer, leave it
  sharper: code, tests, and living-state docs aligned in the same change.
- **Compound for the next agent.** Accurate docs and passing checks matter more
  than session-local narration.

## A Bug Is Not A Verdict On The Design

A defect found while a design is landing is evidence about the implementation
far more often than about the design. Before reverting, name which one it is:

- **A missing prerequisite** the design assumed and nothing provides yet: a
  boundary conversion, a shared helper, an invariant nothing yet enforces. Build
  it. It is usually smaller than the revert, and the revert leaves the hole for
  the next session to rediscover.
- **A contradiction in the design's own terms**, where holding one invariant it
  needs breaks another. Only this earns a retreat, and it is rare.

Reverting on the first is deferral wearing a bug report as its excuse, and the
follow-up task naming the prerequisite is the tell. Losing confidence does not
change the answer either: work that was not trusted needs more verification, not
smaller changes.

## Setup Litmus

Before adding a task, an export, or a documentation surface, ask:

- Does this keep `deno task test` and first use simpler?
- Can a consumer understand the API without reading the implementation?
- Does this survive the no-WASM, no-`SharedArrayBuffer` target?
- Would a hidden allocation or an accidental O(n²) become obvious in review?
- Is there now one place this fact lives, or did I just create a second?
