# Implementation Lifecycle Guide

Quick reference for managing implementations in this research project.

## Adding a New Implementation

### 1. Create the implementation

Requirements: Implement `SpatialIndex<T>`, add JSDoc comments, use `implements` keyword

```typescript
import type { SpatialIndex } from '../types.ts';

/**
 * NewImpl: Brief description
 *
 * Key characteristics:
 * - Complexity: O(?)
 * - Memory: ?
 * - Use case: ?
 */
export default class NewImpl<T> implements SpatialIndex<T> {
	// ... implementation
}
```

### 2. Create tests

Create test directory `packages/@jim/spandex/test/implementations/newimpl/` with three test files:

**`property.test.ts`** - Core correctness axioms:

```typescript
import { NewImpl } from '@jim/spandex';
import { testPropertyAxioms } from '@local/spandex-testing/axiom';

Deno.test('NewImpl - Property Axioms', async (t) => {
	await testPropertyAxioms(t, () => new NewImpl<string>());
});
```

**`geometry.test.ts`** - Geometric operations with snapshot validation:

```typescript
import { NewImpl } from '@jim/spandex';
import { createFixtureGroup } from '@local/snapmark';
import { asciiStringCodec } from '@local/spandex-testing/ascii';
import { testGeometryAxioms } from '@local/spandex-testing/axiom';

Deno.test('NewImpl - Geometry Axioms', async (t) => {
	const { assertMatch, flush } = createFixtureGroup(asciiStringCodec(), {
		context: t,
		filePath: new URL('../../fixtures/geometry-test.md', import.meta.url),
	});

	await testGeometryAxioms(t, () => new NewImpl<string>(), assertMatch);

	await flush();
});
```

**`visual.test.ts`** - ASCII visualization snapshots:

```typescript
import { NewImpl } from '@jim/spandex';
import { createFixtureGroup } from '@local/snapmark';
import { asciiStringCodec } from '@local/spandex-testing/ascii';
import { testVisualAxioms } from '@local/spandex-testing/axiom';

Deno.test('NewImpl - Visual Axioms', async (t) => {
	const { assertMatch, flush } = createFixtureGroup(asciiStringCodec(), {
		context: t,
		filePath: new URL('../../fixtures/visual-test.md', import.meta.url),
	});

	await testVisualAxioms(t, () => new NewImpl<string>(), assertMatch);

	await flush();
});
```

### 3. Generate fixtures

On first run, or when test behavior changes intentionally:

```bash
# For new implementation (replace 'newimpl' with your implementation name)
UPDATE_FIXTURES=1 deno test -A packages/@jim/spandex/test/implementations/newimpl/

# Or for existing implementations
UPDATE_FIXTURES=1 deno task test:morton
UPDATE_FIXTURES=1 deno task test:rstartree
```

Review generated `packages/@jim/spandex/test/fixtures/*.md` files to ensure snapshots are correct.

### 4. Verify

```bash
deno task test              # All tests pass
deno task check             # Type-checking passes
deno task bench:update      # Regenerate BENCHMARKS.md (~2 min)
```

Benchmarks auto-discover from `packages/@jim/spandex/src/implementations/`.

### 5. Document

Update `docs/analyses/` with findings if this is a research experiment.

---

## Archiving an Implementation

### Automated Script (Recommended)

```bash
deno task archive:impl <Name> <category>
# Example: deno task archive:impl HybridRTree failed-experiments
```

**Categories**: `superseded` | `failed-experiments`

The script moves files, fixes imports, adds archive header, and verifies type-checking.

### Manual Process (Not Recommended)

If you need to archive without using the script:

**1. Document the implementation:**

Add entry to `archive/IMPLEMENTATION-HISTORY.md` with:

- Git SHA where code last exists
- Date archived
- What replaced it (if superseded)
- Why archived
- Performance data (benchmark wins)
- Link to analysis document

**2. Create analysis document:**

If not already done, create `archive/docs/experiments/[name]-experiment.md` documenting the hypothesis, methodology, results, and conclusion.

**3. Remove files:**

```bash
# Remove implementation and tests
git rm packages/@jim/spandex/src/implementations/X.ts
git rm -r packages/@jim/spandex/test/implementations/X/

# Update exports in mod.ts if needed
```

**4. Regenerate benchmarks:**

```bash
deno task bench:update      # Quick update (~2 min)
deno task bench:analyze 5 docs/analyses/benchmark-statistics.md  # Full stats (~30 min)
```

Benchmarks auto-discover active implementations.

---

## Restoring an Archived Implementation

```bash
deno task unarchive:impl <Name> <category>
# Example: deno task unarchive:impl HybridRTree failed-experiments
```

The script moves files back, removes archive header, and verifies type-checking. Then:

```bash
deno task test              # Verify tests pass
deno task bench:update      # Update benchmarks
```

---

## Retrieving Archived Code

Archived implementations have been removed from the repository but are preserved in git history. To access them:

**1. Find the git SHA:**

Check `archive/IMPLEMENTATION-HISTORY.md` for the commit SHA where the code last existed.

**2. View the archived file:**

```bash
# View implementation
git show <SHA>:packages/@jim/spandex/src/implementations/archivedimpl.ts

# View tests
git show <SHA>:packages/@jim/spandex/test/implementations/archivedimpl/
```

**3. Extract for comparison:**

```bash
# Extract to temporary location
git show <SHA>:packages/@jim/spandex/src/implementations/archivedimpl.ts > /tmp/archivedimpl.ts

# Create temporary benchmark
# (manually adjust imports as needed)
```

**Why archived code was removed:** Maintaining legacy implementations requires keeping imports, tests, and type-checking in sync. By preserving only documentation + git history, we avoid maintenance burden while maintaining full reproducibility.

---

## Quick Reference

| Task                          | Command                                                                   |
| ----------------------------- | ------------------------------------------------------------------------- |
| Add implementation            | Create file in `packages/@jim/spandex/src/implementations/`, create tests |
| Archive implementation        | `deno task archive:impl <Name> <category>`                                |
| Restore implementation        | `deno task unarchive:impl <Name> <category>`                              |
| View archived code            | `git show <SHA>:path/to/file.ts` (SHA from IMPLEMENTATION-HISTORY.md)     |
| List active implementations   | `ls packages/@jim/spandex/src/implementations/`                           |
| List archived implementations | See `archive/IMPLEMENTATION-HISTORY.md`                                   |

---

## Best Practices

1. Document WHY archived, not just what
2. Keep archives runnable
3. Benchmark before archiving
4. Update `docs/analyses/`
5. Clean commits: `feat:`, `archive:`, `unarchive:`

---

See also:

- `CLAUDE.md` - Full project rules and conventions
- `archive/README.md` - Archive structure and management
- `docs/README.md` - Documentation organization
