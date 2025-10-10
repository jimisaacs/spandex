import { RStarTreeImpl } from '@jim/spandex';
import {
	createFixtureLoader,
	testAsciiSnapshotAxioms,
	type TestConfig,
	testSpatialIndexAxioms,
} from '@local/spandex-testing';

const config: TestConfig = {
	name: 'RStarTreeImpl',
	implementation: () => new RStarTreeImpl(),
};

testSpatialIndexAxioms(config);

const loadFixture = createFixtureLoader(new URL('./fixtures/conformance-test.md', import.meta.url));
testAsciiSnapshotAxioms(config, loadFixture);
