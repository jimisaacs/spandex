import { testImplementationEquivalence, testSpatialIndexAxioms } from '../../../src/conformance/mod.ts';
import ArrayBufferRTreeImpl from '../../src/implementations/superseded/arraybufferrtree.ts';
import LinearScanImpl from '../../src/implementations/superseded/linearscan.ts';

testSpatialIndexAxioms({
	reference: LinearScanImpl,
	implementation: ArrayBufferRTreeImpl,
	name: 'ArrayBufferRTreeImpl',
});

testImplementationEquivalence({
	reference: LinearScanImpl,
	implementation: ArrayBufferRTreeImpl,
	name: 'ArrayBufferRTreeImpl (vs LinearScan)',
});
