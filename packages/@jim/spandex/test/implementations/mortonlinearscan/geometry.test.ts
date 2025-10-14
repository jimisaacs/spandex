import { MortonLinearScanImpl } from '@jim/spandex';
import { testGeometryAxioms } from '@local/spandex-testing/axiom';

Deno.test('MortonLinearScanImpl - Snapshot Tests', async (t) => {
	await testGeometryAxioms(
		t,
		new URL('../fixtures/geometry-test.md', import.meta.url),
		() => new MortonLinearScanImpl<string>(),
	);
});
