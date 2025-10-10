/**
 * Cross-implementation integration tests
 *
 * Tests ALL active implementations to ensure:
 * 1. Each implementation produces results matching canonical values
 * 2. All implementations produce identical results to each other
 */

import { testCrossImplementationConsistency } from '@local/spandex-testing';
import { MortonLinearScanImpl } from '@jim/spandex';
import { RStarTreeImpl } from '@jim/spandex';

// Test all active implementations for consistency
testCrossImplementationConsistency([
	{ name: 'MortonLinearScan', Class: MortonLinearScanImpl },
	{ name: 'RStarTree', Class: RStarTreeImpl },
]);
