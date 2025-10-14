/**
 * GridRange Adapter Tests
 *
 * Tests coordinate conversion between Google Sheets GridRange (half-open intervals with
 * optional omitted properties) and internal closed-interval rectangles.
 *
 * Key GridRange behaviors:
 * - Half-open intervals: [startIndex, endIndex) where endIndex is exclusive
 * - Omitted properties → ±Infinity (unbounded extent)
 * - 0-indexed coordinates
 */

import { MortonLinearScanImpl } from '@jim/spandex';
import { createGridRangeAdapter } from '@jim/spandex/adapters/gridrange';
import { assertEquals } from '@std/assert';

Deno.test('GridRange Edge Cases', async (t) => {
	await t.step('Partial Unbounded (start only)', () => {
		const adapter = createGridRangeAdapter(new MortonLinearScanImpl<string>());
		adapter.insert({ startRowIndex: 1, endRowIndex: 3, startColumnIndex: 2 }, 'PARTIAL');

		const [[bounds]] = adapter.query();
		assertEquals(bounds[0], 2, 'startColumnIndex defined');
		assertEquals(bounds[2], Infinity, 'endColumnIndex omitted → Infinity');
		assertEquals(bounds[1], 1);
		assertEquals(bounds[3], 2);
	});

	await t.step('Partial Unbounded (end only)', () => {
		const adapter = createGridRangeAdapter(new MortonLinearScanImpl<string>());
		adapter.insert({ startRowIndex: 1, endRowIndex: 3, endColumnIndex: 3 }, 'PARTIAL');

		const [[bounds]] = adapter.query();
		assertEquals(bounds[0], -Infinity, 'startColumnIndex omitted → -Infinity');
		assertEquals(bounds[2], 2, 'endColumnIndex 3 → closed 2');
	});
});
