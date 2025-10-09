/**
 * Cross-implementation consistency tests
 *
 * Tests all active implementations against each other and canonical values.
 */

import { assertEquals } from '@std/assert';
import { rect } from '../rect.ts';
import type { SpatialIndex } from '../types.ts';
import { CANONICAL_FRAGMENT_COUNTS } from './constants.ts';

export type IndexConstructor<T> = new () => SpatialIndex<T>;

/**
 * Test all active implementations for cross-implementation consistency.
 *
 * This test ensures:
 * 1. All implementations produce identical fragment counts for deterministic scenarios
 * 2. All implementations produce fragment counts matching canonical values
 * 3. All implementations produce identical decompositions (not just counts)
 *
 * @param implementations - Array of { name, Class } for all active implementations
 */
export function testCrossImplementationConsistency(
	implementations: Array<{ name: string; Class: IndexConstructor<string> }>,
): void {
	Deno.test('Cross-implementation consistency - Fragment counts', () => {
		// Test against canonical scenarios
		const scenarios = [
			{
				name: 'small-overlapping',
				ops: Array.from({ length: 50 }, (_, i) => ({
					range: rect(i % 5, Math.floor(i / 3), (i % 5) + 3 - 1, Math.floor(i / 3) + 3 - 1),
					value: `s_${i}`,
				})),
				expected: CANONICAL_FRAGMENT_COUNTS.SMALL_OVERLAPPING,
			},
			{
				name: 'diagonal-pattern',
				ops: Array.from({ length: 20 }, (_, i) => ({
					range: rect(i * 2, i * 2, i * 2 + 5 - 1, i * 2 + 5 - 1),
					value: `d_${i}`,
				})),
				expected: CANONICAL_FRAGMENT_COUNTS.DIAGONAL,
			},
			{
				name: 'large-overlapping',
				ops: Array.from({ length: 1250 }, (_, i) => ({
					range: rect(i % 10, Math.floor(i / 5), (i % 10) + 5 - 1, Math.floor(i / 5) + 5 - 1),
					value: `overlap_${i}`,
				})),
				expected: CANONICAL_FRAGMENT_COUNTS.LARGE_OVERLAPPING,
			},
		];

		for (const scenario of scenarios) {
			const counts = implementations.map(({ name, Class }) => {
				const index = new Class();
				scenario.ops.forEach((op) => index.insert(op.range, op.value));
				return { name, count: Array.from(index.query()).length };
			});

			// All implementations must match canonical value
			for (const { name, count } of counts) {
				assertEquals(
					count,
					scenario.expected,
					`${name} produced ${count} fragments for ${scenario.name}, ` +
						`expected canonical value ${scenario.expected}`,
				);
			}

			// All implementations must match each other
			const firstCount = counts[0].count;
			for (let i = 1; i < counts.length; i++) {
				assertEquals(
					counts[i].count,
					firstCount,
					`fragment count mismatch: ${counts[0].name} produced ${firstCount}, ` +
						`but ${counts[i].name} produced ${counts[i].count} for ${scenario.name}`,
				);
			}
		}
	});

	Deno.test('Cross-implementation consistency - Exact decompositions', () => {
		// Verify implementations produce identical decompositions, not just counts
		const operations = [
			{ bounds: rect(0, 0, 4, 4), value: 'base' },
			{ bounds: rect(2, 2, 6, 6), value: 'overlap1' },
			{ bounds: rect(4, 1, 7, 2), value: 'overlap2' },
			{ bounds: rect(1, 6, 3, 8), value: 'separate' },
		];

		const results = implementations.map(({ name, Class }) => {
			const index = new Class();
			operations.forEach((op) => index.insert(op.bounds, op.value));
			const ranges = Array.from(index.query());

			// Normalize and sort for comparison
			return {
				name,
				normalized: ranges
					.map((r) => ({
						xmin: r[0][0],
						ymin: r[0][1],
						xmax: r[0][2],
						ymax: r[0][3],
						value: r[1],
					}))
					.sort((a, b) => {
						// Sort by ymin, ymax, xmin, xmax, value
						if (a.ymin !== b.ymin) return a.ymin - b.ymin;
						if (a.ymax !== b.ymax) return a.ymax - b.ymax;
						if (a.xmin !== b.xmin) return a.xmin - b.xmin;
						if (a.xmax !== b.xmax) return a.xmax - b.xmax;
						return a.value.localeCompare(b.value);
					}),
			};
		});

		// Compare all implementations against first one
		const reference = results[0];
		for (let i = 1; i < results.length; i++) {
			assertEquals(
				JSON.stringify(results[i].normalized),
				JSON.stringify(reference.normalized),
				`${results[i].name} produced different decomposition than ${reference.name}`,
			);
		}
	});
}
