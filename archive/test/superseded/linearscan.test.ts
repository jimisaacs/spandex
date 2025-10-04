/// <reference types="@types/google-apps-script" />

import { type TestConfig, testSpatialIndexAxioms } from '../../../src/conformance/mod.ts';
import LinearScanImpl from '../../src/implementations/superseded/linearscan.ts';

const config: TestConfig = {
	reference: LinearScanImpl,
	implementation: LinearScanImpl,
	name: 'LinearScanImpl (Self-Test)',
};

testSpatialIndexAxioms(config);
