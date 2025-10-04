/// <reference types="@types/google-apps-script" />

import { type TestConfig, testImplementationEquivalence } from '../../../src/conformance/mod.ts';
import CompactLinearScanImpl from '../../../src/implementations/compactlinearscan.ts';
import LinearScanImpl from '../../src/implementations/superseded/linearscan.ts';
import OptimizedLinearScanImpl from '../../src/implementations/superseded/optimizedlinearscan.ts';

const referenceTestConfig: TestConfig = {
	reference: LinearScanImpl,
	implementation: OptimizedLinearScanImpl,
	name: 'OptimizedLinearScanImpl (vs LinearScan)',
};

const compactTestConfig: TestConfig = {
	reference: CompactLinearScanImpl,
	implementation: OptimizedLinearScanImpl,
	name: 'OptimizedLinearScanImpl (vs Compact)',
};

testImplementationEquivalence(referenceTestConfig);
testImplementationEquivalence(compactTestConfig);
