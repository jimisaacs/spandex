# spandex — Agent Scaffolding

The scaffolding — `CLAUDE.md`, everything under `.agents/`, the `.claude/`
overlay, `.cursorrules` — is a public API whose consumers are agents. Every
value this project holds about public surfaces therefore applies to it, and
applies harder, because the consumers act on what the surface says, every
session, at machine speed. A stale README misleads a reader who might notice. A
stale rule instructs an executor who won't.

## The scaffolding is living-state

Every rule, every README under `.agents/`, and every skill body is a
living-state surface under the [doc-drift](doc-drift.md) rubric, registered in
that rule's living-state table. A rule that cites a path claims the path exists.
A rule that shows a command claims the command works. When the state moves, the
claim moves in the same change: aligned, removed, or stripped of its state
claim. There is no fourth outcome and no follow-up commit.

## The scaffolding has a gate

Code answers to `deno task hooks:pre-commit`; the scaffolding answers to
`deno task meta-check`, which runs inside it. `scripts/meta-check.ts` is the
authoritative inventory of what is mechanically verified — read it before
assuming a claim is unchecked. The shape of what it holds:

- The overlay symlinks resolve. A canonical rule whose overlay has died is
  silently unloaded, and that failure is invisible at exactly the moment it
  matters.
- The indexes and the directories agree in both directions. An unindexed rule
  is undiscoverable; an indexed ghost is a broken promise.
- Relative links resolve, documented `deno task` commands are real tasks, and
  the living-state registry covers every doc it should.

The gate also creates a standing pressure: **a rule sentence that could be a
check is a TODO for a check.** When a check lands, the prose that asserted the
same thing shrinks to a pointer. Over time the rules get shorter and the gate
gets longer. That is the intended direction of travel, because a build step
holds the line without asking anyone to remember it.

## The ratchet

Every session ends with one question: what did this session learn that the
scaffolding didn't already teach? If the answer is non-empty, the lesson lands
before the session does, at the strongest layer that can hold it:

1. **A check in `scripts/meta-check.ts`**, if the lesson is mechanically
   checkable.
2. **A conformance axiom or fixture**, if the lesson is semantic.
3. **A rule line**, only when neither fits, and then the sharpest line that
   carries it, placed in the rule that owns the surface.
4. **A deletion**, when the lesson is that an existing line no longer earns its
   load.

A correction from a human is always a ratchet event: the session that receives
it encodes it, or says in its handoff why it couldn't.

## The budget

Every rule line is context every future session must carry, so every line pays
rent. Additions displace or compress; they do not merely accumulate. A rule that
outgrows a single attentive read splits by responsibility, the way a module
would. Prefer one sentence with teeth over five with hedges. Bullet accretion is
the drift mode of scaffolding and it kills documents slowly: the load-bearing
lines drown, the voice flattens, and agents start skimming the very text that
was meant to stop them skimming.

`CLAUDE.md` is the surface this budget binds hardest, because it loads in full
every session. It is a routing table and a statement of principles. Procedure
belongs in a skill, constraint belongs in a rule, and neither belongs inline.

## Commit messages

A commit message is a committed file, and no gate can reach it — it is immutable
by the time any check runs. The discipline is the only thing holding it.

- **Keep it short.** A subject line under about 70 characters, then a body only
  when the _why_ is not obvious from the diff. One paragraph is the normal size.
  The bar is what a maintainer writes at the end of a working day, not a report.
- Follow the type prefix convention in [CONTRIBUTING](../../CONTRIBUTING.md).
- A message says what changed and why. It never says which agent, skill, or
  review pass produced it. `git log` is the project's record, not the session's.
- A message asserts only what its own diff demonstrates. A claim about
  pre-existing code — "this also fixes a bug where X" — quotes the pre-image from
  `git show <sha>^:<path>` before it is written. A remembered line is not
  evidence, and a fabricated defect in the permanent record is worse than the
  defect would have been.
- Paths and symbols are read back off the diff, never from the plan that
  preceded it.

## Scaffolding litmus

Before changing the scaffolding, ask:

- Does this make the next agent's first correct action more likely?
- Could the gate enforce this instead of prose? Then wire the gate.
- Does this line earn its tokens in every session that loads it?
- Would the gate notice if this claim drifted?
- Is the floor higher when this change lands than it was before?
