import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
import { testGeometryAxioms } from '@local/spandex-testing/axiom';

Deno.test('MortonLinearScanImpl - Snapshot Tests', async (t) => {
	await testGeometryAxioms(
		t,
		new URL('../fixtures/geometry-test.md', import.meta.url),
		createMortonLinearScanIndex<string>,
	);
});
