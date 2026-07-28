# spandex — Agentic Infrastructure

Canonical home for agent-facing guidance in this repository.

## Layout

```text
.agents/
├── README.md   # this file; the tables below are canonical
├── rules/      # one .md per rule — see the Rules table
├── skills/     # one directory per skill, each with a SKILL.md — see the Skills table
└── agents/     # one .md per subagent definition — see the Agents table
```

`deno task meta-check` holds these tables to the directories in both
directions, so the tree above shows shape only and cannot drift behind a file
the tables already cover.

Tool overlays point back to the canonical rules here rather than duplicating
them:

- `.claude/rules` is one directory symlink to `.agents/rules`.
- `.claude/skills` is one directory symlink to `.agents/skills`.
- `.claude/agents` is one directory symlink to `.agents/agents`.
- `.cursorrules` is one symlink to `CLAUDE.md`, the shared entry point.

Edit only the canonical files. A bulk in-place edit that follows a symlink
turns it into a regular file and the overlay dies silently.

## Rules

| Rule                                              | Purpose                                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [agent-scaffolding](rules/agent-scaffolding.md)   | The scaffolding is a public API for agents: living-state discipline, the gate, the ratchet, the budget  |
| [commands](rules/commands.md)                     | The canonical command surface: gates, the two benchmark scripts, fixtures, generated state, git posture |
| [doc-drift](rules/doc-drift.md)                   | Living-state docs must match current code or drop the state claim                                       |
| [doc-voice](rules/doc-voice.md)                   | Readable prose for human docs, plus the Markdown rules this repository's formatter forces               |
| [project-values](rules/project-values.md)         | Invariants before performance, boundary-owned semantics, published-package posture                      |
| [serena-mcp](rules/serena-mcp.md)                 | When to use Serena symbol tools instead of text search for TypeScript                                   |
| [research-integrity](rules/research-integrity.md) | Measured versus hypothesized, archive as a research asset, current-state prose                          |
| [tests](rules/tests.md)                           | Test taxonomy: which layer, what authority decides correct, what a failure means                        |

## Skills

| Skill                                                    | Purpose                                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [experiment](skills/experiment/SKILL.md)                 | The research experiment lifecycle, hypothesis through cleaned workspace         |
| [smell-annihilation](skills/smell-annihilation/SKILL.md) | Structural cleanup: move things where they belong, then make the rot impossible |
| [work](skills/work/SKILL.md)                             | Substantial work: assess, then act or prove inaction                            |

## Agents

Subagent definitions. Each adds domain knowledge on top of the rules and skills
above and points at them for anything they already own, so a procedure lives in
one place rather than two.

| Agent                                                                | Purpose                                                            |
| -------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [spatial-indexing-researcher](agents/spatial-indexing-researcher.md) | Runs an experiment end to end: hypothesis, measurement, resolution |
