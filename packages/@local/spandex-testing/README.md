# @local/spandex-testing

Conformance tests for [@jim/spandex](https://jsr.io/@jim/spandex) implementations.

```typescript
import { testGeometryAxioms, testPropertyAxioms, testVisualAxioms } from '@local/spandex-testing/axiom';

Deno.test('MyImpl - Properties', async (t) => {
	await testPropertyAxioms(t, () => new MyImpl<string>());
});

Deno.test('MyImpl - Geometry', async (t) => {
	await testGeometryAxioms(
		t,
		new URL('./fixtures/geometry.md', import.meta.url),
		() => new MyImpl<string>(),
	);
});
```

**Axioms**: Property (LWW, no duplicates), Geometry (disjointness, ≤4 fragments), Visual (ASCII snapshots), Cross-implementation (1375-fragment canonical)

**Other exports**: `createRegressionScenarios()`, `validateRoundTrip()`, `assertInvariants()`

**Fixtures**: `UPDATE_FIXTURES=1 deno test`

**License**: MIT
