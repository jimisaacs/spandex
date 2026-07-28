---
name: smell-annihilation
description: >-
    Use for structural cleanup, duplication collapse, module-boundary moves, hot-path
    cost hunts, or when a timid first fix smells like a workaround around a shape that
    should change. Not for one-line fixes, pure questions, or running an experiment
    from a hypothesis, which is the experiment skill.
---

# Smell annihilation — ambition plus discipline

Find the architecture the code should have, move things where they belong, and
enforce it so it cannot rot back. Ambition without the check is recklessness;
the check without ambition is stagnation. Hold both.

Distrust the first, smaller fix when it imports a migration cost that does not
exist. Internal shape carries none here: algorithm internals, private helpers,
module layout, and everything under `@local/` are yours to reshape. Re-derive
against the full option set — including moving a type, splitting a module, or
relocating logic — before accepting a nullable, a flag, a facade, or a follow-up
task. Published exports are the one real constraint, and
[project-values](../../rules/project-values.md) says how to treat them.

## When not to use

- One-line fixes or pure questions where a focused rule already names the path.
- Running an experiment from hypothesis to conclusion, which is the
  [experiment skill](../experiment/SKILL.md).
- Ordinary feature work, which is the [work skill](../work/SKILL.md).

## A bug is not a verdict on the design

Half-finished structural moves usually die here, so decide it explicitly. See
[project-values](../../rules/project-values.md#a-bug-is-not-a-verdict-on-the-design).
A defect that surfaces mid-move is nearly always evidence about the
implementation, not about the shape you are moving toward.

## Leave it better

Every pass that opens a surface owes a higher floor when it closes, not only the
named fault.

- **Delete dead code in the same change** when the pass makes it unreachable:
  unread fields, unused exports, wrappers that only forward to something that
  already moved. The type-checker and grep are the authority on what is
  unreachable, never a guess about who might still need it.
- **Do not keep a second representation "for safety"** once the real owner
  exists. That is a migration cost invented rather than inherited.
- Small sharpening on the opened path compounds. Leaving the scar tissue for the
  next agent is a failed pass even if the original bug is gone.

## Cost is architecture

A structure that ignores cost is incomplete. Treat allocation, copying, and
asymptotic shape as first-class smells, at the same severity as a wrong module
boundary. This library's hot paths are insert-with-overlap, the decomposition
loop, and query iteration, and its complexity claims are public: O(n) for linear
scan and O(log n) average for the tree.

Every candidate move gets an explicit verdict:

| Verdict      | Meaning                                                                |
| ------------ | ---------------------------------------------------------------------- |
| **forbid**   | Delete the cost; the structure makes it impossible to reintroduce.     |
| **name**     | It has to stay; document why, and prefer a test that pins it.          |
| **measure**  | The shape is unclear; benchmark before landing taste as fact.          |
| **own-pass** | A real win, but bigger than this session; defer with the claim intact. |

A cleanup that adds a per-insert allocation, or turns a linear scan into a
quadratic one, without a forbid/name/measure line is incomplete. Taste without a
number is a hypothesis: mark it **measure**, do not ship it as fact.

## The loop

1. **Scope.** Fault, ideal, and false constraint, one sentence each. Name the
   cost stake in the ideal: what becomes impossible, which complexity claim
   holds.

2. **Review with two independent lenses.** Spawn two subagents on the real tree
   rather than reviewing your own work, where you have blind spots. Give them
   different lenses so they can disagree usefully — typically one on
   correctness and invariants, one on cost and complexity. Order both:

   > Read the code, do not hand-wave. Be honest where something is already
   > right, and do not invent nits. Propose, do not edit; I will execute.
   > Treat allocation, copying, and asymptotic shape as architecture: mark each
   > one forbid, name, measure, or own-pass. Prefer the structure that makes the
   > cheap correct path the only path.

   Demand from each: findings ordered most-impactful first, exact `file:line`,
   the exact before and after or the deletion, the principle the move serves,
   the blast radius, the cost verdict, and a hard split between what is clean
   enough to land now and what is its own pass.

3. **Synthesize.** Keep what both found. Where they disagree, decide and say
   why, because a held split is itself a finding. Escalate anything both flag as
   a real defect. Do not execute a review blindly.

4. **Execute** when implementation was asked for. Prefer the root fix over the
   workaround. Delete the dead code the fix exposes, and land the living-state
   docs in the same change.

5. **Check.** `deno task hooks:pre-commit` and `deno task meta-check`. Exit code
   is the authority; never read a result through a pipe.

6. **Defer honestly.** Name the non-moves with real reasons, including "measure
   first", and scope them as their own pass. Never half-land a big move.

## Smells to hunt

- The same control flow written once per implementation, where one shared helper
  and thin callers would do. The axiom suite already proves they behave alike;
  duplication is how they drift apart.
- A type that is secretly two types, told apart by an optional field or a mode
  flag and scattered narrowing checks. Split it and delete the flag.
- A boundary that is real but only conventional, held by a comment rather than
  by the type system or a check.
- Interval conversion that has leaked out of the adapter, or an external
  semantic constraint that has leaked into an algorithm.
- Behavior gaps hiding inside duplication: a hand-rolled copy that quietly
  dropped what the canonical path does. Unifying fixes these for free.
- An allocation inside the decomposition loop or the query iterator that is
  neither forbidden nor measured.
- A linear scan through a structure that already has an index, or an
  accidentally quadratic pass where the complexity claim says otherwise.
- A helper that copies to paper over unclear ownership at a boundary.
- Dead exports and fields retained "for callers" that no caller reads.

## The apex move

Do not merely fix a smell. Make its return structurally impossible. Turn the
lesson into something that fails loudly: a check in `scripts/meta-check.ts`, an
axiom in the shared suite, an adversarial pattern, or a benchmark scenario. A
rule you must remember is weaker than a build that rejects the violation. The
best pass leaves the checks longer and the prose shorter.

## Discipline

- On a risky structural move, land the smallest slice that proves the mechanism
  first, then move the load-bearing piece.
- Let the type-checker and the test suite enumerate the work: change the
  structure, then fix exactly what they flag, in a tight loop.
- Never leave the tree red. Every pass ends green or does not end.
- Cost claims need evidence. `deno task bench:update` is the fast check;
  `bench:analyze` is the one that goes in a document.

## Done means

The full check is green, the fault is fixed and structurally prevented, the dead
code the pass exposed is gone, duplication is gone or honestly deferred, costs
are forbidden or named or measured, the published surface is unchanged or
deliberately versioned, and the next agent inherits a higher floor.
