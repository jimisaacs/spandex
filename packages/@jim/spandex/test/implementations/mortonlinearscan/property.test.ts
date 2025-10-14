import { MortonLinearScanImpl } from '@jim/spandex';
import { testPropertyAxioms } from '@local/spandex-testing/axiom';

Deno.test(`MortonLinearScanImpl - Property Axioms`, async (t) => {
	await testPropertyAxioms(t, () => new MortonLinearScanImpl<string>());
});
