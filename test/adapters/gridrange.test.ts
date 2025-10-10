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
 *
 * Test organization:
 * - Bounded ranges: Single cells, rectangles, touching boundaries
 * - Infinite extents: Full rows, full columns, completely unbounded, cross patterns
 * - Edge cases: Partial unbounded (only start or only end defined)
 */

import type { Rectangle } from '@jim/spandex';
import { createGridRangeAdapter, MortonLinearScanImpl } from '@jim/spandex';
import { assertSnapshot, createFixtureLoader, renderToAscii } from '@local/spandex-testing';
import { assertEquals } from '@std/assert';

const loadFixture = createFixtureLoader(new URL('./fixtures/adapter-test.md', import.meta.url));

/**
 * Helper: Render adapter results to ASCII with viewport clipping.
 * Handles infinite bounds by clamping to viewport.
 */
function renderAdapter<T>(
	adapter: ReturnType<typeof createGridRangeAdapter<T>>,
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

Deno.test('GridRange - Single Cell Precision', async () => {
	const adapter = createGridRangeAdapter(new MortonLinearScanImpl<string>());
	adapter.insert({ startRowIndex: 1, endRowIndex: 2, startColumnIndex: 1, endColumnIndex: 2 }, 'CELL');

	const [[bounds]] = adapter.query();
	assertEquals(bounds, [1, 1, 1, 1], 'Half-open [1,2)×[1,2) → closed [1,1,1,1]');

	const actual = renderAdapter(adapter, { width: 4, height: 4 });
	const expected = await loadFixture('Single Cell Precision');
	assertSnapshot(actual, expected);
});

Deno.test('GridRange - Boundary Touching Ranges', async () => {
	const adapter = createGridRangeAdapter(new MortonLinearScanImpl<number>());

	// Four 2×2 quadrants using half-open intervals
	adapter.insert({ startRowIndex: 0, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 2 }, 1);
	adapter.insert({ startRowIndex: 0, endRowIndex: 2, startColumnIndex: 2, endColumnIndex: 4 }, 2);
	adapter.insert({ startRowIndex: 2, endRowIndex: 4, startColumnIndex: 0, endColumnIndex: 2 }, 3);
	adapter.insert({ startRowIndex: 2, endRowIndex: 4, startColumnIndex: 2, endColumnIndex: 4 }, 4);

	const results = Array.from(adapter.query());
	assertEquals(results.length, 4, 'Half-open intervals should not overlap');

	const actual = renderAdapter(adapter, {
		width: 4,
		height: 4,
		valueFormatter: (v) => String(v),
	});
	const expected = await loadFixture('Boundary Touching Ranges');
	assertSnapshot(actual, expected);
});

Deno.test('GridRange - Complex Fragmentation', async () => {
	const adapter = createGridRangeAdapter(new MortonLinearScanImpl<string>());

	// Three overlapping ranges → automatic decomposition
	adapter.insert({ startRowIndex: 0, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 5 }, 'BASE');
	adapter.insert({ startRowIndex: 1, endRowIndex: 4, startColumnIndex: 1, endColumnIndex: 4 }, 'OVERLAP1');
	adapter.insert({ startRowIndex: 2, endRowIndex: 5, startColumnIndex: 2, endColumnIndex: 6 }, 'OVERLAP2');

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

Deno.test('GridRange - Wide Column Range', async () => {
	const adapter = createGridRangeAdapter(new MortonLinearScanImpl<string>());
	adapter.insert({ startRowIndex: 0, endRowIndex: 8, startColumnIndex: 2, endColumnIndex: 6 }, 'WIDE');

	const actual = renderAdapter(adapter, {
		width: 7,
		height: 8,
		valueFormatter: (v) => String(v)[0],
	});
	const expected = await loadFixture('Wide Column Range');
	assertSnapshot(actual, expected);
});

// ============================================================================
// Infinite Extents (GridRange-specific feature)
// ============================================================================

Deno.test('GridRange - Completely Unbounded', () => {
	const adapter = createGridRangeAdapter(new MortonLinearScanImpl<string>());
	adapter.insert({}, 'EVERYWHERE');

	const [[bounds]] = adapter.query();
	assertEquals(bounds, [-Infinity, -Infinity, Infinity, Infinity], 'Empty object → infinite bounds');

	const actual = renderAdapter(adapter, {
		width: 4,
		height: 4,
		valueFormatter: (v) => String(v)[0],
	});

	// Visual verification: entire viewport should be filled
	const lines = actual.split('\n').filter((l) => l.includes('|'));
	const dataLines = lines.filter((l) => /^\s*\d/.test(l));
	for (const line of dataLines) {
		assertEquals(line.includes('| E | E | E | E |'), true, `Expected filled row: ${line}`);
	}
});

Deno.test('GridRange - Full Column Extent', async () => {
	const adapter = createGridRangeAdapter(new MortonLinearScanImpl<string>());

	// Omit row indices → infinite row extent
	adapter.insert({ startColumnIndex: 1, endColumnIndex: 2 }, 'COL_B');
	adapter.insert({ startColumnIndex: 3, endColumnIndex: 5 }, 'COL_DE');

	const actual = renderAdapter(adapter, {
		width: 6,
		height: 4,
		valueFormatter: (v) => String(v)[0],
	});
	const expected = await loadFixture('Full Column Extent');
	assertSnapshot(actual, expected);
});

Deno.test('GridRange - Full Row Extent', async () => {
	const adapter = createGridRangeAdapter(new MortonLinearScanImpl<string>());

	// Omit column indices → infinite column extent
	adapter.insert({ startRowIndex: 1, endRowIndex: 2 }, 'ROW_2');
	adapter.insert({ startRowIndex: 3, endRowIndex: 5 }, 'ROW_45');

	const actual = renderAdapter(adapter, {
		width: 5,
		height: 5,
		valueFormatter: (v) => String(v)[0],
	});
	const expected = await loadFixture('Full Row Extent');
	assertSnapshot(actual, expected);
});

Deno.test('GridRange - Unbounded Columns', async () => {
	const adapter = createGridRangeAdapter(new MortonLinearScanImpl<string>());
	adapter.insert({ startRowIndex: 2, endRowIndex: 5 }, 'UNBOUND_COLS');

	const [[bounds]] = adapter.query();
	assertEquals(bounds[0], -Infinity, 'Omitted startColumnIndex → -Infinity');
	assertEquals(bounds[2], Infinity, 'Omitted endColumnIndex → Infinity');
	assertEquals(bounds[1], 2);
	assertEquals(bounds[3], 4, 'endRowIndex 5 → closed 4');

	const actual = renderAdapter(adapter, {
		width: 6,
		height: 6,
		valueFormatter: (v) => String(v)[0],
	});
	const expected = await loadFixture('Unbounded Columns');
	assertSnapshot(actual, expected);
});

Deno.test('GridRange - Unbounded Rows', async () => {
	const adapter = createGridRangeAdapter(new MortonLinearScanImpl<string>());
	adapter.insert({ startColumnIndex: 1, endColumnIndex: 4 }, 'UNBOUND_ROWS');

	const [[bounds]] = adapter.query();
	assertEquals(bounds[1], -Infinity, 'Omitted startRowIndex → -Infinity');
	assertEquals(bounds[3], Infinity, 'Omitted endRowIndex → Infinity');
	assertEquals(bounds[0], 1);
	assertEquals(bounds[2], 3, 'endColumnIndex 4 → closed 3');

	const actual = renderAdapter(adapter, {
		width: 6,
		height: 6,
		valueFormatter: (v) => String(v)[0],
	});
	const expected = await loadFixture('Unbounded Rows');
	assertSnapshot(actual, expected);
});

Deno.test('GridRange - Unbounded Cross Pattern', async () => {
	const adapter = createGridRangeAdapter(new MortonLinearScanImpl<string>());

	adapter.insert({ startColumnIndex: 2, endColumnIndex: 3 }, 'COL'); // Full column 2
	adapter.insert({ startRowIndex: 2, endRowIndex: 3 }, 'ROW'); // Full row 2 (wins at intersection)

	const results = Array.from(adapter.query());
	assertEquals(results.length >= 2, true, 'Fragmentation from infinite overlap');

	// Verify both values survive fragmentation
	const colFragments = results.filter(([, v]) => v === 'COL');
	const rowFragments = results.filter(([, v]) => v === 'ROW');
	assertEquals(colFragments.length >= 1, true, 'COL survives LWW');
	assertEquals(rowFragments.length >= 1, true, 'ROW survives LWW');

	// Verify at least one fragment has infinite extent
	const hasInfiniteCol = colFragments.some(([b]) => b[1] === -Infinity || b[3] === Infinity);
	const hasInfiniteRow = rowFragments.some(([b]) => b[0] === -Infinity || b[2] === Infinity);
	assertEquals(hasInfiniteCol, true, 'COL retains infinite rows');
	assertEquals(hasInfiniteRow, true, 'ROW retains infinite columns');

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

Deno.test('GridRange - Partial Unbounded (start only)', () => {
	const adapter = createGridRangeAdapter(new MortonLinearScanImpl<string>());
	adapter.insert({ startRowIndex: 1, endRowIndex: 3, startColumnIndex: 2 }, 'PARTIAL');

	const [[bounds]] = adapter.query();
	assertEquals(bounds[0], 2, 'startColumnIndex defined');
	assertEquals(bounds[2], Infinity, 'endColumnIndex omitted → Infinity');
	assertEquals(bounds[1], 1);
	assertEquals(bounds[3], 2);
});

Deno.test('GridRange - Partial Unbounded (end only)', () => {
	const adapter = createGridRangeAdapter(new MortonLinearScanImpl<string>());
	adapter.insert({ startRowIndex: 1, endRowIndex: 3, endColumnIndex: 3 }, 'PARTIAL');

	const [[bounds]] = adapter.query();
	assertEquals(bounds[0], -Infinity, 'startColumnIndex omitted → -Infinity');
	assertEquals(bounds[2], 2, 'endColumnIndex 3 → closed 2');
});
