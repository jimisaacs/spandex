import { testImplementationEquivalence, testSpatialIndexAxioms } from '../../../src/conformance/mod.ts';
import ArrayBufferLinearScanImpl from '../../src/implementations/superseded/arraybufferlinearscan.ts';
import LinearScanImpl from '../../src/implementations/superseded/linearscan.ts';

testSpatialIndexAxioms({
	reference: LinearScanImpl,
	implementation: ArrayBufferLinearScanImpl,
	name: 'ArrayBufferLinearScanImpl',
});

testImplementationEquivalence({
	reference: LinearScanImpl,
	implementation: ArrayBufferLinearScanImpl,
	name: 'ArrayBufferLinearScanImpl (vs LinearScan)',
});
