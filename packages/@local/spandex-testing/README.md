# @local/spandex-testing

**Dev-only**: Test axioms and scenarios for [@jim/spandex](https://jsr.io/@jim/spandex) implementations.

Not published to JSR. Used internally to validate correctness.

**Provides**: Conformance axioms (disjointness, LWW, fragmentation bounds), regression scenarios

**Uses**: `@local/snapmark` for snapshot testing

## Usage

```typescript
import { testGeometryAxioms, testPropertyAxioms } from '@local/spandex-testing/axiom';
import { asciiStringCodec, createFixtureGroup } from '@local/snapmark';

// Property axioms - no fixtures
Deno.test('MyImpl - Properties', async (t) => {
	await testPropertyAxioms(t, () => new MyImpl<string>());
});

// Geometry axioms - with ASCII snapshots
Deno.test('MyImpl - Geometry', async (t) => {
	const { assertMatch, flush } = createFixtureGroup(asciiStringCodec(), {
		context: t,
		filePath: new URL('./fixtures/geometry.md', import.meta.url),
	});

	await testGeometryAxioms(t, () => new MyImpl<string>(), assertMatch);
	await flush();
});
```

## Axioms

**Geometry** - Disjointness, decomposition bounds (≤4 fragments per overlap), query correctness

**Properties** - Last-Writer-Wins, no duplicates, idempotence

**Visual** - ASCII snapshot regression tests (catches coordinate bugs)

**Canonical Values** - Fragment count consistency across implementations

**Cross-Implementation** - Validate against reference oracle

## Fixtures

Snapshot tests use `@local/snapmark` for markdown storage:

```bash
UPDATE_FIXTURES=1 deno test  # Regenerate snapshots
```

Fixtures stored as markdown with fenced code blocks - readable, diffable, version-controllable.

## Related

- [@jim/spandex](https://jsr.io/@jim/spandex) - Core library being tested
- [@jim/spandex-ascii](https://jsr.io/@jim/spandex-ascii) - Used for ASCII visualization in tests
- `@local/snapmark` - Snapshot testing framework
- [Implementation Lifecycle](../../../docs/IMPLEMENTATION-LIFECYCLE.md) - Adding implementations
- [Example Tests](./test/) - Real usage
