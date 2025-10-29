/**
 * A1 Notation Adapter Tests
 *
 * Tests coordinate conversion between A1 notation (e.g., "B2", "A1:D4", "C:C", "3:5")
 * and internal closed-interval rectangles.
 */

import { createRenderer } from '@jim/spandex-ascii';
import { createA1Adapter } from '@jim/spandex/adapter/a1';
import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
import * as r from '@jim/spandex/r';
import { asciiStringCodec, createFixtureGroup } from '@local/snapmark';
import { validateRoundTrip } from '@local/spandex-testing/round-trip';
import { assertEquals } from '@std/assert';

Deno.test('A1 Snapshot Tests', async (t) => {
	const { render } = createRenderer();
	const { assertMatch, flush } = createFixtureGroup(asciiStringCodec(), {
		context: t,
		filePath: new URL('../fixtures/adapter-test.md', import.meta.url),
	});

	// #region Bounded Ranges
	await t.step('Single Cell Precision', () => {
		const adapter = createA1Adapter(createMortonLinearScanIndex<'CELL'>());
		adapter.insert('B2', 'CELL');

		const [bounds] = Array.from(adapter.query())[0]!;
		assertEquals(bounds, [1, 1, 1, 1], 'B2 → [1,1,1,1]');

		const legend = { C: 'CELL' };
		const actual = render(adapter, { legend });
		assertMatch(actual, { name: 'Single Cell Precision' });
		validateRoundTrip(actual, 1, { legend });
	});

	await t.step('Boundary Touching Ranges', () => {
		const adapter = createA1Adapter(createMortonLinearScanIndex<'quad-1' | 'quad-2' | 'quad-3' | 'quad-4'>());

		// Four 2×2 quadrants
		adapter.insert('A1:B2', 'quad-1');
		adapter.insert('C1:D2', 'quad-2');
		adapter.insert('A3:B4', 'quad-3');
		adapter.insert('C3:D4', 'quad-4');

		const results = Array.from(adapter.query());
		assertEquals(results.length, 4, 'Adjacent ranges should not overlap');

		const legend = {
			'1': 'quad-1',
			'2': 'quad-2',
			'3': 'quad-3',
			'4': 'quad-4',
		} as const;
		const actual = render(adapter, { legend });
		assertMatch(actual, { name: 'Boundary Touching Ranges' });
		validateRoundTrip(actual, 1, { legend });
	});

	await t.step('Complex Fragmentation', () => {
		const adapter = createA1Adapter(createMortonLinearScanIndex<'BASE' | 'OVERLAP1' | 'OVERLAP2'>());

		// Three overlapping ranges → automatic decomposition
		adapter.insert('A1:E3', 'BASE');
		adapter.insert('B2:D4', 'OVERLAP1');
		adapter.insert('C3:F5', 'OVERLAP2');

		const legend = { '1': 'BASE', '2': 'OVERLAP1', '3': 'OVERLAP2' };
		const actual = render(adapter, { legend });
		assertMatch(actual, { name: 'Complex Fragmentation' });
		validateRoundTrip(actual, 1, { legend });
	});

	await t.step('Wide Column Range', () => {
		const adapter = createA1Adapter(createMortonLinearScanIndex<'WIDE'>());
		adapter.insert('C1:F8', 'WIDE');

		const legend = { W: 'WIDE' };
		const actual = render(adapter, { legend });
		assertMatch(actual, { name: 'Wide Column Range' });
		validateRoundTrip(actual, 1, { legend });
	});
	//#endregion Bounded Ranges

	// #region Infinite Extents
	await t.step('Full Column Extent', () => {
		const adapter = createA1Adapter(createMortonLinearScanIndex<'COL_B' | 'COL_DE'>());

		// "B:B" = column B, all rows → infinite row extent
		adapter.insert('B:B', 'COL_B');
		adapter.insert('D:E', 'COL_DE');

		const actual = render(adapter, { legend: { C: 'COL_B', O: 'COL_DE' } });
		assertMatch(actual, { name: 'Full Column Extent' });
	});

	await t.step('Full Row Extent', () => {
		const adapter = createA1Adapter(createMortonLinearScanIndex<'ROW_2' | 'ROW_45'>());

		// "2:2" = row 2, all columns → infinite column extent
		adapter.insert('2:2', 'ROW_2');
		adapter.insert('4:5', 'ROW_45');

		const actual = render(adapter, { legend: { R: 'ROW_2', O: 'ROW_45' } });
		assertMatch(actual, { name: 'Full Row Extent' });
	});

	await t.step('Unbounded Columns', () => {
		const adapter = createA1Adapter(createMortonLinearScanIndex<'UNBOUND_COLS'>());
		adapter.insert('3:5', 'UNBOUND_COLS');

		const [bounds] = Array.from(adapter.query())[0]!;
		assertEquals(bounds[0], r.negInf, 'Row-only notation → infinite columns');
		assertEquals(bounds[2], r.posInf, 'Row-only notation → infinite columns');
		assertEquals(bounds[1], 2, 'Row 3 → internal 2 (0-indexed)');
		assertEquals(bounds[3], 4);

		const actual = render(adapter, { legend: { U: 'UNBOUND_COLS' } });
		assertMatch(actual, { name: 'Unbounded Columns' });
	});

	await t.step('Unbounded Rows', () => {
		const adapter = createA1Adapter(createMortonLinearScanIndex<'UNBOUND_ROWS'>());
		adapter.insert('B:D', 'UNBOUND_ROWS');

		const [bounds] = Array.from(adapter.query())[0]!;
		assertEquals(bounds[1], r.negInf, 'Column-only notation → infinite rows');
		assertEquals(bounds[3], r.posInf, 'Column-only notation → infinite rows');
		assertEquals(bounds[0], 1, 'Column B → internal 1');
		assertEquals(bounds[2], 3);

		const actual = render(adapter, { legend: { U: 'UNBOUND_ROWS' } });
		assertMatch(actual, { name: 'Unbounded Rows' });
	});

	await t.step('Unbounded Cross Pattern', () => {
		const adapter = createA1Adapter(createMortonLinearScanIndex<'COL' | 'ROW'>());

		adapter.insert('C:C', 'COL'); // Full column C
		adapter.insert('3:3', 'ROW'); // Full row 3 (wins at intersection)

		const results = Array.from(adapter.query());
		assertEquals(results.length >= 2, true, 'Fragmentation from infinite overlap');

		// Verify both values survive fragmentation
		const colFragments = results.filter(([, v]) => v === 'COL');
		const rowFragments = results.filter(([, v]) => v === 'ROW');
		assertEquals(colFragments.length >= 1, true, 'COL survives LWW');
		assertEquals(rowFragments.length >= 1, true, 'ROW survives LWW');

		const actual = render(adapter, { legend: { C: 'COL', R: 'ROW' } });
		assertMatch(actual, { name: 'Unbounded Cross' });
	});
	//#endregion Infinite Extents

	await flush();
});
