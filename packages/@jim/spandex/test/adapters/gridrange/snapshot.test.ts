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
import { render } from '@jim/spandex-ascii';
import { createGridRangeAdapter } from '@jim/spandex/adapters/gridrange';
import * as rect from '@jim/spandex/rect';
import { asciiStringCodec, createFixtureGroup } from '@local/snapmark';
import { assertEquals } from '@std/assert';

Deno.test('GridRange Snapshot Tests', async (t) => {
	const { assertMatch, flush } = createFixtureGroup(asciiStringCodec(), {
		context: t,
		filePath: new URL('../fixtures/adapter-test.md', import.meta.url),
	});

	//#region Bounded Ranges
	await t.step('Single Cell Precision', () => {
		const adapter = createGridRangeAdapter(new MortonLinearScanImpl<string>());
		adapter.insert(
			{ startRowIndex: 1, endRowIndex: 2, startColumnIndex: 1, endColumnIndex: 2 },
			'CELL',
		);

		const [[bounds]] = adapter.query();
		assertEquals(bounds, [1, 1, 1, 1], 'Half-open [1,2)×[1,2) → closed [1,1,1,1]');

		const actual = render(() => adapter.query(), { C: 'CELL' });
		assertMatch(actual, { name: 'Single Cell Precision' });
	});

	await t.step('Boundary Touching Ranges', () => {
		const adapter = createGridRangeAdapter(new MortonLinearScanImpl<string>());

		// Four 2×2 quadrants using half-open intervals
		adapter.insert({ startRowIndex: 0, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 2 }, 'quad-1');
		adapter.insert({ startRowIndex: 0, endRowIndex: 2, startColumnIndex: 2, endColumnIndex: 4 }, 'quad-2');
		adapter.insert({ startRowIndex: 2, endRowIndex: 4, startColumnIndex: 0, endColumnIndex: 2 }, 'quad-3');
		adapter.insert({ startRowIndex: 2, endRowIndex: 4, startColumnIndex: 2, endColumnIndex: 4 }, 'quad-4');

		const results = Array.from(adapter.query());
		assertEquals(results.length, 4, 'Half-open intervals should not overlap');

		const actual = render(() => adapter.query(), {
			'1': 'quad-1',
			'2': 'quad-2',
			'3': 'quad-3',
			'4': 'quad-4',
		});
		assertMatch(actual, { name: 'Boundary Touching Ranges' });
	});

	await t.step('Complex Fragmentation', () => {
		const adapter = createGridRangeAdapter(new MortonLinearScanImpl<string>());

		// Three overlapping ranges → automatic decomposition
		adapter.insert(
			{ startRowIndex: 0, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 5 },
			'BASE',
		);
		adapter.insert(
			{ startRowIndex: 1, endRowIndex: 4, startColumnIndex: 1, endColumnIndex: 4 },
			'OVERLAP1',
		);
		adapter.insert(
			{ startRowIndex: 2, endRowIndex: 5, startColumnIndex: 2, endColumnIndex: 6 },
			'OVERLAP2',
		);

		const actual = render(() => adapter.query(), { '1': 'BASE', '2': 'OVERLAP1', '3': 'OVERLAP2' });
		assertMatch(actual, { name: 'Complex Fragmentation' });
	});

	await t.step('Wide Column Range', () => {
		const adapter = createGridRangeAdapter(new MortonLinearScanImpl<string>());
		adapter.insert(
			{ startRowIndex: 0, endRowIndex: 8, startColumnIndex: 2, endColumnIndex: 6 },
			'WIDE',
		);

		const actual = render(() => adapter.query(), { W: 'WIDE' });
		assertMatch(actual, { name: 'Wide Column Range' });
	});
	//#endregion Bounded Ranges

	//#region Infinite Extents
	await t.step('Full Column Extent', () => {
		const adapter = createGridRangeAdapter(new MortonLinearScanImpl<string>());

		// Omit row indices → infinite row extent
		adapter.insert({ startColumnIndex: 1, endColumnIndex: 2 }, 'COL_B');
		adapter.insert({ startColumnIndex: 3, endColumnIndex: 5 }, 'COL_DE');

		const actual = render(() => adapter.query(), { C: 'COL_B', O: 'COL_DE' });
		assertMatch(actual, { name: 'Full Column Extent' });
	});

	await t.step('Full Row Extent', () => {
		const adapter = createGridRangeAdapter(new MortonLinearScanImpl<string>());

		// Omit column indices → infinite column extent
		adapter.insert({ startRowIndex: 1, endRowIndex: 2 }, 'ROW_2');
		adapter.insert({ startRowIndex: 3, endRowIndex: 5 }, 'ROW_45');

		const actual = render(() => adapter.query(), { R: 'ROW_2', O: 'ROW_45' });
		assertMatch(actual, { name: 'Full Row Extent' });
	});

	await t.step('Unbounded Columns', () => {
		const adapter = createGridRangeAdapter(new MortonLinearScanImpl<string>());
		adapter.insert({ startRowIndex: 2, endRowIndex: 5 }, 'UNBOUND_COLS');

		const [[bounds]] = adapter.query();
		assertEquals(bounds[0], -Infinity, 'Omitted startColumnIndex → -Infinity');
		assertEquals(bounds[2], Infinity, 'Omitted endColumnIndex → Infinity');
		assertEquals(bounds[1], 2);
		assertEquals(bounds[3], 4, 'endRowIndex 5 → closed 4');

		const actual = render(() => adapter.query(), { U: 'UNBOUND_COLS' });
		assertMatch(actual, { name: 'Unbounded Columns' });
	});

	await t.step('Unbounded Rows', () => {
		const adapter = createGridRangeAdapter(new MortonLinearScanImpl<string>());
		adapter.insert({ startColumnIndex: 1, endColumnIndex: 4 }, 'UNBOUND_ROWS');

		const [[bounds]] = adapter.query();
		assertEquals(bounds[1], -Infinity, 'Omitted startRowIndex → -Infinity');
		assertEquals(bounds[3], Infinity, 'Omitted endRowIndex → Infinity');
		assertEquals(bounds[0], 1);
		assertEquals(bounds[2], 3, 'endColumnIndex 4 → closed 3');

		const actual = render(() => adapter.query(), { U: 'UNBOUND_ROWS' });
		assertMatch(actual, { name: 'Unbounded Rows' });
	});

	await t.step('Unbounded Cross Pattern', () => {
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

		const actual = render(() => adapter.query(), { C: 'COL', R: 'ROW' });
		assertMatch(actual, { name: 'Unbounded Cross' });
	});
	//#endregion Infinite Extents

	await t.step('Completely Unbounded', () => {
		const adapter = createGridRangeAdapter(new MortonLinearScanImpl<string>());
		adapter.insert({}, 'EVERYWHERE');

		const [[bounds]] = adapter.query();
		assertEquals(bounds, rect.ALL, 'Empty object → infinite bounds');

		const actual = render(() => adapter.query(), { E: 'EVERYWHERE' });

		// Visual verification: entire viewport should be filled with 'E'
		const lines = actual.split('\n').filter((l) => l.includes('|'));
		const dataLines = lines.filter((l) => /^\s*(\d|∞)/.test(l));
		for (const line of dataLines) {
			// Check that all cells (between | separators) contain only 'E' or whitespace
			const cells = line.split('|').slice(1, -1); // Skip first/last empty parts
			for (const cell of cells) {
				assertEquals(cell.trim(), 'E', `Expected all cells to be 'E': ${line}`);
			}
		}
	});

	await flush();
});
