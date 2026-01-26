# Implementation Lifecycle

Managing implementations in the spatial indexing library.

## Adding a New Implementation

### 1. Create the implementation

Create `packages/@jim/spandex/src/index/newimpl.ts` implementing `SpatialIndex<T>`:

```typescript
import type { ExtentResult, QueryResult, Rectangle, SpatialIndex } from '../types.ts';

/**
 * NewImpl: Brief description
 *
 * **Complexity**: O(?)
 * **Memory**: ?
 * **Best for**: ?
 *
 * @returns New spatial index instance
 */
export default function createNewImplIndex<T>(): SpatialIndex<T> {
	return new NewImplImpl<T>();
}

class NewImplImpl<T> implements SpatialIndex<T> {
	insert(bounds: Readonly<Rectangle>, value: T): void {
		// ... implementation
	}

	*query(bounds?: Readonly<Rectangle>): IterableIterator<QueryResult<T>> {
		// ... implementation
	}

	extent(): ExtentResult {
		// ... implementation
	}
}
```

**Note**: Also update `packages/@jim/spandex/deno.json` exports if using subpath imports:

```json
{
	"exports": {
		"./index/newimpl": "./src/index/newimpl.ts"
	}
}
```

### 2. Create tests

Create test directory `packages/@jim/spandex/test/index/newimpl/` with three test files:

**`property.test.ts`** - Core axioms:

```typescript
import createNewImplIndex from '@jim/spandex/index/newimpl';
import { testPropertyAxioms } from '@local/spandex-testing/axiom';

Deno.test('NewImpl - Property Axioms', async (t) => {
	await testPropertyAxioms(t, createNewImplIndex);
});
```

**`geometry.test.ts`** - Geometric operations:

```typescript
import createNewImplIndex from '@jim/spandex/index/newimpl';
import { asciiStringCodec, createFixtureGroup } from '@local/snapmark';
import { testGeometryAxioms } from '@local/spandex-testing/axiom';

Deno.test('NewImpl - Geometry Axioms', async (t) => {
	const { assertMatch, flush } = createFixtureGroup(asciiStringCodec(), {
		context: t,
		filePath: new URL('../../fixtures/geometry-test.md', import.meta.url),
	});

	await testGeometryAxioms(t, createNewImplIndex, assertMatch);

	await flush();
});
```

**`visual.test.ts`** - ASCII visualization snapshots:

```typescript
import createNewImplIndex from '@jim/spandex/index/newimpl';
import { asciiStringCodec, createFixtureGroup } from '@local/snapmark';
import { testVisualAxioms } from '@local/spandex-testing/axiom';

Deno.test('NewImpl - Visual Axioms', async (t) => {
	const { assertMatch, flush } = createFixtureGroup(asciiStringCodec(), {
		context: t,
		filePath: new URL('../../fixtures/visual-test.md', import.meta.url),
	});

	await testVisualAxioms(t, createNewImplIndex, assertMatch);

	await flush();
});
```

### 3. Generate fixtures

```bash
# For new implementation (replace 'newimpl' with your implementation name)
UPDATE_FIXTURES=1 deno test -A packages/@jim/spandex/test/index/newimpl/

# Or for existing implementations
UPDATE_FIXTURES=1 deno task test:morton
UPDATE_FIXTURES=1 deno task test:rstartree
```

Review generated `packages/@jim/spandex/test/fixtures/*.md` files.

### 4. Verify

```bash
deno task test              # All tests pass
deno task check             # Type-checking passes
deno task bench:update      # Regenerate BENCHMARKS.md (~2 min)
```

### 5. Document

Update `docs/analyses/` with findings.

## Archiving an Implementation

### Automated Script (Recommended)

```bash
deno task archive:impl <Name> <category>
# Example: deno task archive:impl HybridRTree failed-experiments
```

**Categories**: `superseded` | `failed-experiments`

**What the script does:**

1. Moves files to `archive/src/implementations/<category>/`
2. Adds archive documentation header
3. Updates imports
4. Verifies type-checking

