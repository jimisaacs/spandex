import {
	assert,
	assertArrayIncludes,
	assertEquals,
	assertFalse,
	assertGreater,
	assertGreaterOrEqual,
	assertIsError,
} from '@std/assert';
import { rect } from '../rect.ts';
import type { Rectangle, SpatialIndex } from '../types.ts';
import { CANONICAL_FRAGMENT_COUNTS } from './constants.ts';

export interface TestConfig {
	implementation: <T>() => SpatialIndex<T>;
	name: string;
}

/**
 * Invariants that must hold after every operation:
 * 1. Non-duplication: No duplicate (bounds, value) pairs
 * 2. Disjoint: No overlapping rectangles (∀ rᵢ, rⱼ: i ≠ j ⟹ rᵢ ∩ rⱼ = ∅)
 */
export const assertInvariants = <T>(index: SpatialIndex<T>, context: string): void => {
	const ranges = Array.from(index.query());

	// Invariant 1: Non-duplication
	const signatures = ranges.map((r) => `${r[0][0]},${r[0][1]},${r[0][2]},${r[0][3]}:${r[1]}`);
	assertEquals(signatures.length, new Set(signatures).size, `${context}: duplicate ranges`);

	// Invariant 2: Disjoint (no overlapping rectangles)
	for (let i = 0; i < ranges.length; i++) {
		for (let j = i + 1; j < ranges.length; j++) {
			const r1 = ranges[i][0];
			const r2 = ranges[j][0];

			const [r1xmin, r1ymin, r1xmax, r1ymax] = r1;
			const [r2xmin, r2ymin, r2xmax, r2ymax] = r2;

			// AABB overlap test
			const overlaps = r1xmin <= r2xmax && r2xmin <= r1xmax &&
				r1ymin <= r2ymax && r2ymin <= r1ymax;

			assertFalse(
				overlaps,
				`${context}: overlapping ranges found at indices ${i} and ${j}:\n` +
					`  Range ${i}: rows [${r1ymin}, ${r1ymax}], cols [${r1xmin}, ${r1xmax}], value=${ranges[i][1]}\n` +
					`  Range ${j}: rows [${r2ymin}, ${r2ymax}], cols [${r2xmin}, ${r2xmax}], value=${ranges[j][1]}`,
			);
		}
	}
};

