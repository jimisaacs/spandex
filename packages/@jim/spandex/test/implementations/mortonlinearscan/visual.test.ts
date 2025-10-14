import { MortonLinearScanImpl } from '@jim/spandex';
import { testVisualAxioms } from '@local/spandex-testing/axiom';

Deno.test(`MortonLinearScanImpl - Snapshot Tests`, async (t) => {
	await testVisualAxioms(
		t,
		new URL('../fixtures/visual-test.md', import.meta.url),
		() => new MortonLinearScanImpl<string>(),
	);
});
