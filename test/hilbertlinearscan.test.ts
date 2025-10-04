/// <reference types="@types/google-apps-script" />

import { assertEquals, assertExists } from '@std/assert';
import { type TestConfig, testSpatialIndexAxioms } from '../src/conformance/mod.ts';
import HilbertLinearScanImpl from '../src/implementations/hilbertlinearscan.ts';
import LinearScanImpl from '../archive/src/implementations/superseded/linearscan.ts';

const config: TestConfig = {
	reference: LinearScanImpl,
	implementation: HilbertLinearScanImpl,
	name: 'HilbertLinearScanImpl',
};

testSpatialIndexAxioms(config);

// Edge case tests for Hilbert curve coordinate wrapping
Deno.test('HilbertLinearScan: Coordinates at MAX_COORD boundary (65536)', () => {
	const index = new HilbertLinearScanImpl<string>();

	// Insert range right at the boundary
	index.insert({
		startRowIndex: 65535,
		endRowIndex: 65536, // Exactly at MAX_COORD
		startColumnIndex: 65535,
		endColumnIndex: 65536,
	}, 'boundary');

	// Should store and retrieve correctly
	const result = index.query({
		startRowIndex: 65535,
		endRowIndex: 65536,
		startColumnIndex: 65535,
		endColumnIndex: 65536,
	});

	assertEquals(result.length, 1);
	assertEquals(result[0].value, 'boundary');
});

Deno.test('HilbertLinearScan: Very large coordinates (>65K) - correctness maintained', () => {
	const index = new HilbertLinearScanImpl<string>();

	// Insert range with coords > MAX_COORD (100K rows)
	// Bitwise wrapping occurs in Hilbert index calculation, but correctness is maintained
	index.insert({
		startRowIndex: 100000,
		endRowIndex: 100010,
		startColumnIndex: 50000,
		endColumnIndex: 50010,
	}, 'large_coords');

	// Query should still work correctly (disjointness, LWW semantics preserved)
	const result = index.query({
		startRowIndex: 100000,
		endRowIndex: 100010,
		startColumnIndex: 50000,
		endColumnIndex: 50010,
	});

	assertEquals(result.length, 1);
	assertEquals(result[0].value, 'large_coords');
	assertEquals(result[0].gridRange.startRowIndex, 100000);
});

Deno.test('HilbertLinearScan: Multiple ranges with large coords - LWW semantics preserved', () => {
	const index = new HilbertLinearScanImpl<string>();

	// Insert overlapping ranges with coords > 65K
	index.insert({
		startRowIndex: 100000,
		endRowIndex: 100100,
		startColumnIndex: 0,
		endColumnIndex: 100,
	}, 'first');

	index.insert({
		startRowIndex: 100050,
		endRowIndex: 100150,
		startColumnIndex: 0,
		endColumnIndex: 100,
	}, 'second');

	// Query overlapping region - should get decomposed ranges
	const result = index.query({
		startRowIndex: 100000,
		endRowIndex: 100150,
		startColumnIndex: 0,
		endColumnIndex: 100,
	});

	// Should have multiple fragments due to overlap
	assertExists(result);
	// Verify last-writer-wins: some regions should have "second" value
	const hasSecond = result.some((r) => r.value === 'second');
	assertEquals(hasSecond, true, 'Should have at least one range with "second" value');

	// Verify "first" was partially overwritten (some fragments remain)
	const hasFirst = result.some((r) => r.value === 'first');
	assertEquals(hasFirst, true, 'Should have at least one range with "first" value (non-overlapping part)');

	// Total ranges should be > 1 due to decomposition
	assertEquals(result.length > 1, true, 'Should have multiple ranges due to overlap decomposition');
});

Deno.test('HilbertLinearScan: Mixed small and large coords - both work correctly', () => {
	const index = new HilbertLinearScanImpl<string>();

	// Small coords (< 65K)
	index.insert({
		startRowIndex: 100,
		endRowIndex: 200,
		startColumnIndex: 100,
		endColumnIndex: 200,
	}, 'small');

	// Large coords (> 65K)
	index.insert({
		startRowIndex: 100000,
		endRowIndex: 100100,
		startColumnIndex: 100000,
		endColumnIndex: 100100,
	}, 'large');

	// Both should be retrievable
	const smallResult = index.query({
		startRowIndex: 100,
		endRowIndex: 200,
		startColumnIndex: 100,
		endColumnIndex: 200,
	});

	const largeResult = index.query({
		startRowIndex: 100000,
		endRowIndex: 100100,
		startColumnIndex: 100000,
		endColumnIndex: 100100,
	});

	assertEquals(smallResult.length, 1);
	assertEquals(smallResult[0].value, 'small');
	assertEquals(largeResult.length, 1);
	assertEquals(largeResult[0].value, 'large');
});
