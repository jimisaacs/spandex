# Implementation Lifecycle Guide

Quick reference for managing implementations in this research project.

## Adding a New Implementation

### 1. Create the implementation

Requirements: Implement `SpatialIndex<T>`, add JSDoc comments, use `implements` keyword

```typescript
/// <reference types="@types/google-apps-script" />

import type { SpatialIndex } from '../conformance/testsuite.ts';

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

Create `test/newimpl.test.ts`:

```typescript
import { testImplementationEquivalence, testSpatialIndexAxioms } from '../src/conformance/mod.ts';
import LinearScanImpl from '../src/implementations/linearscan.ts';
import NewImpl from '../src/implementations/newimpl.ts';

testSpatialIndexAxioms({
	reference: LinearScanImpl,
	implementation: NewImpl,
	name: 'NewImpl',
});
```

### 3. Verify

All tests pass, benchmarks regenerated, type-checking passes. Benchmarks auto-discover from `src/implementations/`.

See `deno.json` for available tasks.

### 4. Document

Update `docs/analyses/` with findings.

---

## Archiving an Implementation

### Automated Script

Use the archiving script (see `deno.json` for task name). Categories: `superseded` | `failed-experiments`

The script moves files, fixes imports, adds docs header.

### Manual Process

**1. Move files:**

```bash
# Move implementation
mv src/implementations/X.ts archive/src/implementations/[category]/X.ts

# Move tests
mv test/X.test.ts archive/test/[category]/X.test.ts
```

**2. Add archive header:**

Add to top of archived file (after `/// <reference>` if present):

```typescript
/**
 * ARCHIVED: YYYY-MM-DD
 * Category: superseded | failed-experiments
 * Reason: [Explain why archived - performance data, validation failure, etc.]
 *
 * This implementation has been moved to the archive.
 * It remains runnable for historical comparison but is not
 * included in the main benchmark suite.
 */
```

**3. Regenerate benchmarks:**

After archiving, regenerate the benchmarks (they auto-discover active implementations). See `deno.json` for tasks.

```bash
deno task bench:update
```

---

## Restoring an Archived Implementation

Use the unarchiving script (see `deno.json`). It moves files back and removes archive header. Then verify tests pass and regenerate benchmarks.

---

## Comparing Against Archived Implementations

You can create one-off benchmarks that compare active vs archived implementations:

**Example:** `archive/benchmarks/my-comparison.ts`

```typescript
/// <reference types="@types/google-apps-script" />

// Import active implementations directly
import MortonLinearScanImpl from '../../src/implementations/mortonlinearscan.ts';
import RStarTreeImpl from '../../src/implementations/rstartree.ts';

// Import archived implementation directly
import ArchivedImpl from '../src/implementations/superseded/archivedimpl.ts';

const implementations = [
	{ name: 'RStarTree', Class: RStarTreeImpl },
	{ name: 'MortonLinearScan', Class: MortonLinearScanImpl },
	{ name: 'ArchivedImpl', Class: ArchivedImpl },
];

// ... benchmark code
```

**Run:**

```bash
deno bench archive/benchmarks/my-comparison.ts
```

---

## Quick Reference

| Task                          | Command                                             |
| ----------------------------- | --------------------------------------------------- |
| Add implementation            | Create file in `src/implementations/`, create tests |
| Archive implementation        | `deno task archive:impl <Name> <category>`          |
| Restore implementation        | `deno task unarchive:impl <Name> <category>`        |
| Run archived benchmark        | `deno bench archive/benchmarks/name.ts`             |
| List active implementations   | `ls src/implementations/`                           |
| List archived implementations | `ls archive/src/implementations/*/`                 |

---

## Best Practices

1. Document WHY archived, not just what
2. Keep archives runnable
3. Benchmark before archiving
4. Update `docs/analyses/`
5. Clean commits: `feat:`, `archive:`, `unarchive:`

---

See also:

- `.cursorrules` - Full project rules and conventions
- `archive/README.md` - Archive structure and management
- `docs/README.md` - Documentation organization
