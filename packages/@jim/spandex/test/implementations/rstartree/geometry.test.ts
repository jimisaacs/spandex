import { RStarTreeImpl } from '@jim/spandex';
import { testGeometryAxioms } from '@local/spandex-testing/axiom';

Deno.test('RStarTreeImpl - Snapshot Tests', async (t) => {
	await testGeometryAxioms(
		t,
		new URL('../fixtures/geometry-test.md', import.meta.url),
		() => new RStarTreeImpl<string>(),
	);
});
