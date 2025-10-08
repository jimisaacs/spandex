import { testSpatialIndexAxioms } from '../../../src/conformance/mod.ts';
import RStarTreeImpl from '../../../src/implementations/rstartree.ts';
import CompactMortonLinearScanImpl from '../../src/implementations/superseded/compactmortonlinearscan.ts';

testSpatialIndexAxioms({
	reference: RStarTreeImpl,
	implementation: CompactMortonLinearScanImpl,
	name: 'CompactMortonLinearScanImpl',
});
