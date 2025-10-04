/// <reference types="@types/google-apps-script" />

import { type TestConfig, testSpatialIndexAxioms } from '../../src/conformance/mod.ts';
import LinearScanImpl from '../src/implementations/superseded/linearscan.ts';
import HybridRTreeImpl from '../src/implementations/failed-experiments/hybridrtree.ts';

const config: TestConfig = {
	reference: LinearScanImpl,
	implementation: HybridRTreeImpl,
	name: 'HybridRTreeImpl',
};

testSpatialIndexAxioms(config);
