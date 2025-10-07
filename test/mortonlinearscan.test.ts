import { testSpatialIndexAxioms } from '../src/conformance/testsuite.ts';
import MortonLinearScanImpl from '../src/implementations/mortonlinearscan.ts';
import RTreeImpl from '../src/implementations/rtree.ts';

// Run all conformance tests
testSpatialIndexAxioms({
	name: 'MortonLinearScanImpl',
	implementation: MortonLinearScanImpl,
	reference: RTreeImpl,
});
