---
description: 'Readable prose for human docs, plus the Markdown rules deno fmt forces here.'
globs: **/*.md
---

# spandex — Documentation Voice

## Audience Split

Human docs explain the system to a person. Agent scaffolding instructs an
executor. Do not mix the two voices.

| Audience | Surfaces                                                                                                       |
| -------- | -------------------------------------------------------------------------------------------------------------- |
| Humans   | `README.md`, `PRODUCTION-GUIDE.md`, `CONTRIBUTING.md`, all of `docs/**`, package READMEs, JSDoc on public APIs |
| Agents   | `.agents/**`, plus `AGENTS.md` and its `CLAUDE.md` symlink as the entry point                                  |

Human pages name the product in sentences a newcomer can follow. Agent
scaffolding may be terse and imperative, because its reader is executing rather
than learning. `meta-check` rejects an `.agents/` link on a human first-read
page; `CONTRIBUTING.md` may still route contributors to the executor rules.

## Write Like This

Docs are one person explaining the system to another. A reader should be able to
follow the prose out loud and have it sound like speech.

- **Lead with the conclusion.** "Morton is 25% faster. Here's why" beats four
  paragraphs building to it.
- Use full sentences with a subject and a verb. If a line cannot be read aloud
  as speech, it is not finished.
- Keep one idea per sentence. When three clauses have stacked up behind
  em-dashes, split them into separate sentences.
- Introduce a name before leaning on it. "The adapter converts at the API
  boundary" reads like speech; "boundary conversion: adapter" does not.
- Put the reason in the sentence. If a clause only makes sense once the reader
  opens the analysis you cited, state the reason in words and then cite it.
- Use high-density formats where they fit: tables for comparisons, bullets for
  parallel facts, code blocks for concrete examples.

**Decision docs** answer "how do I choose", not "what did we choose":

```markdown
✅ ## When to Use X

- n < 100 → use linear scan
- n ≥ 100 → use a tree

❌ ## Our Choice
We chose X because...
```

**Example code is concrete and runnable**, never `createSomeIndex<T>()`.

## Not Like This

These are the tells that prose has drifted into a private notation:

- **Saying it twice.** The commonest drift is stating an idea, restating it in
  different words, then qualifying it. Each idea gets said once, well, and small
  topics stay small.
- **The sentence that never ends.** Four ideas joined by semicolons is not one
  sentence. `meta-check` refuses a sentence past 250 characters, which is well
  past the point a reader has lost the thread.
- **Self-awarded praise.** Prose that calls the project's own approach
  "elegant", "rigorous", or "blazing" is congratulation, not information. State
  the measurement and let the reader judge.
- **A costly word where a plain one says the same thing.** Write "use" rather
  than "utilize", "before" rather than "prior to". Some terms — Morton code,
  fragmentation, disjointness — are the precise word and stay. The test is
  whether a first-time reader gains anything from the harder word.
- **Arrows as connective tissue**, such as "overlap → decompose → store". Write
  "an overlap decomposes the existing rectangle, then stores the new one." An
  arrow is fine inside an actual flow diagram on its own line.
- **The em-dash as a default connector.** Two uses earn it: a matched pair
  standing in for parentheses, and a single dash for a turn a comma cannot
  carry. If a comma, period, colon, or parentheses would carry the sentence as
  well, the dash has not earned its place. `meta-check` rejects the two
  spellings habit reaches for most, `— which` and `— and then`.
- **Telegraphic fragments with the verb cut out**: "Bounded fragmentation.
  Linear. Validated."
- **Bare citation dumps** like "(Guttman 1984)" dropped in with no sentence
  saying what it means. Make the point in words first, then cite.
- **Square brackets around a code span with no link target.** That is rustdoc's
  syntax; nothing here resolves it, so it renders as literal brackets around
  dead text. `meta-check` rejects the form.

## Markdown Standards

Syntax follows the
[Google Markdown Style Guide](https://google.github.io/styleguide/docguide/style.html)
and [CommonMark](https://commonmark.org/). Most of it is ordinary, but two rules
are repository-specific and `deno fmt` will actively break the code if you get
them wrong.

**Never bold an algorithm name ending in an asterisk.** `deno fmt` rewrites
`**R*` into `__R_`, which then renders as italic and corrupts the name. Plain
`R*` followed by a space, hyphen, or punctuation is always safe and is what this
repository uses. `meta-check` rejects the broken spellings.

```markdown
✅ R* split R*-tree `R*` tree
❌ **R*** split __R_ split__
```

**Escape or code-fence underscores in identifiers.** `R_new` may render as
italic when a second underscore follows. Write `` `R_new` `` or `R\_new`.

The rest, briefly: ATX headings (`## Heading`), fenced code blocks with a
language tag, `-` for unordered lists, `**bold**` and `_italic_` rather than the
underscore-doubled forms, `---` for horizontal rules, and lines aimed at 120
characters to match the code width. `deno task fmt` settles the rest.

## Neighbors And Citations

- The work this project builds on — Guttman's R-tree, the R* refinements from
  Beckmann and colleagues, Morton and Hilbert curves — is spoken of only with
  respect. State spandex's own measurements plainly and let the numbers carry
  any ordering.
- Cite an external work at its first mention on a page and leave later mentions
  on that page as plain text.

## Insider Words

Prefer plain words in human prose. Keep task and path names as identifiers and
gloss them once.

| Insider word  | Prefer in prose                                           |
| ------------- | --------------------------------------------------------- |
| gate          | check, verification; as a verb: checks, covers, holds     |
| living-state  | docs that must match today's code                         |
| axiom         | conformance test (keep `axiom` for the actual file names) |
| fixture       | snapshot (keep `fixture` when naming the `.md` files)     |
| the workspace | `docs/active/`, said plainly                              |
