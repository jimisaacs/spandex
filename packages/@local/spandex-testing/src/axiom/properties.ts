/**
 * Mathematical Property Axioms
 *
 * Tests fundamental mathematical properties that ALL spatial index implementations must satisfy.
 * These tests verify correctness independent of visual representation.
 */

import type { Rectangle, SpatialIndex } from '@jim/spandex';
import * as r from '@jim/spandex/r';
import { assert, assertArrayIncludes, assertEquals, assertFalse, assertGreater, assertIsError } from '@std/assert';
import { CANONICAL_FRAGMENT_COUNTS } from './canonical-values.ts';

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
	const signatures = ranges.map((result) =>
		`${result[0][0]},${result[0][1]},${result[0][2]},${result[0][3]}:${result[1]}`
	);
	assertEquals(signatures.length, new Set(signatures).size, `${context}: duplicate ranges`);

	// Invariant 2: Disjoint (no overlapping rectangles)
	for (let i = 0; i < ranges.length; i++) {
		for (let j = i + 1; j < ranges.length; j++) {
			const r1 = ranges[i]![0];
			const r2 = ranges[j]![0];

			const [r1xmin, r1ymin, r1xmax, r1ymax] = r1;
			const [r2xmin, r2ymin, r2xmax, r2ymax] = r2;

			// AABB overlap test
			const overlaps = r1xmin <= r2xmax && r2xmin <= r1xmax &&
				r1ymin <= r2ymax && r2ymin <= r1ymax;

			assertFalse(
				overlaps,
				`${context}: overlapping ranges found at indices ${i} and ${j}:\n` +
					`  Range ${i}: rows [${r1ymin}, ${r1ymax}], cols [${r1xmin}, ${r1xmax}], value=${ranges[i]![1]}\n` +
					`  Range ${j}: rows [${r2ymin}, ${r2ymax}], cols [${r2xmin}, ${r2xmax}], value=${ranges[j]![1]}`,
			);
		}
	}
};

