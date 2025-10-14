import { RStarTreeImpl } from '@jim/spandex';
import { testVisualAxioms } from '@local/spandex-testing/axiom';

Deno.test(`RStarTreeImpl - Snapshot Tests`, async (t) => {
	await testVisualAxioms(
		t,
		new URL('../fixtures/visual-test.md', import.meta.url),
		() => new RStarTreeImpl<string>(),
	);
});
