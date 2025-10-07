import { testSpatialIndexAxioms } from '../src/conformance/mod.ts';
import RTreeImpl from '../src/implementations/rtree.ts';
import CompactMortonLinearScanImpl from '../src/implementations/compactmortonlinearscan.ts';

testSpatialIndexAxioms({
	reference: RTreeImpl,
	implementation: CompactMortonLinearScanImpl,
	name: 'CompactMortonLinearScanImpl',
});
