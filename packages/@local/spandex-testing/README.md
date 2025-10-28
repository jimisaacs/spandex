# Spandex Testing

Conformance axioms and test scenarios for `@jim/spandex` implementations.

**Part of**: `@jim/spandex` monorepo (spandex-specific)

Provides: axioms (disjointness, LWW, fragmentation), regression scenarios, test utils.

Uses: `@local/snapmark` for snapshots (general-purpose).

## Quick Start

### Testing an Implementation

```typescript
import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
import { asciiStringCodec, createFixtureGroup } from '@local/snapmark';
import { testGeometryAxioms, testPropertyAxioms, testVisualAxioms } from '@local/spandex-testing/axiom';

// Property axioms (no fixtures needed)
Deno.test('MyImpl - Property Axioms', async (t) => {
	await testPropertyAxioms(t, createMortonLinearScanIndex<string>);
});

// Geometry axioms (with ASCII snapshot fixtures)
Deno.test('MyImpl - Geometry Axioms', async (t) => {
	const { assertMatch, flush } = createFixtureGroup(asciiStringCodec(), {
		context: t,
		filePath: new URL('./fixtures/geometry-test.md', import.meta.url),
	});

	await testGeometryAxioms(t, createMortonLinearScanIndex<string>, assertMatch);

	await flush();
});

// Visual axioms (similar pattern)
```

This runs all conformance axioms against your implementation.

## Architecture

```
src/
├── axiom/                     # Conformance test axioms
│   ├── geometry.ts            # Geometric correctness (disjointness, decomposition)
│   ├── properties.ts          # LWW semantics, invariants
│   ├── visual.ts              # ASCII snapshot tests
│   ├── canonical-values.ts    # Fragment count verification
│   └── cross-implementation.ts # Consistency validation
├── fixture/codec/             # Spandex-specific codecs
│   └── ascii.ts               # ASCII spatial index codec
├── ascii/                     # ASCII rendering utilities
│   ├── render.ts              # Grid visualization
│   ├── parse.ts               # Parse ASCII → SpatialIndex
│   └── fixtures.ts            # ASCII fixture helpers
└── utils.ts                   # Helper utilities
```

This package uses `@local/snapmark` for snapshot testing. Snapmark is a general-purpose markdown-based fixture framework (not spandex-specific).

## Testing Axioms

The framework organizes tests into modular axioms:

### Geometry Axioms

Geometric correctness properties:

- **Disjointness**: No overlapping rectangles after any operation
- **Decomposition bounds**: Each insert creates ≤4 fragments per overlap
- **Empty state**: New index has no ranges
- **Query correctness**: Query results match expected bounds

### Property Axioms

Behavioral correctness:

- **Last-Writer-Wins**: Later inserts overwrite earlier ones in overlaps
- **Non-duplication**: No duplicate (bounds, value) pairs
- **Idempotence**: Inserting same range twice = inserting once

### Visual Axioms

ASCII snapshot tests for visual regression testing:

```
5x5 grid with single cell:
. . . . .
. . . . .
. . X . .
. . . . .
. . . . .
```

Visual tests catch coordinate bugs that invariant tests might miss.

### Canonical Values

Fragment count verification across implementations - ensures all implementations produce identical decompositions.

### Cross-Implementation

Validates consistency between implementations using a reference implementation as oracle.

## Snapshot Testing Framework

This package uses `@local/snapmark` for markdown-based snapshot testing. Common snapshot testing functions are re-exported for convenience.

### Basic Usage

```typescript
import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
import { createRenderer } from '@jim/spandex-ascii';
import { asciiStringCodec, createFixtureGroup } from '@local/snapmark';

Deno.test('My Tests', async (t) => {
	const { assertMatch, flush } = createFixtureGroup(asciiStringCodec(), {
		context: t,
		filePath: new URL('./fixtures/my-tests.md', import.meta.url),
	});

	await t.step('Single Cell', async (step) => {
		const index = createMortonLinearScanIndex<string>();
		index.insert([2, 2, 2, 2], 'X');

		const { render } = createRenderer();
		const actual = render(index, { legend: { 'X': 'X' } });

		// Name auto-inferred from step
		await assertMatch(actual, { context: step });
	});

	// Write updates if UPDATE_FIXTURES=1
	await flush();
});
```

### Update Mode

When tests fail due to intentional changes:

```bash
UPDATE_FIXTURES=1 deno test
```

This regenerates the markdown fixtures with current output.

### Fixture Markdown Format

Fixtures are stored as markdown with fenced code blocks:

````markdown
## Single Cell

**Purpose**: tests single point insertion

```
. . . . .
. . . . .
. . X . .
. . . . .
. . . . .
```
````

### Auto-Inference

The framework automatically:

- Extracts test names from `Deno.test()` and `t.step()` context
- Infers purpose from test names (e.g., "Single Cell - tests X" → purpose: "tests X")
- Handles round-trip testing (encode → decode → verify)

### Custom Codecs

Create custom codecs for different data formats:

```typescript
import type { FixtureCodec } from '@local/snapmark';

const myCodec: FixtureCodec<MyType> = {
	encode: (data) => {
		// Convert MyType → string
		return string;
	},
	decode: (content) => {
		// Convert string → MyType
		return myData;
	},
	languageTag: 'custom', // Optional: for syntax highlighting
};
```

## ASCII Rendering

Visualize spatial indexes as ASCII grids:

```typescript
import { createRenderer } from '@jim/spandex-ascii';

const { render } = createRenderer();
const grid = render(index, { legend: { 'A': 'A', 'B': 'B' } });
console.log(grid);
// Output:
// A A A . .
// A A A . .
// . . B B B
// . . B B B
//
// Legend:
// A = "A"
// B = "B"
```

This is useful for debugging and documentation.

## Running Tests

```bash
# Run all tests
deno task test

# Run specific test file
deno test packages/@local/spandex-testing/test/fixtures-example.test.ts

# Update fixtures
UPDATE_FIXTURES=1 deno test

# Watch mode
deno task test:watch
```

## Design Philosophy

### Axiom-Based Testing

We test **what must be true** (mathematical properties), not **how it's implemented** (code coverage).

Benefits:

- Implementation-agnostic (same tests for all algorithms)
- Catches subtle bugs (coordinate errors, edge cases)
- Documents correctness guarantees
- Enables cross-implementation validation

### Visual Regression

ASCII snapshots provide:

- Human-readable test expectations
- Easy visual debugging
- Catch coordinate bugs that invariant tests miss
- Living documentation

### Fixture Framework

Benefits:

- Test expectations live in markdown (readable, diffable)
- Update mode prevents tedious manual updates
- Auto-inference reduces boilerplate
- Custom codecs support different data formats

## Testing Best Practices

1. **Use axioms for correctness** - Run all axioms against new implementations
2. **Use fixtures for regression** - Snapshot important behaviors
3. **Use ASCII rendering for debugging** - Visualize when tests fail
4. **Update fixtures carefully** - Always verify diffs before committing
5. **Test edge cases** - Empty ranges, boundary conditions, maximum coordinates

## See Also

- [Implementation Lifecycle](../../../docs/IMPLEMENTATION-LIFECYCLE.md) - Adding and testing implementations
- [Testing Philosophy](../../../docs/core/RESEARCH-SUMMARY.md#testing-philosophy) - Why axiom-based testing
- [Example Tests](./test/) - Real-world examples
