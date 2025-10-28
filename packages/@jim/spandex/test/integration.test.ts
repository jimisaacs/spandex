/**
 * Cross-implementation integration tests
 *
 * Tests ALL active implementations to ensure:
 * 1. Each implementation produces results matching canonical values
 * 2. All implementations produce identical results to each other
 */

import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
import createRStarTreeIndex from '@jim/spandex/index/rstartree';
import { testCrossImplementationConsistency } from '@local/spandex-testing/axiom';

// Test all active implementations for consistency
testCrossImplementationConsistency([
	{ name: 'MortonLinearScan', factory: createMortonLinearScanIndex },
	{ name: 'RStarTree', factory: createRStarTreeIndex },
]);
