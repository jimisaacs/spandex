/**
 * A1 Notation Adapter Tests
 *
 * Tests coordinate conversion between A1 notation (e.g., "B2", "A1:D4", "C:C", "3:5")
 * and internal closed-interval rectangles.
 */

import { MortonLinearScanImpl } from '@jim/spandex';
import { createA1Adapter } from '@jim/spandex/adapters/a1';
import { assertEquals } from '@std/assert';

Deno.test('A1 Edge Cases', async (t) => {
	await t.step('Column Z Boundary', () => {
		// Test the last single-letter column
		const adapter = createA1Adapter(new MortonLinearScanImpl<string>());

		adapter.insert('Z1', 'z_col');
		const [[zBounds]] = adapter.query('Z1');
		assertEquals(zBounds, [25, 0, 25, 0], 'Z1 → [25,0,25,0]');

		// Range with Z
		adapter.insert('Y1:Z3', 'yz_range');
		const results = Array.from(adapter.query());
		const yz = results.find(([, v]) => v === 'yz_range');
		assertEquals(yz?.[0], [24, 0, 25, 2], 'Y1:Z3 → [24,0,25,2]');
	});

	await t.step('Single Cell as Range', () => {
		const adapter = createA1Adapter(new MortonLinearScanImpl<string>());

		// "B2:B2" should equal "B2"
		adapter.insert('B2:B2', 'single');
		const [[bounds]] = adapter.query();
		assertEquals(bounds, [1, 1, 1, 1], 'B2:B2 should equal single cell');
	});

	await t.step('Single Row Strip', () => {
		const adapter = createA1Adapter(new MortonLinearScanImpl<string>());

		// Horizontal strip: row 3 from columns A to F
		adapter.insert('A3:F3', 'strip');
		const [[bounds]] = adapter.query();
		assertEquals(bounds[0], 0, 'Start column A = 0');
		assertEquals(bounds[2], 5, 'End column F = 5');
		assertEquals(bounds[1], 2, 'Row 3 = internal 2');
		assertEquals(bounds[3], 2, 'Single row');
	});

	await t.step('Single Column Strip', () => {
		const adapter = createA1Adapter(new MortonLinearScanImpl<string>());

		// Vertical strip: column B from rows 1 to 10
		adapter.insert('B1:B10', 'strip');
		const [[bounds]] = adapter.query();
		assertEquals(bounds[0], 1, 'Column B = 1');
		assertEquals(bounds[2], 1, 'Single column');
		assertEquals(bounds[1], 0, 'Start row 1 = internal 0');
		assertEquals(bounds[3], 9, 'End row 10 = internal 9');
	});

	await t.step('Large Row Numbers', () => {
		const adapter = createA1Adapter(new MortonLinearScanImpl<string>());

		// Google Sheets supports up to row 1048576, but we should handle large numbers
		adapter.insert('A1000:B2000', 'large');
		const [[bounds]] = adapter.query();
		assertEquals(bounds[1], 999, 'Row 1000 = internal 999');
		assertEquals(bounds[3], 1999, 'Row 2000 = internal 1999');
	});

	await t.step('Range Normalization', () => {
		const adapter = createA1Adapter(new MortonLinearScanImpl<string>());

		// Verify the adapter handles ranges correctly regardless of order
		adapter.insert('A1:C3', 'normal');
		const [[normalBounds]] = adapter.query();

		// Note: The adapter doesn't normalize reverse ranges - it just converts as-is
		// So "C3:A1" would give [2,2,0,0] which is invalid
		// This documents current behavior
		assertEquals(normalBounds, [0, 0, 2, 2]);
	});

	await t.step('Mixed Column and Row Ranges', () => {
		const adapter = createA1Adapter(new MortonLinearScanImpl<string>());

		// Test that adapter handles all range types correctly
		// Note: Don't mix infinite extents in same test as they always intersect
		adapter.insert('A1:B2', 'rect');
		adapter.insert('E5', 'cell');

		// Add infinite extent separately to verify behavior
		adapter.insert('C:C', 'col');

		const results = Array.from(adapter.query());
		// 'rect' and 'cell' don't overlap, 'col' is separate
		assertEquals(results.length, 3, 'Should handle mixed range types');

		const rect = results.find(([, v]) => v === 'rect');
		const cell = results.find(([, v]) => v === 'cell');
		const col = results.find(([, v]) => v === 'col');

		assertEquals(rect?.[0], [0, 0, 1, 1], 'Rectangle A1:B2');
		assertEquals(cell?.[0], [4, 4, 4, 4], 'Cell E5');
		assertEquals(col?.[0][0], 2, 'Column C = 2');
		assertEquals(col?.[0][1], -Infinity, 'Full column has infinite rows');
		assertEquals(col?.[0][3], Infinity, 'Full column has infinite rows');
	});

	await t.step('Query with A1 Range', () => {
		const adapter = createA1Adapter(new MortonLinearScanImpl<string>());

		// Insert multiple ranges
		adapter.insert('A1:C3', 'top_left');
		adapter.insert('E5:G7', 'bottom_right');
		adapter.insert('D1:F8', 'middle');

		// Query specific region using A1 notation
		const resultsInB1D4 = Array.from(adapter.query('B1:D4'));
		const values = resultsInB1D4.map(([, v]) => v);

		// Should find 'top_left' and 'middle', but not 'bottom_right'
		assertEquals(values.includes('top_left'), true);
		assertEquals(values.includes('middle'), true);
		assertEquals(values.includes('bottom_right'), false);
	});

	await t.step('Round-trip Conversion', () => {
		const adapter = createA1Adapter(new MortonLinearScanImpl<string>());

		adapter.insert('A1', 'single');
		adapter.insert('B2:D4', 'rect');
		adapter.insert('F5:F6', 'vert');

		const results = Array.from(adapter.query());
		assertEquals(results.length, 3);

		// Verify coordinate transformations
		const single = results.find(([, v]) => v === 'single');
		assertEquals(single?.[0], [0, 0, 0, 0]);

		const rect = results.find(([, v]) => v === 'rect');
		assertEquals(rect?.[0], [1, 1, 3, 3]);

		const vert = results.find(([, v]) => v === 'vert');
		assertEquals(vert?.[0], [5, 4, 5, 5]);
	});
});
