# spandex — Claude Code Overlay

This directory is a Claude-shaped overlay over [`.agents/`](../.agents/), where
the canonical agent guidance lives.

- `rules` is one directory symlink to [`.agents/rules`](../.agents/rules), not
  per-rule files. Cursor needs per-rule `.mdc` symlinks because that is what its
  loader discovers; Claude reads the whole directory.
- `skills` and `agents` are symlinks to the matching `.agents/` directories.

Claude reads [`CLAUDE.md`](../CLAUDE.md) at the root, which is a symlink to
[`AGENTS.md`](../AGENTS.md), the shared entry point.

Edit canonical guidance under `.agents/`; keep this overlay thin.
`deno task meta-check` verifies the symlink shape.
