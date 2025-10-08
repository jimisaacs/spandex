import { testSpatialIndexAxioms } from '../src/conformance/testsuite.ts';
import MortonLinearScanImpl from '../src/implementations/mortonlinearscan.ts';
import RStarTreeImpl from '../src/implementations/rstartree.ts';

// Run all conformance tests
testSpatialIndexAxioms({
	name: 'MortonLinearScanImpl',
	implementation: MortonLinearScanImpl,
	reference: RStarTreeImpl,
});
