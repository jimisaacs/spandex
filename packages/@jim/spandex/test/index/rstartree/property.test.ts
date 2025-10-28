import createRStarTreeIndex from '@jim/spandex/index/rstartree';
import { testPropertyAxioms } from '@local/spandex-testing/axiom';

Deno.test(`RStarTreeImpl - Property Axioms`, async (t) => {
	await testPropertyAxioms(t, createRStarTreeIndex<string>);
});
