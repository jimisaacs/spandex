import { testAsciiSnapshotAxioms, type TestConfig, testSpatialIndexAxioms } from '../src/conformance/mod.ts';
import RStarTreeImpl from '../src/implementations/rstartree.ts';

/**
 * R*-Tree Implementation Tests
 *
 * Validates R*-tree satisfies all spatial index axioms.
 */

const config: TestConfig = {
	implementation: () => new RStarTreeImpl(),
	name: 'RStarTreeImpl',
};

testSpatialIndexAxioms(config);
testAsciiSnapshotAxioms(config);
