import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
import { testPropertyAxioms } from '@local/spandex-testing/axiom';

Deno.test(`MortonLinearScanImpl - Property Axioms`, async (t) => {
	await testPropertyAxioms(t, createMortonLinearScanIndex<string>);
});
