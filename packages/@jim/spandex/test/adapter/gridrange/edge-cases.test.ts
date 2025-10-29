/**
 * GridRange Adapter Tests
 *
 * Tests coordinate conversion between Google Sheets GridRange (half-open intervals with
 * optional omitted properties) and internal closed-interval rectangles.
 *
 * Key GridRange behaviors:
 * - Half-open intervals: [startIndex, endIndex) where endIndex is exclusive
 * - Omitted properties → ±∞ (unbounded extent)
 * - 0-indexed coordinates
 */

import { createGridRangeAdapter } from '@jim/spandex/adapter/gridrange';
import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
import * as r from '@jim/spandex/r';
import { assertEquals } from '@std/assert';

Deno.test('GridRange Edge Cases', async (t) => {
	await t.step('Partial Unbounded (start only)', () => {
		const adapter = createGridRangeAdapter(createMortonLinearScanIndex<'PARTIAL'>());
		adapter.insert({ startRowIndex: 1, endRowIndex: 3, startColumnIndex: 2 }, 'PARTIAL');

		const [bounds] = Array.from(adapter.query())[0]!;
		assertEquals(bounds[0], 2, 'startColumnIndex defined');
		assertEquals(bounds[2], r.posInf, 'endColumnIndex omitted → +∞');
		assertEquals(bounds[1], 1);
		assertEquals(bounds[3], 2);
	});

	await t.step('Partial Unbounded (end only)', () => {
		const adapter = createGridRangeAdapter(createMortonLinearScanIndex<'PARTIAL'>());
		adapter.insert({ startRowIndex: 1, endRowIndex: 3, endColumnIndex: 3 }, 'PARTIAL');

		const [bounds] = Array.from(adapter.query())[0]!;
		assertEquals(bounds[0], r.negInf, 'startColumnIndex omitted → -∞');
		assertEquals(bounds[2], 2, 'endColumnIndex 3 → closed 2');
	});
});
