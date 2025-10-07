import { testSpatialIndexAxioms } from '../src/conformance/testsuite.ts';
import MortonLinearScanImpl from '../src/implementations/mortonlinearscan.ts';
import LinearScanImpl from '../archive/src/implementations/superseded/linearscan.ts';

// Run all conformance tests
testSpatialIndexAxioms({
	name: 'MortonLinearScanImpl',
	implementation: MortonLinearScanImpl,
	reference: LinearScanImpl,
});
