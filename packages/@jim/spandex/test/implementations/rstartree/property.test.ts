import { RStarTreeImpl } from '@jim/spandex';
import { testPropertyAxioms } from '@local/spandex-testing/axiom';

Deno.test(`RStarTreeImpl - Property Axioms`, async (t) => {
	await testPropertyAxioms(t, () => new RStarTreeImpl<string>());
});