export async function testPropertyAxioms(
	t: Deno.TestContext,
	implementation: () => SpatialIndex<string>,
): Promise<void> {
	//#region State Properties

	await t.step('Empty state', () => {
		const index = implementation();
		assertInvariants(index, 'initial');
		assertEquals(Array.from(index.query()).length, 0, 'empty index should return no ranges');
	});

	await t.step('Value preservation', () => {
		const index = implementation();
		index.insert(r.make(1, 1, 4, 4), 'test');
		assertInvariants(index, 'single insertion');

		const ranges = Array.from(index.query());
		assertEquals(ranges.length, 1, `expected 1 range, got ${ranges.length}`);
		assertEquals(ranges[0]![1], 'test', 'value should be preserved');
	});

	await t.step('Idempotency', () => {
		const index = implementation();
		const testRange = r.make(1, 1, 4, 4);

		const sortFn = (
			a: readonly [Readonly<Rectangle>, string],
			b: readonly [Readonly<Rectangle>, string],
		) => {
			const [ax, ay, ax2, ay2] = a[0];
			const [bx, by, bx2, by2] = b[0];
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
	//#endregion State Properties

	//#region Boundary Handling

	await t.step('Infinite ranges', () => {
		const index = implementation();

		index.insert([1, 0, 2, r.posInf], 'infinite-rows');
		assertInvariants(index, 'infinite rows');
		assertEquals(Array.from(index.query()).length, 1, 'infinite row range should be preserved');

		index.insert([0, 1, r.posInf, 2], 'infinite-cols');
		assertInvariants(index, 'infinite columns');

		assertGreater(Array.from(index.query()).length, 1, 'infinite ranges should fragment properly');
	});

	await t.step('Invalid range rejection', () => {
		const index = implementation();

		let threw = false;
		try {
			index.insert(r.make(1, 5, 2, 4), 'invalid-row'); // ymin=5 > ymax=4
		} catch (e) {
			threw = true;
			assertIsError(e, Error);
			assert(
				e.message.toLowerCase().includes('invalid') ||
					e.message.toLowerCase().includes('coordinate') ||
					e.message.toLowerCase().includes('range'),
				`error message should mention invalid range, got: "${e.message}"`,
			);
		}
		assert(threw, 'MUST throw error for backwards Y coordinates (ymin > ymax)');

		threw = false;
		try {
			index.insert(r.make(5, 1, 4, 2), 'invalid-col');
		} catch (e) {
			threw = true;
			assertIsError(e, Error);
		}
		assert(threw, 'MUST throw error for backwards X coordinates (xmin > xmax)');

		assertInvariants(index, 'after invalid insertion attempts');
		assert(index.query().next().done, 'index should remain empty after rejected inserts');
	});

	await t.step('Coordinate extremes', () => {
		const index = implementation();

		const largeCoord = 1000000;
		index.insert(r.make(largeCoord, largeCoord, largeCoord + 99, largeCoord + 99), 'large');
		assertInvariants(index, 'large coordinates');

		const results = Array.from(
			index.query(r.make(largeCoord + 50, largeCoord + 50, largeCoord + 59, largeCoord + 59)),
		);
		assertEquals(results.length, 1, 'query at large coordinates should find exactly 1 result');
		assertEquals(results[0]![1], 'large');

		index.insert(r.make(0, 0, 9, 9), 'small');
		assertInvariants(index, 'mixed coordinate scales');

		const smallResults = Array.from(index.query(r.make(0, 0, 9, 9)));
		assertEquals(smallResults.length, 1);
		assertEquals(smallResults[0]![1], 'small', 'small coordinate range should survive large insertion');
	});
	//#endregion Boundary Handling

	//#region Query Correctness

	await t.step('Query basic', () => {
		const index = implementation();

		index.insert(r.make(1, 1, 4, 4), 'red');
		index.insert(r.make(10, 10, 14, 14), 'blue');
		index.insert(r.make(20, 20, 24, 24), 'green');
		assertInvariants(index, 'query setup');

		const results = Array.from(index.query(r.make(3, 3, 11, 11)));
		const values = results.map((result) => result[1]);
		assertArrayIncludes(values, ['red']);
		assertArrayIncludes(values, ['blue']);
		assert(!values.includes('green'));

		assertInvariants(index, 'query should not modify state');

		const emptyResults = Array.from(index.query(r.make(100, 100, 109, 109)));
		assertEquals(emptyResults.length, 0);
	});

	await t.step('Query without bounds returns all', () => {
		const index = implementation();

		index.insert(r.make(0, 0, 4, 4), 'topleft');
		index.insert(r.make(10, 10, 14, 14), 'center');
		index.insert(r.make(20, 5, 24, 9), 'rightmid');
		index.insert(r.make(5, 20, 9, 24), 'botmid');

		assertInvariants(index, 'after inserts');

		const allRanges = Array.from(index.query());
		assertEquals(allRanges.length, 4, 'query() with no bounds should return all 4 ranges');

		const values = new Set(allRanges.map((result) => result[1]));
		assert(values.has('topleft'));
		assert(values.has('center'));
		assert(values.has('rightmid'));
		assert(values.has('botmid'));
	});

	await t.step('Query boundary precision', () => {
		const index = implementation();

		const emptyResults = Array.from(index.query(r.make(0, 0, 9, 9)));
		assertEquals(emptyResults.length, 0, 'query on empty index returns empty');

		index.insert(r.make(5, 5, 14, 14), 'center');
		index.insert(r.make(20, 20, 29, 29), 'corner');
		assertInvariants(index, 'query setup');

		const allResults = Array.from(index.query(r.make()));
		assertEquals(allResults.length, 2, 'infinite query returns all entries');

		const exactMatch = Array.from(index.query(r.make(5, 5, 14, 14)));
		assertEquals(exactMatch.length, 1, 'exact match finds one range');
		assertEquals(exactMatch[0]![1], 'center');

		const partialOverlap = Array.from(index.query(r.make(10, 10, 24, 24)));
		assertEquals(partialOverlap.length, 2, 'partial overlap finds both ranges');

		const noOverlap = Array.from(index.query(r.make(100, 100, 109, 109)));
		assertEquals(noOverlap.length, 0, 'no overlap returns empty');

		assertInvariants(index, 'queries should not modify state');
	});

	await t.step('Query-insert consistency', () => {
		const index = implementation();

		const testCases = [
			{ range: r.make(10, 10, 19, 19), value: 'center' },
			{ range: r.make(0, 0, 99, 4), value: 'top-strip' },
			{ range: r.make(0, 0, 4, 99), value: 'left-strip' },
			{ range: r.make(1000, 1000, 1009, 1009), value: 'far' },
			{ range: r.make(0, 0, 0, 0), value: 'single-cell' },
		];

		for (const testCase of testCases) {
			index.insert(testCase.range, testCase.value);

			const results = Array.from(index.query(testCase.range));
			const found = results.find((result) => result[1] === testCase.value);

			assert(
				found,
				`query-insert consistency failed for ${testCase.value}!\n` +
					`inserted range but query at same coordinates didn't find it`,
			);
		}

		assertInvariants(index, 'query-insert consistency');
	});

	await t.step('Query completeness', () => {
		const index = implementation();

		for (let i = 0; i < 10; i++) {
			index.insert(r.make(i * 2, 0, i * 2 + 2, 19), `value${i}`);
		}

		assertInvariants(index, 'after 10 insertions');

		const results = Array.from(index.query(r.make(0, 0, 19, 19)));
		const foundValues = new Set(results.map((result) => result[1]));

		const expectedValues = Array.from({ length: 10 }, (_, i) => `value${i}`);
		const missingValues = expectedValues.filter((v) => !foundValues.has(v));

		assertEquals(
			missingValues.length,
			0,
			`query incomplete! found ${foundValues.size}/10 values, missing: ${missingValues.join(', ')}`,
		);

		const subResults = Array.from(index.query(r.make(5, 5, 14, 14)));
		assertGreater(subResults.length, 0, 'subregion query finds at least some ranges');

		for (const result of subResults) {
			const [x, y, x2, y2] = result[0];
			const overlaps = y <= 14 && y2 >= 5 && x <= 14 && x2 >= 5;
			assert(
				overlaps,
				`query returned non-overlapping range: ${result[1]} at [${x},${y},${x2},${y2}]`,
			);
		}
	});
	//#endregion Query Correctness

	//#region Invariant Preservation

	await t.step('Non-overlapping preservation', () => {
		const index = implementation();

		const spacing = 100;
		for (let i = 0; i < 5; i++) {
			for (let j = 0; j < 4; j++) {
				const value = `reachable_${i}_${j}`;
				const baseRow = i * spacing;
				const baseCol = j * spacing;
				index.insert(r.make(baseCol, baseRow, baseCol + 49, baseRow + 49), value);
			}
		}

		assertInvariants(index, 'after non-overlapping insertions');

		const expectedCount = 20;
		const allResults = Array.from(index.query(r.make()));
		const retrievedValues = new Set(allResults.map((result) => result[1]));

		assertEquals(
			retrievedValues.size,
			expectedCount,
			`expected ${expectedCount} values, got ${retrievedValues.size}`,
		);

		const allValues = new Set(Array.from(index.query()).map((result) => result[1]));
		assertEquals(allValues.size, expectedCount);
	});

	await t.step('Complex insertion sequence preserves invariants', () => {
		const index = implementation();

		const deterministicPatterns = [
			r.make(0, 0, 4, 4),
			r.make(10, 10, 14, 14),
			r.make(2, 2, 7, 7),
			r.make(5, 20, 9, 24),
			r.make(15, 1, 19, 5),
			r.make(3, 12, 8, 17),
			r.make(12, 5, 17, 10),
			r.make(7, 15, 13, 21),
			r.make(18, 3, 23, 8),
			r.make(1, 7, 6, 12),
		];

		const operations = Array.from({ length: 100 }, (_, i) => ({
			range: deterministicPatterns[i % deterministicPatterns.length]!,
			value: `stress_${i}`,
		}));

		operations.forEach((op, i) => {
			index.insert(op.range, op.value);
			assertInvariants(index, `stress test iteration ${i}`);
		});

		const ranges = Array.from(index.query());
		assertGreater(ranges.length, 0, 'should not lose all ranges during stress test');
	});
	//#endregion Invariant Preservation

	//#region Canonical Fragment Counts (Correctness Oracle)

	await t.step('Fragment count: small overlapping (50 ops → 63)', () => {
		const operations = Array.from({ length: 50 }, (_, i) => ({
			range: r.make(i % 5, Math.floor(i / 3), (i % 5) + 2, Math.floor(i / 3) + 2),
			value: `s_${i}`,
		}));

		const index = implementation();
		operations.forEach((op) => index.insert(op.range, op.value));

		const fragmentCount = Array.from(index.query()).length;
		assertEquals(
			fragmentCount,
			CANONICAL_FRAGMENT_COUNTS.SMALL_OVERLAPPING,
			`small overlapping: expected ${CANONICAL_FRAGMENT_COUNTS.SMALL_OVERLAPPING}, got ${fragmentCount}`,
		);

		assertInvariants(index, 'small overlapping');
	});

	await t.step('Fragment count: diagonal pattern (20 ops → 39)', () => {
		const operations = Array.from({ length: 20 }, (_, i) => ({
			range: r.make(i * 2, i * 2, i * 2 + 4, i * 2 + 4),
			value: `d_${i}`,
		}));

		const index = implementation();
		operations.forEach((op) => index.insert(op.range, op.value));

		const fragmentCount = Array.from(index.query()).length;
		assertEquals(
			fragmentCount,
			CANONICAL_FRAGMENT_COUNTS.DIAGONAL,
			`diagonal: expected ${CANONICAL_FRAGMENT_COUNTS.DIAGONAL}, got ${fragmentCount}`,
		);

		assertInvariants(index, 'diagonal pattern');
	});

	await t.step('Fragment count: large overlapping (1250 ops → 1375)', () => {
		const operations = Array.from({ length: 1250 }, (_, i) => ({
			range: r.make(i % 10, Math.floor(i / 5), (i % 10) + 4, Math.floor(i / 5) + 4),
			value: `overlap_${i}`,
		}));

		const index = implementation();
		operations.forEach((op) => index.insert(op.range, op.value));

		const fragmentCount = Array.from(index.query()).length;
		assertEquals(
			fragmentCount,
			CANONICAL_FRAGMENT_COUNTS.LARGE_OVERLAPPING,
			`large overlapping: expected ${CANONICAL_FRAGMENT_COUNTS.LARGE_OVERLAPPING}, got ${fragmentCount}.\n` +
				`this indicates a coordinate bug or incorrect geometric subtraction`,
		);

		assertInvariants(index, 'large overlapping');
	});
	//#endregion Canonical Fragment Counts
}
