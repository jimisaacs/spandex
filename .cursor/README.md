# spandex — Cursor Overlay

This directory is a Cursor-shaped overlay over [`.agents/`](../.agents/), where
the canonical agent guidance lives.

- `rules/*.mdc` exposes each canonical rule in the form Cursor discovers. Every
  entry is a symlink to the matching `.agents/rules/*.md`, and the `description`
  and `globs` frontmatter that scopes it lives in that canonical file.
- `skills` is a symlink to [`.agents/skills`](../.agents/skills).
- `mcp.json` launches Serena for this repository.

Cursor also reads [`AGENTS.md`](../AGENTS.md) at the root, the shared entry
point.

Edit canonical guidance under `.agents/`; keep this overlay thin.
`deno task meta-check` verifies the symlink shape.
