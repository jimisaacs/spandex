---
name: work
description: >-
    Use when starting substantial spandex work: implementing or changing an
    algorithm, refactoring across packages, naming or module-boundary sweeps,
    API changes, release readiness, or reviews that should end in action or
    evidenced inaction. Skip for one-line fixes and pure questions where a
    focused rule already specifies the path.
---

# spandex — Work Skill

Substantial work should leave the repository easier for the next agent to
continue. Assess first, then act or prove inaction. Do not stop at a report when
the right move is to fix what you found.

## When not to use

- One-line fixes or pure questions where a focused rule already names the path.
- Running an experiment from hypothesis to conclusion, which is the
  [experiment skill](../experiment/SKILL.md).

## 1. Load context

Read only what the task needs.

| If the task touches…                 | Read first                                                                                                            |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Scope, APIs, naming, the release bar | [project-values](../../rules/project-values.md)                                                                       |
| A new or changed implementation      | [tests](../../rules/tests.md) + [IMPLEMENTATION-LIFECYCLE](../../../docs/IMPLEMENTATION-LIFECYCLE.md)                 |
| Interval semantics or an adapter     | [coordinate-system](../../../docs/diagrams/coordinate-system.md)                                                      |
| Decomposition behavior               | [RECTANGLE-DECOMPOSITION-PRIMER](../../../docs/RECTANGLE-DECOMPOSITION-PRIMER.md)                                     |
| A performance claim                  | [research-integrity](../../rules/research-integrity.md) + [BENCHMARK-FRAMEWORK](../../../docs/BENCHMARK-FRAMEWORK.md) |
| Docs or agent scaffolding            | [doc-drift](../../rules/doc-drift.md) + [doc-voice](../../rules/doc-voice.md)                                         |
| A published export                   | [RELEASING](../../../docs/RELEASING.md)                                                                               |
| Which command to run                 | [commands](../../rules/commands.md)                                                                                   |

## 2. Assess every touched surface

- **Inevitability.** Would a competent reader think this is the obvious shape
  for this library at this layer? If not, that gap is the work.
- **Names.** Do file, type, task, and function names say what they own?
- **Boundaries.** Is interval conversion still in the adapter? Is the
  implementation still free of external semantic constraints? Does the root
  export still carry types only?
- **Evidence.** Does every correctness claim have an axiom, and every
  performance claim a measurement with its conditions?
- **Cost.** Is there a hidden allocation in a hot path, or an accidental O(n²)
  where the complexity claim says otherwise? Treat asymptotic shape as a
  first-class design property, not a later optimization.
- **Polish.** Would a rough edge here multiply across every future
  contribution?

**Decide:**

- **Act** when any answer is "no" and the fix is in scope. A load-bearing
  structural or naming change is in scope when it is the right move — internal
  shape carries no migration cost here.
- **Inaction** only with evidence: the checks pass and the gap is a documented
  boundary, not neglect dressed as prudence.

## 3. Execute

- Prefer structure that makes the correct path the only path — types, module
  boundaries, a check in `scripts/meta-check.ts` — over a comment asking the
  next reader to be careful.
- Same change: code, tests, and living-state docs.
- Match the surrounding code. A minimal correct diff beats a wide cosmetic
  sweep.
- **Leave it better.** A pass that opens a surface owes a higher floor when it
  closes, not only the named fault. Delete the dead code the fix exposes; the
  type-checker and grep are the authority on what is unreachable, not a guess
  about who might still need it.

## 4. Verify

```sh
deno task hooks:pre-commit
deno task meta-check
```

Exit code is the authority. Never read a check's result through a pipe.

## 5. Compound

- Run `deno task sync-docs` if implementations or tests changed.
- Regenerate both benchmark documents if performance moved: `bench:update` and
  `bench:analyze`.
- Fix doc drift in the files you touched, and leave the prose more readable than
  you found it.
- **Turn the lesson into a check.** If this session learned something the
  scaffolding didn't teach, a check in `scripts/meta-check.ts` holds it better
  than a sentence in a rule. A rule you must remember is weaker than a build
  that rejects the violation. The best pass leaves the gate longer and the prose
  shorter.
- Do not leave "someone should fix X later" unrecorded. Write X down as a
  present boundary, or do it.
