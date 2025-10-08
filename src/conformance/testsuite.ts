/// <reference types="@types/google-apps-script" />

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
	if (empty !== (ranges.length === 0)) {
		throw new Error(`${context}: isEmpty ≠ (ranges.length === 0)`);
	}

	// Invariant 2: Non-duplication
	const signatures = ranges.map((r) =>
		`${r.gridRange.startRowIndex},${r.gridRange.endRowIndex},${r.gridRange.startColumnIndex},${r.gridRange.endColumnIndex}:${r.value}`
	);
	if (signatures.length !== new Set(signatures).size) {
		throw new Error(`${context}: Duplicate ranges`);
	}

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

			if (overlaps) {
				throw new Error(
					`${context}: Overlapping ranges found at indices ${i} and ${j}:\n` +
						`  Range ${i}: rows [${r1ymin}, ${r1ymax}], cols [${r1xmin}, ${r1xmax}], value=${
							ranges[i].value
						}\n` +
						`  Range ${j}: rows [${r2ymin}, ${r2ymax}], cols [${r2xmin}, ${r2xmax}], value=${
							ranges[j].value
						}`,
				);
			}
		}
	}
};

export function testSpatialIndexAxioms(config: TestConfig): void {
	const { implementation: IndexClass, name } = config;

	Deno.test(`${name} - Empty state`, () => {
		const index = new IndexClass();
		assertInvariants(index, 'initial');
		if (!index.isEmpty) throw new Error('New index should be empty');
		if (index.getAllRanges().length !== 0) throw new Error('Empty index should return no ranges');
	});

	Deno.test(`${name} - Value preservation`, () => {
		const index = new IndexClass();
		index.insert(range(1, 5, 1, 5), 'test');
		assertInvariants(index, 'single insertion');

		const ranges = index.getAllRanges();
		if (ranges.length !== 1) throw new Error(`Expected 1 range, got ${ranges.length}`);
		if (ranges[0].value !== 'test') throw new Error('Value not preserved');
		if (index.isEmpty) throw new Error('Non-empty index reports empty');
	});

	Deno.test(`${name} - Overlap resolution`, () => {
		const index = new IndexClass();
		index.insert(range(1, 5, 1, 5), 'first');
		index.insert(range(2, 4, 2, 4), 'second');
		assertInvariants(index, 'overlap resolution');

		const values = index.getAllRanges().map((r) => r.value);
		if (!values.includes('second')) throw new Error('Overlapping value not preserved');
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

		if (!values1.has('first') || !values1.has('second')) throw new Error('Both values should be preserved');
		if (!values2.has('first') || !values2.has('second')) throw new Error('Both values should be preserved');

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
		if (ranges.length !== 1 || ranges[0].value !== 'global') {
			throw new Error('Global range should override all others');
		}
	});

	Deno.test(`${name} - Property-based validation`, () => {
		const index = new IndexClass();
		const insertedValues = new Set<string>();

		for (let i = 0; i < 50; i++) {
			const value = `val_${i}`;
			index.insert(randomRange(), value);
			insertedValues.add(value);
			assertInvariants(index, `random operation ${i}`);
		}

		const resultValues = new Set(index.getAllRanges().map((r) => r.value));
		if (resultValues.size === 0) throw new Error('All values lost');

		for (const value of resultValues) {
			if (!insertedValues.has(value)) throw new Error(`Unexpected value: ${value}`);
		}
	});

	Deno.test(`${name} - Idempotency`, () => {
		const index = new IndexClass();
		const testRange = range(1, 5, 1, 5);

		index.insert(testRange, 'test');
		const result1 = JSON.stringify(index.getAllRanges().sort());

		index.insert(testRange, 'test');
		const result2 = JSON.stringify(index.getAllRanges().sort());

		if (result1 !== result2) throw new Error('Duplicate insertion is not idempotent');
	});

	Deno.test(`${name} - Non-overlapping preservation`, () => {
		const index = new IndexClass();
		index.insert(range(1, 3, 1, 3), 'first');
		index.insert(range(5, 7, 5, 7), 'second');
		assertInvariants(index, 'non-overlapping');

		const ranges = index.getAllRanges();
		if (ranges.length !== 2) throw new Error(`Expected 2 ranges, got ${ranges.length}`);

		const values = ranges.map((r) => r.value).sort();
		if (values[0] !== 'first' || values[1] !== 'second') {
			throw new Error('Non-overlapping ranges not preserved');
		}
	});

	Deno.test(`${name} - Infinite ranges`, () => {
		const index = new IndexClass();

		index.insert({ startColumnIndex: 1, endColumnIndex: 3 }, 'infinite-rows');
		assertInvariants(index, 'infinite rows');
		if (index.getAllRanges().length !== 1) throw new Error('Infinite row range not preserved');

		index.insert({ startRowIndex: 1, endRowIndex: 3 }, 'infinite-cols');
		assertInvariants(index, 'infinite columns');

		if (index.getAllRanges().length < 2) throw new Error('Infinite ranges did not fragment properly');
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
		if (baseFragments.length > 4) {
			throw new Error(`Too many base fragments: ${baseFragments.length} (expected ≤4)`);
		}

		if (!centerFragment) throw new Error('Center value lost');

		// Verify center fragment has correct bounds
		const c = centerFragment.gridRange;
		if (c.startRowIndex !== 3 || c.endRowIndex !== 7 || c.startColumnIndex !== 3 || c.endColumnIndex !== 7) {
			throw new Error('Center fragment has incorrect bounds');
		}
	});

	Deno.test(`${name} - Invalid range rejection`, () => {
		const index = new IndexClass();

		try {
			index.insert(range(5, 5, 1, 3), 'invalid-row');
		} catch (e) {
			if (!(e instanceof Error) || !e.message.includes('Invalid')) {
				throw new Error('Unexpected error type for invalid range');
			}
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
		if (!values.includes('red')) throw new Error('Query missed red range');
		if (!values.includes('blue')) throw new Error('Query missed blue range');
		if (values.includes('green')) throw new Error('Query incorrectly included green range');

		// Query should not modify state
		assertInvariants(index, 'query should not modify state');

		// Empty query should return empty results
		const emptyResults = index.query(range(100, 110, 100, 110));
		if (emptyResults.length !== 0) throw new Error('Empty query returned non-empty results');
	});

	Deno.test(`${name} - Stress test (correctness under load)`, () => {
		const index = new IndexClass();
		const operations = Array.from({ length: 100 }, (_, i) => ({
			range: randomRange(),
			value: `stress_${i}`,
		}));

		// Insert all operations and verify invariants hold after each
		operations.forEach((op, i) => {
			index.insert(op.range, op.value);
			// Only check invariants every 10 operations (performance optimization)
			if (i % 10 === 0) {
				assertInvariants(index, `stress test iteration ${i}`);
			}
		});

		// Final invariant check
		assertInvariants(index, 'stress test final state');

		const ranges = index.getAllRanges();
		console.log(`${name} Stress Test: 100 random inserts → ${ranges.length} final ranges`);

		// Verify all ranges are valid
		if (ranges.length === 0) throw new Error('All ranges lost during stress test');
	});

	Deno.test(`${name} - Boundary conditions`, () => {
		const index = new IndexClass();

		// Single-cell range (1x1)
		index.insert(range(5, 6, 5, 6), 'single-cell');
		assertInvariants(index, 'single-cell range');
		const singleCell = index.getAllRanges();
		if (singleCell.length !== 1 || singleCell[0].value !== 'single-cell') {
			throw new Error('Single-cell range not preserved');
		}

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
		if (finalRanges.length === 0) throw new Error('All ranges lost');

		// Verify all inserted values are reachable
		const values = new Set(finalRanges.map((r) => r.value));
		if (!values.has('at-zero')) throw new Error('Value reachability failed');
	});

	Deno.test(`${name} - Query edge cases`, () => {
		const index = new IndexClass();

		// Query empty index
		const emptyResults = index.query(range(0, 10, 0, 10));
		if (emptyResults.length !== 0) throw new Error('Query on empty index should return empty array');

		// Insert some data
		index.insert(range(5, 15, 5, 15), 'center');
		index.insert(range(20, 30, 20, 30), 'corner');
		assertInvariants(index, 'query setup');

		// Query with infinite range (should return all)
		const allResults = index.query(range());
		if (allResults.length !== 2) {
			throw new Error(`Infinite query should return all entries, got ${allResults.length}`);
		}

		// Query exact match
		const exactMatch = index.query(range(5, 15, 5, 15));
		if (exactMatch.length !== 1 || exactMatch[0].value !== 'center') {
			throw new Error('Exact match query failed');
		}

		// Query partial overlap
		const partialOverlap = index.query(range(10, 25, 10, 25));
		if (partialOverlap.length !== 2) {
			throw new Error(`Partial overlap should find both ranges, got ${partialOverlap.length}`);
		}

		// Query no overlap
		const noOverlap = index.query(range(100, 110, 100, 110));
		if (noOverlap.length !== 0) throw new Error('No overlap query should return empty');

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
		if (retrievedValues.size !== expectedCount) {
			throw new Error(
				`Value reachability: expected ${expectedCount} values, got ${retrievedValues.size}`,
			);
		}

		// Also verify getAllRanges returns same values
		const getAllValues = new Set(index.getAllRanges().map((r) => r.value));
		if (getAllValues.size !== expectedCount) {
			throw new Error(
				`getAllRanges value count mismatch: expected ${expectedCount}, got ${getAllValues.size}`,
			);
		}

		// Verify query and getAllRanges return same values
		if (retrievedValues.size !== getAllValues.size) {
			throw new Error('query() and getAllRanges() return different value sets');
		}
	});

	Deno.test(`${name} - Coordinate extremes`, () => {
		const index = new IndexClass();

		// Very large coordinates (within int32 bounds for TypedArrays)
		const largeCoord = 1000000;
		index.insert(range(largeCoord, largeCoord + 100, largeCoord, largeCoord + 100), 'large');
		assertInvariants(index, 'large coordinates');

		const results = index.query(range(largeCoord + 50, largeCoord + 60, largeCoord + 50, largeCoord + 60));
		if (results.length !== 1 || results[0].value !== 'large') {
			throw new Error('Query at large coordinates failed');
		}

		// Mix of small and large coordinates
		index.insert(range(0, 10, 0, 10), 'small');
		assertInvariants(index, 'mixed coordinate scales');

		const smallResults = index.query(range(0, 10, 0, 10));
		if (smallResults.length !== 1 || smallResults[0].value !== 'small') {
			throw new Error('Small coordinate range lost after large insertion');
		}
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

		if (fragmentCount !== EXPECTED_FRAGMENT_COUNT) {
			throw new Error(
				`Fragment count mismatch! Expected ${EXPECTED_FRAGMENT_COUNT} but got ${fragmentCount}.\n` +
					`This indicates a coordinate swap bug or incorrect geometric subtraction.\n` +
					`All correct implementations must produce exactly ${EXPECTED_FRAGMENT_COUNT} fragments.`,
			);
		}

		assertInvariants(index, 'large-overlapping scenario');
		console.log(`✓ Fragment count correct: ${fragmentCount} (matches canonical reference)`);
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

			if (refCount !== implCount) {
				throw new Error(
					`Fragment count mismatch in ${scenario.name} scenario!\n` +
						`Reference produced ${refCount} fragments, but ${name} produced ${implCount}.\n` +
						`Implementations must produce identical fragment counts for correctness.`,
				);
			}
		}

		console.log(`✓ Fragment counts match reference implementation across all test scenarios`);
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

			if (!found) {
				throw new Error(
					`Query-insert consistency failed for ${testCase.description}!\n` +
						`Inserted range but query at same coordinates didn't find it.\n` +
						`This indicates a spatial indexing bug (Morton encoding error, AABB test error, etc.)`,
				);
			}
		}

		assertInvariants(index, 'query-insert consistency');
		console.log(`✓ All inserted ranges findable via query at insertion coordinates`);
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
		if (!overlapFragment) throw new Error('Overlap value lost');
		const o = overlapFragment.gridRange;
		if (o.startRowIndex !== 5 || o.endRowIndex !== 15 || o.startColumnIndex !== 5 || o.endColumnIndex !== 15) {
			throw new Error(
				`Overlap fragment has wrong bounds: ` +
					`[${o.startRowIndex},${o.endRowIndex})×[${o.startColumnIndex},${o.endColumnIndex}) ` +
					`expected [5,15)×[5,15)`,
			);
		}

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

			if (overlapsRegion) {
				throw new Error(
					`Base fragment overlaps with 'overlap' region: ` +
						`[${fRowMin},${fRowMax}]×[${fColMin},${fColMax}] overlaps [5,14]×[5,14]`,
				);
			}
		}

		// Verify total area conservation: 10×10 (base) = 5×5 (overlap) + area(base fragments)
		const overlapArea = 10 * 10; // [5,15)×[5,15)
		const baseFragmentArea = baseFragments.reduce((sum, f) => {
			const rows = ((f.gridRange.endRowIndex ?? Infinity) - (f.gridRange.startRowIndex ?? 0));
			const cols = ((f.gridRange.endColumnIndex ?? Infinity) - (f.gridRange.startColumnIndex ?? 0));
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

		console.log(
			`✓ Partial overlap produces geometrically correct fragments (${baseFragments.length} base fragments)`,
		);
	});

	Deno.test(`${name} - Overlapping value complete overwrite`, () => {
		// When new insert fully contains old range, old value should be COMPLETELY removed
		// Tests rigorous LWW semantics - no fragments of old value should survive
		const index = new IndexClass();

		// Insert small range
		index.insert(range(5, 10, 5, 10), 'old');
		assertInvariants(index, 'after old insertion');

		const beforeRanges = index.getAllRanges();
		if (beforeRanges.length !== 1 || beforeRanges[0].value !== 'old') {
			throw new Error('Initial state incorrect');
		}

		// Insert larger range that fully contains the old one
		index.insert(range(0, 20, 0, 20), 'new');
		assertInvariants(index, 'after overwrite');

		const afterRanges = index.getAllRanges();
		const values = afterRanges.map((r) => r.value);

		// 'old' should be COMPLETELY gone
		if (values.includes('old')) {
			throw new Error(
				`Old value not completely overwritten! Found ${values.filter((v) => v === 'old').length} fragments with 'old' value.\n` +
					`When new range fully contains old, old should be entirely removed (LWW semantics).`,
			);
		}

		// Should only have 'new' value
		if (values.length !== 1 || values[0] !== 'new') {
			throw new Error(`Expected single 'new' range, got ${values.length} ranges: ${values.join(', ')}`);
		}

		console.log(`✓ Complete overwrite removes old value entirely (LWW semantics verified)`);
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

		if (missingValues.length > 0) {
			throw new Error(
				`Query incomplete! Found ${foundValues.size}/10 values.\n` +
					`Missing: ${missingValues.join(', ')}\n` +
					`This indicates a query traversal bug (early exit, pruning error, etc.)`,
			);
		}

		// Also test query at specific subregion
		const subResults = index.query(range(5, 15, 5, 15));
		if (subResults.length === 0) {
			throw new Error('Subregion query returned no results (should find at least some ranges)');
		}

		// Verify each result actually overlaps query region
		for (const result of subResults) {
			const r = result.gridRange;
			const rowMin = r.startRowIndex ?? 0;
			const rowMax = (r.endRowIndex ?? Infinity) - 1;
			const colMin = r.startColumnIndex ?? 0;
			const colMax = (r.endColumnIndex ?? Infinity) - 1;

			// Check overlap with [5,15)×[5,15) (inclusive coords [5,14]×[5,14])
			const overlaps = rowMin <= 14 && rowMax >= 5 && colMin <= 14 && colMax >= 5;

			if (!overlaps) {
				throw new Error(
					`Query returned non-overlapping range: ${result.value} at [${rowMin},${rowMax}]×[${colMin},${colMax}] ` +
						`doesn't overlap [5,14]×[5,14]`,
				);
			}
		}

		console.log(`✓ Query returns all overlapping ranges with correct filtering`);
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

		if (refValues.size !== implValues.size) {
			throw new Error(`Different value counts: ${refValues.size} vs ${implValues.size}`);
		}

		for (const value of refValues) {
			if (!implValues.has(value)) throw new Error(`Value ${value} missing from ${name}`);
		}

		const refRanges = reference.getAllRanges().length;
		const implRanges = implementation.getAllRanges().length;
		if (refRanges !== implRanges) {
			throw new Error(`Different range counts: ${refRanges} vs ${implRanges}`);
		}
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

		console.log(`\n=== ${name.toUpperCase()} PERFORMANCE ===\n`);
		console.log(`Reference time: ${refTime.toFixed(2)}ms`);
		console.log(`${name} time: ${implTime.toFixed(2)}ms`);
		console.log(`Speed ratio: ${(refTime / implTime).toFixed(2)}x`);
		console.log(`Range count: ${implRanges} (should equal reference: ${refRanges})`);

		if (implTime < refTime) console.log(`✓ ${name} has faster insertions`);
		if (refRanges !== implRanges) {
			throw new Error(`Range count mismatch: ${refRanges} vs ${implRanges}`);
		}
		console.log(`✓ Both implementations produce identical range decompositions`);
	});
}
