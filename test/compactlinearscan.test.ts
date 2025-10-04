/// <reference types="@types/google-apps-script" />

import { type TestConfig, testImplementationEquivalence } from '../src/conformance/mod.ts';
import CompactLinearScanImpl from '../src/implementations/compactlinearscan.ts';
import LinearScanImpl from '../archive/src/implementations/superseded/linearscan.ts';

const referenceTestConfig: TestConfig = {
	reference: LinearScanImpl,
	implementation: CompactLinearScanImpl,
	name: 'CompactLinearScanImpl (vs LinearScan)',
};

testImplementationEquivalence(referenceTestConfig);
