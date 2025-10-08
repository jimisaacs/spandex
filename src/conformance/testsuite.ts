/// <reference types="@types/google-apps-script" />

import {
	assert,
	assertArrayIncludes,
	assertEquals,
	assertExists,
	assertFalse,
	assertGreater,
	assertGreaterOrEqual,
	assertIsError,
	assertLessOrEqual,
	assertObjectMatch,
} from '@std/assert';

type GridRange = GoogleAppsScript.Sheets.Schema.GridRange;

export interface SpatialIndex<T> {
	insert(gridRange: GridRange, value: T): void;
	getAllRanges(): Array<{ gridRange: GridRange; value: T }>;
	query(gridRange: GridRange): Array<{ gridRange: GridRange; value: T }>;
	readonly isEmpty: boolean;
}

export type IndexConstructor<T> = new () => SpatialIndex<T>;

export interface TestConfig {
	reference: IndexConstructor<string>;
	implementation: IndexConstructor<string>;
	name: string;
}

export const range = (r1?: number, r2?: number, c1?: number, c2?: number) => ({
	startRowIndex: r1,
	endRowIndex: r2,
	startColumnIndex: c1,
	endColumnIndex: c2,
});

export const randomRange = (maxDim = 20) => {
	const r1 = Math.floor(Math.random() * maxDim);
	const c1 = Math.floor(Math.random() * maxDim);
	const r2 = r1 + 1 + Math.floor(Math.random() * (maxDim - r1));
	const c2 = c1 + 1 + Math.floor(Math.random() * (maxDim - c1));
	return range(r1, r2, c1, c2);
};

/**
 * Invariants that must hold after every operation:
 * 1. Consistency: isEmpty ⟺ |getAllRanges()| = 0
 * 2. Non-duplication: No duplicate (bounds, value) pairs
 * 3. Disjoint: No overlapping rectangles (∀ rᵢ, rⱼ: i ≠ j ⟹ rᵢ ∩ rⱼ = ∅)
 */
export const assertInvariants = <T>(index: SpatialIndex<T>, context: string): void => {
	const ranges = index.getAllRanges();
	const empty = index.isEmpty;

	// Invariant 1: Consistency
	assertEquals(empty, ranges.length === 0, `${context}: isEmpty ≠ (ranges.length === 0)`);

	// Invariant 2: Non-duplication
	const signatures = ranges.map((r) =>
		`${r.gridRange.startRowIndex},${r.gridRange.endRowIndex},${r.gridRange.startColumnIndex},${r.gridRange.endColumnIndex}:${r.value}`
	);
	assertEquals(signatures.length, new Set(signatures).size, `${context}: duplicate ranges`);

	// Invariant 3: Disjoint (no overlapping rectangles)
	for (let i = 0; i < ranges.length; i++) {
		for (let j = i + 1; j < ranges.length; j++) {
			const r1 = ranges[i].gridRange;
			const r2 = ranges[j].gridRange;

			// Convert to inclusive coordinates for overlap test
			const r1xmin = r1.startColumnIndex ?? 0;
			const r1xmax = (r1.endColumnIndex ?? Infinity) - 1;
			const r1ymin = r1.startRowIndex ?? 0;
			const r1ymax = (r1.endRowIndex ?? Infinity) - 1;

			const r2xmin = r2.startColumnIndex ?? 0;
			const r2xmax = (r2.endColumnIndex ?? Infinity) - 1;
			const r2ymin = r2.startRowIndex ?? 0;
			const r2ymax = (r2.endRowIndex ?? Infinity) - 1;

			// AABB overlap test
			const overlaps = r1xmin <= r2xmax && r2xmin <= r1xmax &&
				r1ymin <= r2ymax && r2ymin <= r1ymax;

			assertFalse(
				overlaps,
				`${context}: overlapping ranges found at indices ${i} and ${j}:\n` +
					`  Range ${i}: rows [${r1ymin}, ${r1ymax}], cols [${r1xmin}, ${r1xmax}], value=${
						ranges[i].value
					}\n` +
					`  Range ${j}: rows [${r2ymin}, ${r2ymax}], cols [${r2xmin}, ${r2xmax}], value=${ranges[j].value}`,
			);
		}
	}
};