export function testSpatialIndexAxioms(config: TestConfig): void {
	const { implementation, name } = config;

	Deno.test(`${name} - Empty state`, () => {
		const index = implementation<string>();
		assertInvariants(index, 'initial');
		assertEquals(Array.from(index.query()).length, 0, 'empty index should return no ranges');
	});

	Deno.test(`${name} - Value preservation`, () => {
		const index = implementation<string>();
		index.insert(rect(1, 1, 4, 4), 'test');
		assertInvariants(index, 'single insertion');

		const ranges = Array.from(index.query());
		assertEquals(ranges.length, 1, `expected 1 range, got ${ranges.length}`);
		assertEquals(ranges[0][1], 'test', 'value should be preserved');
	});

	Deno.test(`${name} - Idempotency`, () => {
		const index = implementation<string>();
		const testRange = rect(1, 1, 4, 4);

		// Use structural comparator to ensure stable sorting
		const sortFn = (
			a: readonly [Rectangle, string],
			b: readonly [Rectangle, string],
		) => {
			const [ax, ay, ax2, ay2] = a[0];
			const [bx, by, bx2, by2] = b[0];
			// Sort by ymin, ymax, xmin, xmax
			if (ay !== by) return ay - by;
			if (ay2 !== by2) return ay2 - by2;
			if (ax !== bx) return ax - bx;
			if (ax2 !== bx2) return ax2 - bx2;
			return a[1].localeCompare(b[1]);
		};

		index.insert(testRange, 'test');
		const result1 = JSON.stringify(Array.from(index.query()).sort(sortFn));

		index.insert(testRange, 'test');
		const result2 = JSON.stringify(Array.from(index.query()).sort(sortFn));

		assertEquals(result1, result2, 'duplicate insertion should be idempotent');
	});

	Deno.test(`${name} - Last-Writer-Wins ordering`, () => {
		// CRITICAL: Insertion order matters for overlapping ranges
		// Later inserts overwrite earlier ones in overlapping regions
		const index1 = implementation<string>();
		const index2 = implementation<string>();

		const range1 = rect(0, 0, 4, 4);
		const range2 = rect(2, 2, 6, 6); // Overlaps with range1

		// Scenario A: Insert 'first' then 'second'
		index1.insert(range1, 'first');
		index1.insert(range2, 'second');

		// Scenario B: Insert 'second' then 'first' (REVERSED order)
		index2.insert(range2, 'second');
		index2.insert(range1, 'first');

		assertInvariants(index1, 'scenario A');
		assertInvariants(index2, 'scenario B');

		// Query overlap region [2,4]×[2,4] - should show different values
		const overlapQuery = rect(2, 2, 4, 4);

		const resultsA = Array.from(index1.query(overlapQuery));
		const resultsB = Array.from(index2.query(overlapQuery));

		// In scenario A, overlap region should contain 'second' (last writer)
		const valuesA = resultsA.map((r) => r[1]);
		assert(
			valuesA.includes('second'),
			'Scenario A: overlap region should contain "second" (last writer)',
		);

		// In scenario B, overlap region should contain 'first' (last writer)
		const valuesB = resultsB.map((r) => r[1]);
		assert(
			valuesB.includes('first'),
			'Scenario B: overlap region should contain "first" (last writer)',
		);

		// The two scenarios MUST produce different results (order matters!)
		const resultJsonA = JSON.stringify(resultsA.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
		const resultJsonB = JSON.stringify(resultsB.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));

		assert(
			resultJsonA !== resultJsonB,
			'Different insertion orders MUST produce different results (Last-Writer-Wins)',
		);
	});

	Deno.test(`${name} - Infinite ranges`, () => {
		const index = implementation<string>();

		index.insert([1, 0, 2, Infinity], 'infinite-rows'); // Columns 1-2, infinite rows
		assertInvariants(index, 'infinite rows');
		assertEquals(Array.from(index.query()).length, 1, 'infinite row range should be preserved');

		index.insert([0, 1, Infinity, 2], 'infinite-cols'); // Infinite columns, rows 1-2
		assertInvariants(index, 'infinite columns');

		assertGreaterOrEqual(Array.from(index.query()).length, 2, 'infinite ranges should fragment properly');
	});

	Deno.test(`${name} - Invalid range rejection (strict validation)`, () => {
		// STRICT VALIDATION: Implementations MUST reject invalid ranges
		// Invalid = xmin > xmax OR ymin > ymax (backwards coordinates)
		const index = implementation<string>();

		// Test 1: Backwards Y coordinates (ymin > ymax)
		let threw = false;
		try {
			index.insert(rect(1, 5, 2, 4), 'invalid-row'); // ymin=5 > ymax=4
		} catch (e) {
			threw = true;
			assertIsError(e, Error, undefined, 'should throw Error for invalid range');
			assert(
				e.message.toLowerCase().includes('invalid') ||
					e.message.toLowerCase().includes('coordinate') ||
					e.message.toLowerCase().includes('range'),
				`error message should mention invalid range, got: "${e.message}"`,
			);
		}
		assert(threw, 'MUST throw error for backwards Y coordinates (ymin > ymax)');

		// Test 2: Backwards X coordinates (xmin > xmax)
		threw = false;
		try {
			index.insert(rect(5, 1, 4, 2), 'invalid-col'); // xmin=5 > xmax=4
		} catch (e) {
			threw = true;
			assertIsError(e, Error);
		}
		assert(threw, 'MUST throw error for backwards X coordinates (xmin > xmax)');

		// Test 3: Both coordinates backwards
		threw = false;
		try {
			index.insert(rect(5, 5, 4, 4), 'invalid-both'); // Both backwards
		} catch (e) {
			threw = true;
			assertIsError(e, Error);
		}
		assert(threw, 'MUST throw error for both coordinates backwards');

		// Verify index remains valid after rejected inserts
		assertInvariants(index, 'after invalid insertion attempts');
		assert(index.query().next().done, 'index should remain empty after all invalid insertions were rejected');
	});

	Deno.test(`${name} - Query method`, () => {
		const index = implementation<string>();

		// Insert multiple ranges
		index.insert(rect(1, 1, 4, 4), 'red');
		index.insert(rect(10, 10, 14, 14), 'blue');
		index.insert(rect(20, 20, 24, 24), 'green');
		assertInvariants(index, 'query setup');

		// Query for specific region
		const results = Array.from(index.query(rect(3, 3, 11, 11)));

		// Should find ranges that intersect [3,12) × [3,12)
		const values = results.map((r) => r[1]);
		assertArrayIncludes(values, ['red'], 'query should find red range');
		assertArrayIncludes(values, ['blue'], 'query should find blue range');
		assert(!values.includes('green'), 'query should not include green range');

		// Query should not modify state
		assertInvariants(index, 'query should not modify state');

		// Empty query should return empty results
		const emptyResults = Array.from(index.query(rect(100, 100, 109, 109)));
		assertEquals(emptyResults.length, 0, 'empty query should return no results');
	});

	Deno.test(`${name} - Deterministic pattern sequence (invariant preservation)`, () => {
		const index = implementation<string>();

		// Use deterministic pseudo-random ranges (seeded)
		// Generate variety of patterns: small, large, overlapping, adjacent
		const deterministicPatterns = [
			rect(0, 0, 4, 4),
			rect(10, 10, 14, 14),
			rect(2, 2, 7, 7), // Overlaps first
			rect(5, 20, 9, 24),
			rect(15, 1, 19, 5),
			rect(3, 12, 8, 17),
			rect(12, 5, 17, 10),
			rect(7, 15, 13, 21),
			rect(18, 3, 23, 8),
			rect(1, 7, 6, 12),
		];

		const operations = Array.from({ length: 100 }, (_, i) => ({
			range: deterministicPatterns[i % deterministicPatterns.length],
			value: `stress_${i}`,
		}));

		// Insert all operations and verify invariants hold after EACH (not every 10)
		operations.forEach((op, i) => {
			index.insert(op.range, op.value);
			assertInvariants(index, `stress test iteration ${i}`);
		});

		const ranges = Array.from(index.query());

		// Verify all ranges are valid
		assertGreater(ranges.length, 0, 'should not lose all ranges during stress test');
	});

	Deno.test(`${name} - Query edge cases`, () => {
		const index = implementation<string>();

		// Query empty index
		const emptyResults = Array.from(index.query(rect(0, 0, 9, 9)));
		assertEquals(emptyResults.length, 0, 'query on empty index should return empty array');

		// Insert some data
		index.insert(rect(5, 5, 14, 14), 'center');
		index.insert(rect(20, 20, 29, 29), 'corner');
		assertInvariants(index, 'query setup');

		// Query with infinite range (should return all)
		const allResults = Array.from(index.query(rect()));
		assertEquals(allResults.length, 2, `infinite query should return all entries, got ${allResults.length}`);

		// Query exact match
		const exactMatch = Array.from(index.query(rect(5, 5, 14, 14)));
		assertEquals(exactMatch.length, 1, 'exact match query should find one range');
		assertEquals(exactMatch[0][1], 'center', 'exact match should find center value');

		// Query partial overlap
		const partialOverlap = Array.from(index.query(rect(10, 10, 24, 24)));
		assertEquals(partialOverlap.length, 2, `partial overlap should find both ranges, got ${partialOverlap.length}`);

		// Query no overlap
		const noOverlap = Array.from(index.query(rect(100, 100, 109, 109)));
		assertEquals(noOverlap.length, 0, 'no overlap query should return empty');

		assertInvariants(index, 'queries should not modify state');
	});

	Deno.test(`${name} - query() with no bounds returns all ranges`, () => {
		// CRITICAL: query() without bounds must return ALL ranges in the index
		const index = implementation<string>();

		// Insert varied data
		index.insert(rect(0, 0, 4, 4), 'topleft');
		index.insert(rect(10, 10, 14, 14), 'center');
		index.insert(rect(20, 5, 24, 9), 'rightmid');
		index.insert(rect(5, 20, 9, 24), 'botmid');

		assertInvariants(index, 'after inserts');

		// Query with no bounds should return all 4 ranges
		const allRanges = Array.from(index.query());
		assertEquals(
			allRanges.length,
			4,
			'query() with no bounds should return all 4 ranges',
		);

		// Verify all values are present
		const values = new Set(allRanges.map((r) => r[1]));
		assert(values.has('topleft'), 'should contain topleft');
		assert(values.has('center'), 'should contain center');
		assert(values.has('rightmid'), 'should contain rightmid');
		assert(values.has('botmid'), 'should contain botmid');
	});

	Deno.test(`${name} - Non-overlapping preservation (no data loss)`, () => {
		const index = implementation<string>();

		// Insert non-overlapping ranges to ensure all values survive
		// Using a grid pattern with sufficient spacing to avoid overlaps
		const spacing = 100;
		for (let i = 0; i < 5; i++) {
			for (let j = 0; j < 4; j++) {
				const value = `reachable_${i}_${j}`;
				const baseRow = i * spacing;
				const baseCol = j * spacing;
				index.insert(rect(baseCol, baseRow, baseCol + 50 - 1, baseRow + 50 - 1), value);
			}
		}

		assertInvariants(index, 'after non-overlapping insertions');

		// All 20 values should be reachable (no overlaps = no overwrites)
		const expectedCount = 20;

		// Query entire space to retrieve all values
		const allResults = Array.from(index.query(rect()));
		const retrievedValues = new Set(allResults.map((r) => r[1]));

		// Verify all inserted values are reachable
		assertEquals(
			retrievedValues.size,
			expectedCount,
			`value reachability: expected ${expectedCount} values, got ${retrievedValues.size}`,
		);

		// Also verify query() with no bounds returns same values
		const allValues = new Set(Array.from(index.query()).map((r) => r[1]));
		assertEquals(
			allValues.size,
			expectedCount,
			`query() with no bounds value count mismatch: expected ${expectedCount}, got ${allValues.size}`,
		);

		// Verify query with bounds and query with no bounds return same values
		assertEquals(
			retrievedValues.size,
			allValues.size,
			'query() with bounds and query() with no bounds should return same value sets',
		);
	});

	Deno.test(`${name} - Coordinate extremes`, () => {
		const index = implementation<string>();

		// Very large coordinates (within int32 bounds for TypedArrays)
		const largeCoord = 1000000;
		index.insert(rect(largeCoord, largeCoord, largeCoord + 100 - 1, largeCoord + 100 - 1), 'large');
		assertInvariants(index, 'large coordinates');

		const results = Array.from(
			index.query(rect(largeCoord + 50, largeCoord + 50, largeCoord + 60 - 1, largeCoord + 60 - 1)),
		);
		assertEquals(results.length, 1, 'query at large coordinates should find exactly 1 result');
		assertEquals(results[0][1], 'large', 'query at large coordinates should find "large" value');

		// Mix of small and large coordinates
		index.insert(rect(0, 0, 9, 9), 'small');
		assertInvariants(index, 'mixed coordinate scales');

		const smallResults = Array.from(index.query(rect(0, 0, 9, 9)));
		assertEquals(smallResults.length, 1, 'small coordinate query should find exactly 1 result');
		assertEquals(smallResults[0][1], 'small', 'small coordinate range should not be lost after large insertion');
	});

	// ========================================================================
	// FRAGMENT COUNT VERIFICATION (Canonical correctness check)
	// ========================================================================

	Deno.test(`${name} - Fragment count correctness (large-overlapping scenario)`, () => {
		// This scenario is deterministic and MUST produce exactly CANONICAL_FRAGMENT_COUNTS.LARGE_OVERLAPPING
		// fragments for correct implementations. Any deviation indicates a coordinate bug or algorithmic issue.

		const largeOverlapping = Array.from({ length: 1250 }, (_, i) => ({
			range: rect(i % 10, Math.floor(i / 5), (i % 10) + 5 - 1, Math.floor(i / 5) + 5 - 1),
			value: `overlap_${i}`,
		}));

		const index = implementation<string>();
		largeOverlapping.forEach((op) => index.insert(op.range, op.value));

		const fragmentCount = Array.from(index.query()).length;

		assertEquals(
			fragmentCount,
			CANONICAL_FRAGMENT_COUNTS.LARGE_OVERLAPPING,
			`fragment count mismatch! expected ${CANONICAL_FRAGMENT_COUNTS.LARGE_OVERLAPPING} but got ${fragmentCount}.\n` +
				`this indicates a coordinate swap bug or incorrect geometric subtraction.\n` +
				`all correct implementations must produce exactly ${CANONICAL_FRAGMENT_COUNTS.LARGE_OVERLAPPING} fragments`,
		);

		assertInvariants(index, 'large-overlapping scenario');
	});

	// ========================================================================
	// ADVANCED CORRECTNESS TESTS (Query-Insert interactions, geometric precision)
	// ========================================================================

	Deno.test(`${name} - Query-insert consistency`, () => {
		// Critical: Anything inserted MUST be findable via query at exact same coordinates
		// This catches spatial indexing bugs where data exists but isn't queryable
		const index = implementation<string>();

		const testCases = [
			{ range: rect(10, 10, 19, 19), value: 'center', description: 'center square' },
			{ range: rect(0, 0, 99, 4), value: 'top-strip', description: 'horizontal strip' },
			{ range: rect(0, 0, 4, 99), value: 'left-strip', description: 'vertical strip' },
			{ range: rect(1000, 1000, 1009, 1009), value: 'far', description: 'large coordinates' },
			{ range: rect(0, 0, 0, 0), value: 'tiny', description: 'single cell' },
		];

		for (const testCase of testCases) {
			index.insert(testCase.range, testCase.value);

			// Query at EXACT same coordinates - MUST find it
			const results = Array.from(index.query(testCase.range));
			const found = results.find((r) => r[1] === testCase.value);

			assert(
				found,
				`query-insert consistency failed for ${testCase.description}!\n` +
					`inserted range but query at same coordinates didn't find it.\n` +
					`this indicates a spatial indexing bug (Morton encoding error, AABB test error, etc.)`,
			);
		}

		assertInvariants(index, 'query-insert consistency');
	});

	Deno.test(`${name} - Query result completeness`, () => {
		// Query must return ALL overlapping ranges, not just some
		// Catches R-tree pruning errors, early-exit bugs, partial result bugs
		const index = implementation<string>();

		// Insert 10 ranges in overlapping region
		for (let i = 0; i < 10; i++) {
			index.insert(rect(i * 2, 0, i * 2 + 3 - 1, 19), `value${i}`);
		}

		assertInvariants(index, 'after 10 insertions');

		// Query region that overlaps all 10 ranges
		const results = Array.from(index.query(rect(0, 0, 19, 19)));
		const foundValues = new Set(results.map((r) => r[1]));

		// MUST find all 10 distinct values
		const expectedValues = Array.from({ length: 10 }, (_, i) => `value${i}`);
		const missingValues = expectedValues.filter((v) => !foundValues.has(v));

		assertEquals(
			missingValues.length,
			0,
			`query incomplete! found ${foundValues.size}/10 values.\n` +
				`missing: ${missingValues.join(', ')}\n` +
				`this indicates a query traversal bug (early exit, pruning error, etc.)`,
		);

		// Also test query at specific subregion
		const subResults = Array.from(index.query(rect(5, 5, 14, 14)));
		assertGreater(subResults.length, 0, 'subregion query should find at least some ranges');

		// Verify each result actually overlaps query region
		for (const result of subResults) {
			const [x, y, x2, y2] = result[0];

			// Check overlap with [5,14]×[5,14] (closed coords)
			const overlaps = y <= 14 && y2 >= 5 && x <= 14 && x2 >= 5;

			assert(
				overlaps,
				`query should not return non-overlapping range: ${result[1]} at [${x},${y},${x2},${y2}] ` +
					`doesn't overlap [5,5,14,14]`,
			);
		}
	});
}
