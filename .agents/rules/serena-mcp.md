# spandex — Serena MCP Discipline

Serena is the symbol-aware tool for this TypeScript codebase. It is configured
by [`.serena/project.yml`](../../.serena/project.yml) and started over stdio
from [`.mcp.json`](../../.mcp.json). Its local cache, logs, and memories are
ignored by git.

## Use Serena First For Symbols

Reach for Serena before text search when the task is about code symbols:

| Task                            | Tool                                           |
| ------------------------------- | ---------------------------------------------- |
| Map a file                      | `get_symbols_overview`                         |
| Find a declaration              | `find_symbol`, `find_declaration`              |
| Find callers of a symbol        | `find_referencing_symbols`                     |
| Find implementations            | `find_implementations`                         |
| Rename a symbol                 | `rename_symbol`                                |
| Replace a function or type body | `replace_symbol_body`                          |
| Insert adjacent code            | `insert_before_symbol` / `insert_after_symbol` |
| Delete a symbol safely          | `safe_delete_symbol`                           |
| Check one file while iterating  | `get_diagnostics_for_file`                     |

Use ordinary file tools for prose, JSON config, exact string scans, edits whose
location you already know, and broad repository inventory.

Two uses earn their keep repeatedly here. `find_implementations` on
`SpatialIndex` enumerates every implementation the axiom suite must cover, and
`find_referencing_symbols` before changing a published export shows what a
version bump would affect. The
[doc-drift](doc-drift.md) rule asks you to grep an old name across the tree
after a rename; `rename_symbol` plus that grep is the pair that actually
finishes the job, because Serena moves the code and the grep catches the prose.

## Constraints

`get_symbols_overview` takes a file path, never a directory: list the files
first and call it per file. `find_symbol` matches a `name_path_pattern`; the
other symbol tools take an exact `name_path`. Use `depth=1` on a class or
interface to see its members before pulling any bodies, because reading a whole
large type returns far more than the question needed.

Serena's diagnostics are an iteration aid, not the check. Verify finished work
with `deno task hooks:pre-commit`.
