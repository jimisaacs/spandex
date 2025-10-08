/// <reference types="@types/google-apps-script" />

import { type TestConfig, testImplementationEquivalence, testSpatialIndexAxioms } from '../src/conformance/mod.ts';
import LinearScanImpl from '../archive/src/implementations/superseded/linearscan.ts';
import RStarTreeImpl from '../src/implementations/rstartree.ts';

/**
 * R*-Tree Implementation Tests
 *
 * Tests the hierarchical R*-tree implementation against:
 * 1. Self-test: Axiom-based conformance (same as LinearScan)
 * 2. Equivalence: Produces identical results to linear scan approach
 */

// Self-test: Validate R*-tree satisfies all spatial index axioms
const rtreeSelfTestConfig: TestConfig = {
	reference: LinearScanImpl,
	implementation: RStarTreeImpl,
	name: 'RStarTreeImpl (Self-Test)',
};

testSpatialIndexAxioms(rtreeSelfTestConfig);

// Equivalence test: R*-tree should produce identical results to LinearScan
const rtreeEquivalenceConfig: TestConfig = {
	reference: LinearScanImpl,
	implementation: RStarTreeImpl,
	name: 'RStarTreeImpl (vs LinearScan)',
};

testImplementationEquivalence(rtreeEquivalenceConfig);
