import { testAsciiSnapshotAxioms, type TestConfig, testSpatialIndexAxioms } from '../src/conformance/mod.ts';
import MortonLinearScanImpl from '../src/implementations/mortonlinearscan.ts';

const config: TestConfig = {
	name: 'MortonLinearScanImpl',
	implementation: () => new MortonLinearScanImpl(),
};

testSpatialIndexAxioms(config);
testAsciiSnapshotAxioms(config);
