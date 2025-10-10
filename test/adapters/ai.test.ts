/**
 * A1 Notation Adapter Tests
 *
 * Tests coordinate conversion between A1 notation (e.g., "B2", "A1:D4", "C:C", "3:5")
 * and internal closed-interval rectangles.
 *
 * Test organization:
 * - Bounded ranges: Single cells, rectangles, touching boundaries
 * - Infinite extents: Full rows, full columns, cross patterns
 * - Edge cases: Round-trip conversion
 */

import type { Rectangle } from '@jim/spandex';
import { createA1Adapter, MortonLinearScanImpl } from '@jim/spandex';
import { assertSnapshot, createFixtureLoader, renderToAscii } from '@local/spandex-testing';
import { assertEquals } from '@std/assert';

const loadFixture = createFixtureLoader(new URL('./fixtures/adapter-test.md', import.meta.url));

/**
 * Helper: Render adapter results to ASCII with viewport clipping.
 * Handles infinite bounds by clamping to viewport.
 */
function renderAdapter<T>(
	adapter: ReturnType<typeof createA1Adapter<T>>,
	options: {
		width: number;
		height: number;
		valueFormatter?: (value: unknown) => string;
	},
): string {
	const impl = new MortonLinearScanImpl<T>();

	for (const [bounds, value] of adapter.query()) {
		// Clip infinite bounds to viewport
		const clipped: Rectangle = [
			Math.max(bounds[0], 0),
			Math.max(bounds[1], 0),
			Math.min(bounds[2], options.width - 1),
			Math.min(bounds[3], options.height - 1),
		];
		impl.insert(clipped, value);
	}

	return renderToAscii(impl, options);
}

// ============================================================================
// Bounded Ranges
// ============================================================================

Deno.test('A1 - Single Cell Precision', async () => {
	const adapter = createA1Adapter(new MortonLinearScanImpl<string>());
	adapter.insert('B2', 'CELL');

	const [[bounds]] = adapter.query();
	assertEquals(bounds, [1, 1, 1, 1], 'B2 → [1,1,1,1]');

	const actual = renderAdapter(adapter, { width: 4, height: 4 });
	const expected = await loadFixture('Single Cell Precision');
	assertSnapshot(actual, expected);
});

Deno.test('A1 - Boundary Touching Ranges', async () => {
	const adapter = createA1Adapter(new MortonLinearScanImpl<number>());

	// Four 2×2 quadrants
	adapter.insert('A1:B2', 1);
	adapter.insert('C1:D2', 2);
	adapter.insert('A3:B4', 3);
	adapter.insert('C3:D4', 4);

	const results = Array.from(adapter.query());
	assertEquals(results.length, 4, 'Adjacent ranges should not overlap');

	const actual = renderAdapter(adapter, {
		width: 4,
		height: 4,
		valueFormatter: (v) => String(v),
	});
	const expected = await loadFixture('Boundary Touching Ranges');
	assertSnapshot(actual, expected);
});

Deno.test('A1 - Complex Fragmentation', async () => {
	const adapter = createA1Adapter(new MortonLinearScanImpl<string>());

	// Three overlapping ranges → automatic decomposition
	adapter.insert('A1:E3', 'BASE');
	adapter.insert('B2:D4', 'OVERLAP1');
	adapter.insert('C3:F5', 'OVERLAP2');

	const actual = renderAdapter(adapter, {
		width: 6,
		height: 5,
		valueFormatter: (v) => {
			if (v === 'BASE') return '1';
			if (v === 'OVERLAP1') return '2';
			if (v === 'OVERLAP2') return '3';
			return '?';
		},
	});
	const expected = await loadFixture('Complex Fragmentation');
	assertSnapshot(actual, expected);
});

Deno.test('A1 - Wide Column Range', async () => {
	const adapter = createA1Adapter(new MortonLinearScanImpl<string>());
	adapter.insert('C1:F8', 'WIDE');

	const actual = renderAdapter(adapter, {
		width: 7,
		height: 8,
		valueFormatter: (v) => String(v)[0],
	});
	const expected = await loadFixture('Wide Column Range');
	assertSnapshot(actual, expected);
});

// ============================================================================
// Infinite Extents (A1-specific feature)
// ============================================================================

Deno.test('A1 - Full Column Extent', async () => {
	const adapter = createA1Adapter(new MortonLinearScanImpl<string>());

	// "B:B" = column B, all rows → infinite row extent
	adapter.insert('B:B', 'COL_B');
	adapter.insert('D:E', 'COL_DE');

	const actual = renderAdapter(adapter, {
		width: 6,
		height: 4,
		valueFormatter: (v) => String(v)[0],
	});
	const expected = await loadFixture('Full Column Extent');
	assertSnapshot(actual, expected);
});

Deno.test('A1 - Full Row Extent', async () => {
	const adapter = createA1Adapter(new MortonLinearScanImpl<string>());

	// "2:2" = row 2, all columns → infinite column extent
	adapter.insert('2:2', 'ROW_2');
	adapter.insert('4:5', 'ROW_45');

	const actual = renderAdapter(adapter, {
		width: 5,
		height: 5,
		valueFormatter: (v) => String(v)[0],
	});
	const expected = await loadFixture('Full Row Extent');
	assertSnapshot(actual, expected);
});

