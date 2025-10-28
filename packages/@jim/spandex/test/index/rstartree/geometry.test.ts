import createRStarTreeIndex from '@jim/spandex/index/rstartree';
import { testGeometryAxioms } from '@local/spandex-testing/axiom';

Deno.test('RStarTreeImpl - Snapshot Tests', async (t) => {
	await testGeometryAxioms(
		t,
		new URL('../fixtures/geometry-test.md', import.meta.url),
		createRStarTreeIndex<string>,
	);
});