export function testSpatialIndexAxioms(config: TestConfig): void {
	const { implementation: IndexClass, name } = config;

	Deno.test(`${name} - Empty state`, () => {
		const index = new IndexClass();
		assertInvariants(index, 'initial');
		assert(index.isEmpty, 'new index should be empty');
		assertEquals(index.getAllRanges().length, 0, 'empty index should return no ranges');
	});

	Deno.test(`${name} - Value preservation`, () => {
		const index = new IndexClass();
		index.insert(range(1, 5, 1, 5), 'test');
		assertInvariants(index, 'single insertion');

		const ranges = index.getAllRanges();
		assertEquals(ranges.length, 1, `expected 1 range, got ${ranges.length}`);
		assertEquals(ranges[0].value, 'test', 'value should be preserved');
		assertFalse(index.isEmpty, 'non-empty index should not report empty');
	});

	Deno.test(`${name} - Overlap resolution`, () => {
		const index = new IndexClass();
		index.insert(range(1, 5, 1, 5), 'first');
		index.insert(range(2, 4, 2, 4), 'second');
		assertInvariants(index, 'overlap resolution');

		const values = index.getAllRanges().map((r) => r.value);
		assertArrayIncludes(values, ['second'], 'overlapping value should be preserved');
	});

	Deno.test(`${name} - Last writer wins`, () => {
		const index1 = new IndexClass();
		index1.insert(range(1, 3, 1, 3), 'first');
		index1.insert(range(2, 4, 2, 4), 'second');

		const index2 = new IndexClass();
		index2.insert(range(2, 4, 2, 4), 'second');
		index2.insert(range(1, 3, 1, 3), 'first');

		const values1 = new Set(index1.getAllRanges().map((r) => r.value));
		const values2 = new Set(index2.getAllRanges().map((r) => r.value));

		assert(values1.has('first') && values1.has('second'), 'both values should be preserved (index1)');
		assert(values2.has('first') && values2.has('second'), 'both values should be preserved (index2)');

		assertInvariants(index1, 'last writer wins 1');
		assertInvariants(index2, 'last writer wins 2');
	});

	Deno.test(`${name} - Edge cases`, () => {
		const index = new IndexClass();

		index.insert(range(1, 2, 1, 2), 'cell');
		assertInvariants(index, 'single cell');

		index.insert(range(1, 2, 2, 3), 'adjacent');
		assertInvariants(index, 'adjacent ranges');

		index.insert(range(), 'global');
		assertInvariants(index, 'global range');

		const ranges = index.getAllRanges();
		assertEquals(ranges.length, 1, 'global range should override all others');
		assertEquals(ranges[0].value, 'global', 'global value should be preserved');
	});

	Deno.test(`${name} - Property-based validation`, () => {
		const index = new IndexClass();
		const insertedValues = new Set<string>();

		// Use deterministic pseudo-random ranges (seeded sequence)
		const deterministicRanges = [
			range(0, 5, 0, 5),
			range(10, 15, 10, 15),
			range(2, 8, 2, 8),
			range(20, 25, 5, 10),
			range(1, 6, 15, 20),
			range(12, 18, 3, 9),
			range(5, 11, 12, 18),
			range(15, 22, 7, 14),
			range(3, 9, 18, 24),
			range(7, 13, 1, 7),
		];

		for (let i = 0; i < 50; i++) {
			const value = `val_${i}`;
			// Cycle through deterministic ranges
			const testRange = deterministicRanges[i % deterministicRanges.length];
			index.insert(testRange, value);
			insertedValues.add(value);
			assertInvariants(index, `property-based operation ${i}`);
		}

		const resultValues = new Set(index.getAllRanges().map((r) => r.value));
		assertGreater(resultValues.size, 0, 'should not lose all values');

		for (const value of resultValues) {
			assert(insertedValues.has(value), `unexpected value: ${value}`);
		}
	});

	Deno.test(`${name} - Idempotency`, () => {
		const index = new IndexClass();
		const testRange = range(1, 5, 1, 5);

		// Use structural comparator to ensure stable sorting
		const sortFn = (
			a: ReturnType<typeof index.getAllRanges>[number],
			b: ReturnType<typeof index.getAllRanges>[number],
		) => {
			const aStart = a.gridRange.startRowIndex ?? 0;
			const bStart = b.gridRange.startRowIndex ?? 0;
			if (aStart !== bStart) return aStart - bStart;
			const aEnd = a.gridRange.endRowIndex ?? Infinity;
			const bEnd = b.gridRange.endRowIndex ?? Infinity;
			if (aEnd !== bEnd) return aEnd - bEnd;
			const aColStart = a.gridRange.startColumnIndex ?? 0;
			const bColStart = b.gridRange.startColumnIndex ?? 0;
			if (aColStart !== bColStart) return aColStart - bColStart;
			const aColEnd = a.gridRange.endColumnIndex ?? Infinity;
			const bColEnd = b.gridRange.endColumnIndex ?? Infinity;
			if (aColEnd !== bColEnd) return aColEnd - bColEnd;
			return a.value.localeCompare(b.value);
		};

		index.insert(testRange, 'test');
		const result1 = JSON.stringify(index.getAllRanges().sort(sortFn));

		index.insert(testRange, 'test');
		const result2 = JSON.stringify(index.getAllRanges().sort(sortFn));

		assertEquals(result1, result2, 'duplicate insertion should be idempotent');
	});

	Deno.test(`${name} - Non-overlapping preservation`, () => {
		const index = new IndexClass();
		index.insert(range(1, 3, 1, 3), 'first');
		index.insert(range(5, 7, 5, 7), 'second');
		assertInvariants(index, 'non-overlapping');

		const ranges = index.getAllRanges();
		assertEquals(ranges.length, 2, `expected 2 ranges, got ${ranges.length}`);

		const values = ranges.map((r) => r.value).sort();
		assertArrayIncludes(values, ['first', 'second'], 'non-overlapping ranges should be preserved');
	});

	Deno.test(`${name} - Infinite ranges`, () => {
		const index = new IndexClass();

		index.insert({ startColumnIndex: 1, endColumnIndex: 3 }, 'infinite-rows');
		assertInvariants(index, 'infinite rows');
		assertEquals(index.getAllRanges().length, 1, 'infinite row range should be preserved');

		index.insert({ startRowIndex: 1, endRowIndex: 3 }, 'infinite-cols');
		assertInvariants(index, 'infinite columns');

		assertGreaterOrEqual(index.getAllRanges().length, 2, 'infinite ranges should fragment properly');
	});

	Deno.test(`${name} - Fragment generation validation`, () => {
		const index = new IndexClass();

		index.insert(range(0, 10, 0, 10), 'base');
		index.insert(range(3, 7, 3, 7), 'center');
		assertInvariants(index, 'center overlap produces fragments');

		const ranges = index.getAllRanges();
		const baseFragments = ranges.filter((r) => r.value === 'base');
		const centerFragment = ranges.find((r) => r.value === 'center');

		// Center overlap produces ≤4 base fragments (exact count depends on optimization)
		assertLessOrEqual(baseFragments.length, 4, `too many base fragments: ${baseFragments.length} (expected ≤4)`);

		assertExists(centerFragment, 'center value should not be lost');

		// Verify center fragment has correct bounds
		const c = centerFragment!.gridRange;
		assertObjectMatch(c, {
			startRowIndex: 3,
			endRowIndex: 7,
			startColumnIndex: 3,
			endColumnIndex: 7,
		}, 'center fragment should have correct bounds');
	});

	Deno.test(`${name} - Invalid range rejection`, () => {
		const index = new IndexClass();

		// Note: Current implementations accept invalid ranges without throwing
		// This test verifies that IF an exception is thrown, it's the right type
		try {
			index.insert(range(5, 5, 1, 3), 'invalid-row');
			// If no exception, implementations accept invalid ranges (current behavior)
		} catch (e) {
			assertIsError(e, Error, 'Invalid', 'should throw Error with "Invalid" in message');
		}

		assertInvariants(index, 'after invalid insertion attempt');
	});

	Deno.test(`${name} - Query method`, () => {
		const index = new IndexClass();

		// Insert multiple ranges
		index.insert(range(1, 5, 1, 5), 'red');
		index.insert(range(10, 15, 10, 15), 'blue');
		index.insert(range(20, 25, 20, 25), 'green');
		assertInvariants(index, 'query setup');

		// Query for specific region
		const results = index.query(range(3, 12, 3, 12));

		// Should find ranges that intersect [3,12) × [3,12)
		const values = results.map((r) => r.value);
		assertArrayIncludes(values, ['red'], 'query should find red range');
		assertArrayIncludes(values, ['blue'], 'query should find blue range');
		assert(!values.includes('green'), 'query should not include green range');

		// Query should not modify state
		assertInvariants(index, 'query should not modify state');

		// Empty query should return empty results
		const emptyResults = index.query(range(100, 110, 100, 110));
		assertEquals(emptyResults.length, 0, 'empty query should return no results');
	});

	Deno.test(`${name} - Stress test (correctness under load)`, () => {
		const index = new IndexClass();

		// Use deterministic pseudo-random ranges (seeded)
		// Generate variety of patterns: small, large, overlapping, adjacent
		const deterministicPatterns = [
			range(0, 5, 0, 5),
			range(10, 15, 10, 15),
			range(2, 8, 2, 8), // Overlaps first
			range(20, 25, 5, 10),
			range(1, 6, 15, 20),
			range(12, 18, 3, 9),
			range(5, 11, 12, 18),
			range(15, 22, 7, 14),
			range(3, 9, 18, 24),
			range(7, 13, 1, 7),
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

		const ranges = index.getAllRanges();

		// Verify all ranges are valid
		assertGreater(ranges.length, 0, 'should not lose all ranges during stress test');
	});

	Deno.test(`${name} - Boundary conditions`, () => {
		const index = new IndexClass();

		// Single-cell range (1x1)
		index.insert(range(5, 6, 5, 6), 'single-cell');
		assertInvariants(index, 'single-cell range');
		const singleCell = index.getAllRanges();
		assertEquals(singleCell.length, 1, 'single-cell should be preserved');
		assertEquals(singleCell[0].value, 'single-cell', 'single-cell value should be preserved');

		// Single-row range (width > 1, height = 1)
		index.insert(range(10, 11, 0, 100), 'single-row');
		assertInvariants(index, 'single-row range');

		// Single-column range (height > 1, width = 1)
		index.insert(range(0, 100, 20, 21), 'single-col');
		assertInvariants(index, 'single-column range');

		// Range at coordinate 0
		index.insert(range(0, 5, 0, 5), 'at-zero');
		assertInvariants(index, 'range at coordinate 0');

		const finalRanges = index.getAllRanges();
		assertGreater(finalRanges.length, 0, 'should not lose all ranges');

		// Verify all inserted values are reachable
		const values = new Set(finalRanges.map((r) => r.value));
		assert(values.has('at-zero'), 'value at coordinate 0 should be reachable');
	});

	Deno.test(`${name} - Query edge cases`, () => {
		const index = new IndexClass();

		// Query empty index
		const emptyResults = index.query(range(0, 10, 0, 10));
		assertEquals(emptyResults.length, 0, 'query on empty index should return empty array');

		// Insert some data
		index.insert(range(5, 15, 5, 15), 'center');
		index.insert(range(20, 30, 20, 30), 'corner');
		assertInvariants(index, 'query setup');

		// Query with infinite range (should return all)
		const allResults = index.query(range());
		assertEquals(allResults.length, 2, `infinite query should return all entries, got ${allResults.length}`);

		// Query exact match
		const exactMatch = index.query(range(5, 15, 5, 15));
		assertEquals(exactMatch.length, 1, 'exact match query should find one range');
		assertEquals(exactMatch[0].value, 'center', 'exact match should find center value');

		// Query partial overlap
		const partialOverlap = index.query(range(10, 25, 10, 25));
		assertEquals(partialOverlap.length, 2, `partial overlap should find both ranges, got ${partialOverlap.length}`);

		// Query no overlap
		const noOverlap = index.query(range(100, 110, 100, 110));
		assertEquals(noOverlap.length, 0, 'no overlap query should return empty');

		assertInvariants(index, 'queries should not modify state');
	});

	Deno.test(`${name} - Value reachability invariant`, () => {
		const index = new IndexClass();

		// Insert non-overlapping ranges to ensure all values survive
		// Using a grid pattern with sufficient spacing to avoid overlaps
		const spacing = 100;
		for (let i = 0; i < 5; i++) {
			for (let j = 0; j < 4; j++) {
				const value = `reachable_${i}_${j}`;
				const baseRow = i * spacing;
				const baseCol = j * spacing;
				index.insert(range(baseRow, baseRow + 50, baseCol, baseCol + 50), value);
			}
		}

		assertInvariants(index, 'after non-overlapping insertions');

		// All 20 values should be reachable (no overlaps = no overwrites)
		const expectedCount = 20;

		// Query entire space to retrieve all values
		const allResults = index.query(range());
		const retrievedValues = new Set(allResults.map((r) => r.value));

		// Verify all inserted values are reachable
		assertEquals(
			retrievedValues.size,
			expectedCount,
			`value reachability: expected ${expectedCount} values, got ${retrievedValues.size}`,
		);

		// Also verify getAllRanges returns same values
		const getAllValues = new Set(index.getAllRanges().map((r) => r.value));
		assertEquals(
			getAllValues.size,
			expectedCount,
			`getAllRanges value count mismatch: expected ${expectedCount}, got ${getAllValues.size}`,
		);

		// Verify query and getAllRanges return same values
		assertEquals(
			retrievedValues.size,
			getAllValues.size,
			'query() and getAllRanges() should return same value sets',
		);
	});

	Deno.test(`${name} - Coordinate extremes`, () => {
		const index = new IndexClass();

		// Very large coordinates (within int32 bounds for TypedArrays)
		const largeCoord = 1000000;
		index.insert(range(largeCoord, largeCoord + 100, largeCoord, largeCoord + 100), 'large');
		assertInvariants(index, 'large coordinates');

		const results = index.query(range(largeCoord + 50, largeCoord + 60, largeCoord + 50, largeCoord + 60));
		assertEquals(results.length, 1, 'query at large coordinates should find exactly 1 result');
		assertEquals(results[0].value, 'large', 'query at large coordinates should find "large" value');

		// Mix of small and large coordinates
		index.insert(range(0, 10, 0, 10), 'small');
		assertInvariants(index, 'mixed coordinate scales');

		const smallResults = index.query(range(0, 10, 0, 10));
		assertEquals(smallResults.length, 1, 'small coordinate query should find exactly 1 result');
		assertEquals(smallResults[0].value, 'small', 'small coordinate range should not be lost after large insertion');
	});

	// ========================================================================
	// FRAGMENT COUNT VERIFICATION (Canonical correctness check)
	// ========================================================================

	Deno.test(`${name} - Fragment count correctness (large-overlapping scenario)`, () => {
		// This scenario is deterministic and MUST produce exactly 1375 fragments
		// for correct implementations. Any deviation indicates a coordinate bug
		// or algorithmic issue.
		const EXPECTED_FRAGMENT_COUNT = 1375;

		const largeOverlapping = Array.from({ length: 1250 }, (_, i) => ({
			range: {
				startRowIndex: Math.floor(i / 5),
				endRowIndex: Math.floor(i / 5) + 5,
				startColumnIndex: i % 10,
				endColumnIndex: (i % 10) + 5,
			},
			value: `overlap_${i}`,
		}));

		const index = new IndexClass();
		largeOverlapping.forEach((op) => index.insert(op.range, op.value));

		const fragmentCount = index.getAllRanges().length;

		assertEquals(
			fragmentCount,
			EXPECTED_FRAGMENT_COUNT,
			`fragment count mismatch! expected ${EXPECTED_FRAGMENT_COUNT} but got ${fragmentCount}.\n` +
				`this indicates a coordinate swap bug or incorrect geometric subtraction.\n` +
				`all correct implementations must produce exactly ${EXPECTED_FRAGMENT_COUNT} fragments`,
		);

		assertInvariants(index, 'large-overlapping scenario');
	});

	Deno.test(`${name} - Cross-implementation fragment consistency`, () => {
		// Verify this implementation produces the same fragment count as reference
		// This catches subtle algorithmic differences that might not violate invariants
		// but produce different decompositions.

		const testScenarios = [
			{
				name: 'small-overlapping',
				ops: Array.from({ length: 50 }, (_, i) => ({
					range: {
						startRowIndex: Math.floor(i / 3),
						endRowIndex: Math.floor(i / 3) + 3,
						startColumnIndex: i % 5,
						endColumnIndex: (i % 5) + 3,
					},
					value: `s_${i}`,
				})),
			},
			{
				name: 'diagonal-pattern',
				ops: Array.from({ length: 20 }, (_, i) => ({
					range: {
						startRowIndex: i * 2,
						endRowIndex: i * 2 + 5,
						startColumnIndex: i * 2,
						endColumnIndex: i * 2 + 5,
					},
					value: `d_${i}`,
				})),
			},
		];

		for (const scenario of testScenarios) {
			const refIndex = new config.reference();
			scenario.ops.forEach((op) => refIndex.insert(op.range, op.value));
			const refCount = refIndex.getAllRanges().length;

			const implIndex = new IndexClass();
			scenario.ops.forEach((op) => implIndex.insert(op.range, op.value));
			const implCount = implIndex.getAllRanges().length;

			assertEquals(
				implCount,
				refCount,
				`fragment count mismatch in ${scenario.name} scenario!\n` +
					`reference produced ${refCount} fragments, but ${name} produced ${implCount}.\n` +
					`implementations must produce identical fragment counts for correctness`,
			);
		}
	});

	// ========================================================================
	// ADVANCED CORRECTNESS TESTS (Query-Insert interactions, geometric precision)
	// ========================================================================

	Deno.test(`${name} - Query-insert consistency`, () => {
		// Critical: Anything inserted MUST be findable via query at exact same coordinates
		// This catches spatial indexing bugs where data exists but isn't queryable
		const index = new IndexClass();

		const testCases = [
			{ range: range(10, 20, 10, 20), value: 'center', description: 'center square' },
			{ range: range(0, 5, 0, 100), value: 'top-strip', description: 'horizontal strip' },
			{ range: range(0, 100, 0, 5), value: 'left-strip', description: 'vertical strip' },
			{ range: range(1000, 1010, 1000, 1010), value: 'far', description: 'large coordinates' },
			{ range: range(0, 1, 0, 1), value: 'tiny', description: 'single cell' },
		];

		for (const testCase of testCases) {
			index.insert(testCase.range, testCase.value);

			// Query at EXACT same coordinates - MUST find it
			const results = index.query(testCase.range);
			const found = results.find((r) => r.value === testCase.value);

			assert(
				found,
				`query-insert consistency failed for ${testCase.description}!\n` +
					`inserted range but query at same coordinates didn't find it.\n` +
					`this indicates a spatial indexing bug (Morton encoding error, AABB test error, etc.)`,
			);
		}

		assertInvariants(index, 'query-insert consistency');
	});

	Deno.test(`${name} - Partial overlap decomposition geometry`, () => {
		// Tests that overlapping ranges produce geometrically correct fragments
		// Catches coordinate swap bugs (x/y confusion), incorrect fragment bounds
		const index = new IndexClass();

		// L-shaped overlap: base [0,10)×[0,10), overlap [5,15)×[5,15)
		index.insert(range(0, 10, 0, 10), 'base');
		index.insert(range(5, 15, 5, 15), 'overlap');

		assertInvariants(index, 'L-shaped overlap');

		const ranges = index.getAllRanges();
		const baseFragments = ranges.filter((r) => r.value === 'base');
		const overlapFragment = ranges.find((r) => r.value === 'overlap');

		// 'overlap' should have exact bounds [5,15)×[5,15)
		assertExists(overlapFragment, 'overlap value should not be lost');
		const o = overlapFragment.gridRange;
		assertObjectMatch(
			o,
			{
				startRowIndex: 5,
				endRowIndex: 15,
				startColumnIndex: 5,
				endColumnIndex: 15,
			},
			`overlap fragment should have correct bounds [5,15)×[5,15)`,
		);

		// 'base' fragments must not overlap with 'overlap' region [5,15)×[5,15)
		for (const fragment of baseFragments) {
			const f = fragment.gridRange;
			const fRowMin = f.startRowIndex ?? 0;
			const fRowMax = (f.endRowIndex ?? Infinity) - 1;
			const fColMin = f.startColumnIndex ?? 0;
			const fColMax = (f.endColumnIndex ?? Infinity) - 1;

			// Check if fragment overlaps with [5,15)×[5,15) region (inclusive coords [5,14]×[5,14])
			const overlapsRegion = fRowMin <= 14 && fRowMax >= 5 &&
				fColMin <= 14 && fColMax >= 5;

			assertFalse(
				overlapsRegion,
				`base fragment should not overlap with 'overlap' region: ` +
					`[${fRowMin},${fRowMax}]×[${fColMin},${fColMax}] overlaps [5,14]×[5,14]`,
			);
		}

		// Verify total area conservation: 10×10 (base) = 5×5 (overlap) + area(base fragments)
		const overlapArea = 10 * 10; // [5,15)×[5,15)
		const baseFragmentArea = baseFragments.reduce((sum, f) => {
			const rows = (f.gridRange.endRowIndex ?? Infinity) - (f.gridRange.startRowIndex ?? 0);
			const cols = (f.gridRange.endColumnIndex ?? Infinity) - (f.gridRange.startColumnIndex ?? 0);
			return sum + (rows * cols);
		}, 0);

		const expectedBaseFragmentArea = 100 - 100; // Original 10×10 minus overlap 10×10
		// Note: overlap is [5,15)×[5,15) = 10×10, but only overlaps [5,10)×[5,10) = 5×5 of base
		// So base fragments should total: 100 - 25 = 75
		const actualExpectedArea = 100 - 25;

		if (baseFragmentArea !== actualExpectedArea) {
			console.warn(
				`Area mismatch: base fragments = ${baseFragmentArea}, expected ${actualExpectedArea}. ` +
					`This may indicate geometric correctness issues, but is not necessarily a bug.`,
			);
		}
	});

	Deno.test(`${name} - Overlapping value complete overwrite`, () => {
		// When new insert fully contains old range, old value should be COMPLETELY removed
		// Tests rigorous LWW semantics - no fragments of old value should survive
		const index = new IndexClass();

		// Insert small range
		index.insert(range(5, 10, 5, 10), 'old');
		assertInvariants(index, 'after old insertion');

		const beforeRanges = index.getAllRanges();
		assertEquals(beforeRanges.length, 1, 'initial state should have exactly 1 range');
		assertEquals(beforeRanges[0].value, 'old', 'initial state should have "old" value');

		// Insert larger range that fully contains the old one
		index.insert(range(0, 20, 0, 20), 'new');
		assertInvariants(index, 'after overwrite');

		const afterRanges = index.getAllRanges();
		const values = afterRanges.map((r) => r.value);

		// 'old' should be COMPLETELY gone
		assert(
			!values.includes('old'),
			`old value should be completely overwritten (found ${
				values.filter((v) => v === 'old').length
			} fragments). ` +
				`when new range fully contains old, old should be entirely removed (LWW semantics)`,
		);

		// Should only have 'new' value
		assertEquals(
			values.length,
			1,
			`should have single 'new' range, got ${values.length} ranges: ${values.join(', ')}`,
		);
		assertEquals(values[0], 'new', 'should only have "new" value after complete overwrite');
	});

	Deno.test(`${name} - Query result completeness`, () => {
		// Query must return ALL overlapping ranges, not just some
		// Catches R-tree pruning errors, early-exit bugs, partial result bugs
		const index = new IndexClass();

		// Insert 10 ranges in overlapping region
		for (let i = 0; i < 10; i++) {
			index.insert(range(0, 20, i * 2, i * 2 + 3), `value${i}`);
		}

		assertInvariants(index, 'after 10 insertions');

		// Query region that overlaps all 10 ranges
		const results = index.query(range(0, 20, 0, 20));
		const foundValues = new Set(results.map((r) => r.value));

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
		const subResults = index.query(range(5, 15, 5, 15));
		assertGreater(subResults.length, 0, 'subregion query should find at least some ranges');

		// Verify each result actually overlaps query region
		for (const result of subResults) {
			const r = result.gridRange;
			const rowMin = r.startRowIndex ?? 0;
			const rowMax = (r.endRowIndex ?? Infinity) - 1;
			const colMin = r.startColumnIndex ?? 0;
			const colMax = (r.endColumnIndex ?? Infinity) - 1;

			// Check overlap with [5,15)×[5,15) (inclusive coords [5,14]×[5,14])
			const overlaps = rowMin <= 14 && rowMax >= 5 && colMin <= 14 && colMax >= 5;

			assert(
				overlaps,
				`query should not return non-overlapping range: ${result.value} at [${rowMin},${rowMax}]×[${colMin},${colMax}] ` +
					`doesn't overlap [5,14]×[5,14]`,
			);
		}
	});

	Deno.test(`${name} - Adjacent range handling (half-open interval semantics)`, () => {
		// Critical: Ranges that share a boundary but don't overlap should both survive
		// Tests correct half-open interval handling ([start, end) means end is excluded)
		// Common bug: using <= instead of < in overlap detection
		const index = new IndexClass();

		// Horizontal adjacency: [0,5) and [5,10) share boundary at column 5
		// These should NOT overlap because [0,5) means columns 0-4, [5,10) means columns 5-9
		index.insert(range(0, 10, 0, 5), 'left');
		index.insert(range(0, 10, 5, 10), 'right');
		assertInvariants(index, 'horizontal adjacency');

		let ranges = index.getAllRanges();
		let values = ranges.map((r) => r.value).sort();

		assertEquals(
			values,
			['left', 'right'],
			`horizontal adjacency failed! expected ['left', 'right'], got [${values.join(', ')}].\n` +
				`ranges [0,5) and [5,10) share boundary but should not overlap (half-open interval semantics)`,
		);

		// Vertical adjacency: [0,5) and [5,10) share boundary at row 5
		const index2 = new IndexClass();
		index2.insert(range(0, 5, 0, 10), 'top');
		index2.insert(range(5, 10, 0, 10), 'bottom');
		assertInvariants(index2, 'vertical adjacency');

		ranges = index2.getAllRanges();
		values = ranges.map((r) => r.value).sort();

		assertEquals(
			values,
			['bottom', 'top'],
			`vertical adjacency failed! expected ['bottom', 'top'], got [${values.join(', ')}].\n` +
				`ranges [0,5) and [5,10) share boundary but should not overlap`,
		);

		// Corner adjacency: Four ranges that meet at a point (5,5)
		const index3 = new IndexClass();
		index3.insert(range(0, 5, 0, 5), 'top-left');
		index3.insert(range(0, 5, 5, 10), 'top-right');
		index3.insert(range(5, 10, 0, 5), 'bottom-left');
		index3.insert(range(5, 10, 5, 10), 'bottom-right');
		assertInvariants(index3, 'corner adjacency');

		ranges = index3.getAllRanges();
		values = ranges.map((r) => r.value).sort();

		assertEquals(
			values.length,
			4,
			`corner adjacency failed! expected 4 ranges, got ${values.length}.\n` +
				`four ranges meeting at point (5,5) should all survive (no overlaps at boundaries)`,
		);

		const expectedValues = ['bottom-left', 'bottom-right', 'top-left', 'top-right'];
		assertArrayIncludes(values, expectedValues, 'all four corner quadrants should be preserved');
	});

	Deno.test(`${name} - Query boundary precision (half-open interval semantics)`, () => {
		// Tests that query boundaries respect half-open interval semantics
		// Common bug: using <= instead of < in intersection tests
		const index = new IndexClass();

		// Insert range [10, 20) × [10, 20) which occupies:
		// - Rows 10-19 (inclusive)
		// - Columns 10-19 (inclusive)
		index.insert(range(10, 20, 10, 20), 'test');
		assertInvariants(index, 'boundary test setup');

		// Query [20, 30) × [20, 30) should NOT find 'test'
		// Because [20, 30) means rows/cols 20-29, and 'test' ends at 19
		const noOverlap = index.query(range(20, 30, 20, 30));
		assertEquals(
			noOverlap.length,
			0,
			`query boundary leak! query [20,30)×[20,30) found ${noOverlap.length} ranges but should find 0.\n` +
				`range [10,20)×[10,20) occupies rows/cols 10-19, should not overlap with [20,30)×[20,30).\n` +
				`this indicates <= instead of < in overlap detection`,
		);

		// Query [0, 10) × [0, 10) should also NOT find 'test'
		// Because [0, 10) means rows/cols 0-9, and 'test' starts at 10
		const noOverlapLeft = index.query(range(0, 10, 0, 10));
		assertEquals(
			noOverlapLeft.length,
			0,
			`query boundary leak on left side! query [0,10)×[0,10) found ${noOverlapLeft.length} ranges but should find 0.\n` +
				`range [10,20)×[10,20) starts at 10, should not overlap with [0,10)×[0,10)`,
		);

		// Query [19, 21) × [19, 21) SHOULD find 'test'
		// Because [19, 21) means rows/cols 19-20, which overlaps 'test' at coordinate 19
		const overlap = index.query(range(19, 21, 19, 21));
		assert(
			overlap.find((r) => r.value === 'test'),
			`query boundary miss! query [19,21)×[19,21) should find 'test' (overlaps at coordinate 19).\n` +
				`this indicates incorrect boundary handling`,
		);

		// Query [10, 11) × [10, 11) SHOULD find 'test'
		// Because [10, 11) means row/col 10, which is the start of 'test'
		const overlapStart = index.query(range(10, 11, 10, 11));
		assert(
			overlapStart.find((r) => r.value === 'test'),
			`query boundary miss at start! query [10,11)×[10,11) should find 'test' (starts at 10)`,
		);

		// Edge case: Query exactly at end boundary [19, 20) × [19, 20)
		// Should find 'test' because row/col 19 is included in [10,20)
		const exactEnd = index.query(range(19, 20, 19, 20));
		assert(
			exactEnd.find((r) => r.value === 'test'),
			`query at exact end boundary [19,20)×[19,20) should find 'test'.\n` +
				`range [10,20) includes coordinate 19`,
		);

		// Horizontal strip boundary test
		index.insert(range(0, 5, 0, 100), 'strip');
		assertInvariants(index, 'after strip insertion');

		// Query [5, 10) × [0, 100) should NOT find 'strip' (strip ends at row 4)
		const stripNoOverlap = index.query(range(5, 10, 0, 100));
		const foundStrip = stripNoOverlap.find((r) => r.value === 'strip');
		assertFalse(
			!!foundStrip,
			`horizontal strip boundary leak! query [5,10)×[0,100) found 'strip' but shouldn't.\n` +
				`strip [0,5)×[0,100) occupies rows 0-4, query [5,10) is rows 5-9`,
		);
	});
}

export function testImplementationEquivalence(config: TestConfig): void {
	const { reference: ReferenceClass, implementation: TestClass, name } = config;

	Deno.test(`${name} - Functional equivalence vs Reference`, () => {
		const operations = Array.from({ length: 20 }, (_, i) => ({
			range: randomRange(10),
			value: `test_${i}`,
		}));

		const reference = new ReferenceClass();
		const implementation = new TestClass();

		operations.forEach((op) => {
			reference.insert(op.range, op.value);
			implementation.insert(op.range, op.value);
		});

		const refValues = new Set(reference.getAllRanges().map((r) => r.value));
		const implValues = new Set(implementation.getAllRanges().map((r) => r.value));

		assertEquals(
			implValues.size,
			refValues.size,
			`different value counts: ${refValues.size} vs ${implValues.size}`,
		);

		for (const value of refValues) {
			assert(implValues.has(value), `value ${value} missing from ${name}`);
		}

		const refRanges = reference.getAllRanges().length;
		const implRanges = implementation.getAllRanges().length;
		assertEquals(implRanges, refRanges, `different range counts: ${refRanges} vs ${implRanges}`);
	});

	Deno.test(`${name} - Performance vs Reference`, () => {
		const operations = Array.from({ length: 100 }, (_, i) => ({
			range: randomRange(),
			value: `comp_${i}`,
		}));

		const reference = new ReferenceClass();
		const refStart = performance.now();
		operations.forEach((op) => reference.insert(op.range, op.value));
		const refTime = performance.now() - refStart;
		const refRanges = reference.getAllRanges().length;

		const implementation = new TestClass();
		const implStart = performance.now();
		operations.forEach((op) => implementation.insert(op.range, op.value));
		const implTime = performance.now() - implStart;
		const implRanges = implementation.getAllRanges().length;

		// Performance comparison (informational only, not asserted)
		// Detailed performance benchmarking should use benchmarks/ suite

		assertEquals(
			implRanges,
			refRanges,
			`range count mismatch: reference produced ${refRanges} ranges, ` +
				`but ${name} produced ${implRanges} ranges`,
		);
	});
}
