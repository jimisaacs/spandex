/**
 * Parse-Only Edge Cases
 *
 * Tests for parsing-specific edge cases that don't come from regression fixtures.
 * Most round-trip validation happens in regression.test.ts.
 *
 * Currently empty - all parsing scenarios are covered by regression tests.
 * Keep this file as a placeholder for future parse-only edge cases.
 */

import { MortonLinearScanImpl } from '@jim/spandex';
import { parse, render } from '@jim/spandex-ascii';
import { assertEquals } from '@std/assert';

// Placeholder test - demonstrates parse testing but is really a round-trip test
// TODO: Add true parse-only edge cases if/when they arise
Deno.test('Parse - Negative Coordinates', () => {
	const index = new MortonLinearScanImpl<string>();
	index.insert([-5, -3, -2, -1], 'NEG');

	const ascii = render(() => index.query(), { 'N': 'NEG' });
	const parsed = parse<string>(ascii);

	// Should have one grid with 12 results (4 cols × 3 rows)
	assertEquals(parsed.grids.length, 1);
	const results = parsed.grids[0].results;
	assertEquals(results.length, 12); // 4 columns × 3 rows

	// All cells should have value 'NEG'
	for (const [, value] of results) {
		assertEquals(value, 'NEG');
	}

	// Check that we have cells in the negative coordinate range
	const xs = results.map(([bounds]) => bounds[0]);
	const ys = results.map(([bounds]) => bounds[1]);
	assertEquals(Math.min(...xs), -5);
	assertEquals(Math.max(...xs), -2);
	assertEquals(Math.min(...ys), -3);
	assertEquals(Math.max(...ys), -1);
});
