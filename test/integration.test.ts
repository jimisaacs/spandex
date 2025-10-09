/**
 * Cross-implementation integration tests
 *
 * Tests ALL active implementations to ensure:
 * 1. Each implementation produces results matching canonical values
 * 2. All implementations produce identical results to each other
 */

import { testCrossImplementationConsistency } from '../src/conformance/mod.ts';
import MortonLinearScanImpl from '../src/implementations/mortonlinearscan.ts';
import RStarTreeImpl from '../src/implementations/rstartree.ts';

// Test all active implementations for consistency
testCrossImplementationConsistency([
	{ name: 'MortonLinearScan', Class: MortonLinearScanImpl },
	{ name: 'RStarTree', Class: RStarTreeImpl },
]);