Deno.test('A1 - Unbounded Columns', async () => {
	const adapter = createA1Adapter(new MortonLinearScanImpl<string>());
	adapter.insert('3:5', 'UNBOUND_COLS');

	const [[bounds]] = adapter.query();
	assertEquals(bounds[0], -Infinity, 'Row-only notation → infinite columns');
	assertEquals(bounds[2], Infinity);
	assertEquals(bounds[1], 2, 'Row 3 → internal 2 (0-indexed)');
	assertEquals(bounds[3], 4);

	const actual = renderAdapter(adapter, {
		width: 6,
		height: 6,
		valueFormatter: (v) => String(v)[0],
	});
	const expected = await loadFixture('Unbounded Columns');
	assertSnapshot(actual, expected);
});

Deno.test('A1 - Unbounded Rows', async () => {
	const adapter = createA1Adapter(new MortonLinearScanImpl<string>());
	adapter.insert('B:D', 'UNBOUND_ROWS');

	const [[bounds]] = adapter.query();
	assertEquals(bounds[1], -Infinity, 'Column-only notation → infinite rows');
	assertEquals(bounds[3], Infinity);
	assertEquals(bounds[0], 1, 'Column B → internal 1');
	assertEquals(bounds[2], 3);

	const actual = renderAdapter(adapter, {
		width: 6,
		height: 6,
		valueFormatter: (v) => String(v)[0],
	});
	const expected = await loadFixture('Unbounded Rows');
	assertSnapshot(actual, expected);
});

Deno.test('A1 - Unbounded Cross Pattern', async () => {
	const adapter = createA1Adapter(new MortonLinearScanImpl<string>());

	adapter.insert('C:C', 'COL'); // Full column C
	adapter.insert('3:3', 'ROW'); // Full row 3 (wins at intersection)

	const results = Array.from(adapter.query());
	assertEquals(results.length >= 2, true, 'Fragmentation from infinite overlap');

	// Verify both values survive fragmentation
	const colFragments = results.filter(([, v]) => v === 'COL');
	const rowFragments = results.filter(([, v]) => v === 'ROW');
	assertEquals(colFragments.length >= 1, true, 'COL survives LWW');
	assertEquals(rowFragments.length >= 1, true, 'ROW survives LWW');

	const actual = renderAdapter(adapter, {
		width: 5,
		height: 5,
		valueFormatter: (v) => String(v)[0],
	});
	const expected = await loadFixture('Unbounded Cross');
	assertSnapshot(actual, expected);
});

// ============================================================================
// Edge Cases
// ============================================================================

Deno.test('A1 - Column Z Boundary', () => {
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

Deno.test('A1 - Single Cell as Range', () => {
	const adapter = createA1Adapter(new MortonLinearScanImpl<string>());

	// "B2:B2" should equal "B2"
	adapter.insert('B2:B2', 'single');
	const [[bounds]] = adapter.query();
	assertEquals(bounds, [1, 1, 1, 1], 'B2:B2 should equal single cell');
});

Deno.test('A1 - Single Row Strip', () => {
	const adapter = createA1Adapter(new MortonLinearScanImpl<string>());

	// Horizontal strip: row 3 from columns A to F
	adapter.insert('A3:F3', 'strip');
	const [[bounds]] = adapter.query();
	assertEquals(bounds[0], 0, 'Start column A = 0');
	assertEquals(bounds[2], 5, 'End column F = 5');
	assertEquals(bounds[1], 2, 'Row 3 = internal 2');
	assertEquals(bounds[3], 2, 'Single row');
});

Deno.test('A1 - Single Column Strip', () => {
	const adapter = createA1Adapter(new MortonLinearScanImpl<string>());

	// Vertical strip: column B from rows 1 to 10
	adapter.insert('B1:B10', 'strip');
	const [[bounds]] = adapter.query();
	assertEquals(bounds[0], 1, 'Column B = 1');
	assertEquals(bounds[2], 1, 'Single column');
	assertEquals(bounds[1], 0, 'Start row 1 = internal 0');
	assertEquals(bounds[3], 9, 'End row 10 = internal 9');
});

Deno.test('A1 - Large Row Numbers', () => {
	const adapter = createA1Adapter(new MortonLinearScanImpl<string>());

	// Google Sheets supports up to row 1048576, but we should handle large numbers
	adapter.insert('A1000:B2000', 'large');
	const [[bounds]] = adapter.query();
	assertEquals(bounds[1], 999, 'Row 1000 = internal 999');
	assertEquals(bounds[3], 1999, 'Row 2000 = internal 1999');
});

Deno.test('A1 - Range Normalization', () => {
	const adapter = createA1Adapter(new MortonLinearScanImpl<string>());

	// Verify the adapter handles ranges correctly regardless of order
	adapter.insert('A1:C3', 'normal');
	const [[normalBounds]] = adapter.query();

	// Note: The adapter doesn't normalize reverse ranges - it just converts as-is
	// So "C3:A1" would give [2,2,0,0] which is invalid
	// This documents current behavior
	assertEquals(normalBounds, [0, 0, 2, 2]);
});

Deno.test('A1 - Mixed Column and Row Ranges', () => {
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

Deno.test('A1 - Query with A1 Range', () => {
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

Deno.test('A1 - Round-trip Conversion', () => {
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
