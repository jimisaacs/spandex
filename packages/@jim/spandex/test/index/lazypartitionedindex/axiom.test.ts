import createLazyPartitionedIndex from '@jim/spandex/index/lazypartitionedindex';
import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
import { testPartitionedAxioms } from '@local/spandex-testing/axiom';

Deno.test('LazyPartitionedIndex - Partitioned Axioms', async (t) => {
	await testPartitionedAxioms(t, createLazyPartitionedIndex, createMortonLinearScanIndex);
});