**Note**: Script creates archive directories. These may be removed later (code preserved in git history).

### Manual Archiving Process

**1. Use archive script first** (recommended), then:

**2. Document the implementation:**

Add entry to `archive/IMPLEMENTATION-HISTORY.md` with:

- Git SHA where code last exists (current commit)
- Date archived
- What replaced it (if superseded)
- Why archived
- Performance data (benchmark wins)
- Link to analysis document

**3. Create analysis document:**

If not already done, create `archive/docs/experiments/[name]-experiment.md` documenting the hypothesis, methodology, results, and conclusion.

**4. Regenerate benchmarks:**

```bash
deno task bench:update      # Quick update (~2 min)
deno task bench:analyze 5 docs/analyses/benchmark-statistics.md  # Full stats (~30 min)
```

**5. Commit with archive documentation:**

```bash
git add archive/
git commit -m "archive: Move <Name> to archive/<category> - <reason>"
# Record this commit SHA in archive/IMPLEMENTATION-HISTORY.md
```

**6. Optional: Remove archived code from filesystem**

```bash
# After documenting in IMPLEMENTATION-HISTORY.md with git SHA
git rm -r archive/src/implementations/<category>/<name>.ts
git rm -r archive/test/<category>/
git commit -m "cleanup: Remove archived code from filesystem (preserved in git history)"
```

## Retrieving Archived Code

**Current approach**: Archived implementation code is removed from filesystem, preserved in git history.

**1. Find the git SHA:**

Check `archive/IMPLEMENTATION-HISTORY.md` for the commit SHA where code last existed.

**2. View archived files:**

```bash
# View implementation at specific commit
git show 454e5c9:archive/src/implementations/superseded/hilbertlinearscan.ts

# View all archived implementations at that commit
git show 454e5c9:archive/src/implementations/
```

**3. Restore for benchmarking:**

```bash
# Restore entire archive directory as it was at that commit
git checkout 454e5c9 -- archive/

# Now you can run archived benchmarks
deno bench archive/benchmarks/morton-vs-hilbert.ts
# Or use --include-archived flag
deno task bench:archived

# Clean up when done
git restore archive/
```

**4. Extract for comparison:**

```bash
# Extract to temporary location
git show 454e5c9:archive/src/implementations/superseded/hilbertlinearscan.ts > /tmp/hilbert.ts
```

## Restoring an Archived Implementation to Active

**Option 1: From git history (recommended)**

```bash
# 1. Find SHA in archive/IMPLEMENTATION-HISTORY.md
# 2. Extract files
git show <SHA>:archive/src/implementations/<category>/<name>.ts > packages/@jim/spandex/src/index/<name>.ts
git show <SHA>:archive/test/<category>/<name>.test.ts > packages/@jim/spandex/test/index/<name>.test.ts

# 3. Update imports, remove archive headers
# 4. Verify
deno task test
deno task bench:update
```

**Option 2: Using unarchive script (if files exist in archive/)**

```bash
deno task unarchive:impl <Name> <category>
# Only works if files are temporarily restored to archive/src/implementations/
```

## Quick Reference

| Task                          | Command                                                               |
| ----------------------------- | --------------------------------------------------------------------- |
| Add implementation            | Create file in `packages/@jim/spandex/src/index/`, create tests       |
| Archive implementation        | `deno task archive:impl <Name> <category>`                            |
| Restore implementation        | `deno task unarchive:impl <Name> <category>`                          |
| View archived code            | `git show <SHA>:path/to/file.ts` (SHA from IMPLEMENTATION-HISTORY.md) |
| List active implementations   | `ls packages/@jim/spandex/src/index/`                                 |
| List archived implementations | See `archive/IMPLEMENTATION-HISTORY.md`                               |

## Best Practices

1. Document why archived
2. Benchmark before archiving
3. Update `docs/analyses/`
4. Commit conventions: `feat:`, `archive:`, `unarchive:`

## See Also

- [Archive Management](../archive/README.md)
- [Documentation Structure](./README.md)
