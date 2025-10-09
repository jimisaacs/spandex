import { testAsciiSnapshotAxioms, type TestConfig, testSpatialIndexAxioms } from '../src/conformance/mod.ts';
import RStarTreeImpl from '../src/implementations/rstartree.ts';

const config: TestConfig = {
	name: 'RStarTreeImpl',
	implementation: () => new RStarTreeImpl(),
};

testSpatialIndexAxioms(config);
testAsciiSnapshotAxioms(config);
