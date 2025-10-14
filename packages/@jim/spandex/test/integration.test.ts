/**
 * Cross-implementation integration tests
 *
 * Tests ALL active implementations to ensure:
 * 1. Each implementation produces results matching canonical values
 * 2. All implementations produce identical results to each other
 */

import { MortonLinearScanImpl, RStarTreeImpl } from '@jim/spandex';
import { testCrossImplementationConsistency } from '@local/spandex-testing/axiom';

// Test all active implementations for consistency
testCrossImplementationConsistency([
	{ name: 'MortonLinearScan', Class: MortonLinearScanImpl },
	{ name: 'RStarTree', Class: RStarTreeImpl },
]);
