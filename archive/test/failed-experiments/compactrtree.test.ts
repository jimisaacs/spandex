import { testImplementationEquivalence, testSpatialIndexAxioms } from '../../../src/conformance/mod.ts';
import CompactRTreeImpl from '../../src/implementations/failed-experiments/compactrtree.ts';
import LinearScanImpl from '../../src/implementations/superseded/linearscan.ts';

testSpatialIndexAxioms({
	reference: LinearScanImpl,
	implementation: CompactRTreeImpl,
	name: 'CompactRTreeImpl',
});

testImplementationEquivalence({
	reference: LinearScanImpl,
	implementation: CompactRTreeImpl,
	name: 'CompactRTreeImpl (vs LinearScan)',
});
