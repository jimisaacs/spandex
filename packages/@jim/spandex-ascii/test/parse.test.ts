/** Parse-only edge cases not covered by round-trip regression tests */

import { createRenderer, parse } from '@jim/spandex-ascii';
import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
import { assertEquals, assertExists } from '@std/assert';

Deno.test('Parse - Negative Coordinates', () => {
	const { render } = createRenderer();

	const index = createMortonLinearScanIndex<'NEG'>();
	index.insert([-5, -3, -2, -1], 'NEG');

	const ascii = render(index, { legend: { 'N': 'NEG' } });
	const parsed = parse<string>(ascii);

	// Validate grid structure
	assertEquals(parsed.grids.length, 1);
	const grid = parsed.grids[0];
	assertExists(grid);
	assertEquals(grid.name, undefined);

	// Validate results
	const results = grid.results;
	assertEquals(results.length, 12); // 4 columns × 3 rows

	// All cells should have value 'NEG'
	for (const [, value] of results) {
		assertEquals(value, 'NEG');
	}

	// Validate coordinate coverage
	const xs = results.map(([bounds]) => bounds[0]);
	const ys = results.map(([bounds]) => bounds[1]);
	assertEquals(Math.min(...xs), -5);
	assertEquals(Math.max(...xs), -2);
	assertEquals(Math.min(...ys), -3);
	assertEquals(Math.max(...ys), -1);

	// Validate extent
	assertEquals(grid.extent.mbr, [-5, -3, -2, -1]);
	assertEquals(grid.extent.edges, [false, false, false, false]);
	assertEquals(grid.extent.empty, false);

	// Validate legend
	assertEquals(parsed.legend, { 'N': 'NEG' });
});

Deno.test('Parse - Grid Names (multi-grid layout)', () => {
	const { renderLayout } = createRenderer();

	const index1 = createMortonLinearScanIndex<'A'>();
	index1.insert([0, 0, 1, 0], 'A');

	const index2 = createMortonLinearScanIndex<'B'>();
	index2.insert([0, 0, 1, 0], 'B');

	const index3 = createMortonLinearScanIndex<'C'>();
	index3.insert([0, 0, 1, 0], 'C');

	const ascii = renderLayout(
		[
			{ params: { name: 'First' }, source: index1 },
			{ params: { name: 'Second' }, source: index2 },
			{ params: { name: 'Third' }, source: index3 },
		],
		{ legend: { 'A': 'A', 'B': 'B', 'C': 'C' } },
	);

	const parsed = parse<string>(ascii);

	// Validate grid count and names
	assertEquals(parsed.grids.length, 3);
	assertEquals(parsed.grids[0]?.name, 'First');
	assertEquals(parsed.grids[1]?.name, 'Second');
	assertEquals(parsed.grids[2]?.name, 'Third');

	// Validate each grid has correct results and extent
	for (let i = 0; i < 3; i++) {
		const grid = parsed.grids[i];
		const expectedValue = ['A', 'B', 'C'][i];

		assertExists(grid);
		assertEquals(grid.results.length, 2); // 2 cells (columns A-B, row 1)
		assertEquals(grid.results[0]![1], expectedValue);
		assertEquals(grid.results[1]![1], expectedValue);

		// All grids should have same extent [0, 0, 1, 0]
		assertEquals(grid.extent.mbr, [0, 0, 1, 0]);
		assertEquals(grid.extent.edges, [false, false, false, false]);
		assertEquals(grid.extent.empty, false);
	}

	// Validate legend
	assertEquals(parsed.legend, { 'A': 'A', 'B': 'B', 'C': 'C' });
});

Deno.test('Parse - Single Grid Without Name', () => {
	const { render } = createRenderer();

	const index = createMortonLinearScanIndex<'DATA'>();
	index.insert([0, 0, 1, 0], 'DATA');

	const ascii = render(index, { legend: { 'D': 'DATA' } });
	const parsed = parse<string>(ascii);

	// Validate grid structure
	assertEquals(parsed.grids.length, 1);
	const grid = parsed.grids[0];
	assertExists(grid);
	assertEquals(grid.name, undefined);

	// Validate results
	assertEquals(grid.results.length, 2); // 2 cells (columns A-B, row 0)
	assertEquals(grid.results[0], [[0, 0, 0, 0], 'DATA']);
	assertEquals(grid.results[1], [[1, 0, 1, 0], 'DATA']);

	// Validate extent
	assertEquals(grid.extent.mbr, [0, 0, 1, 0]);
	assertEquals(grid.extent.edges, [false, false, false, false]);
	assertEquals(grid.extent.empty, false);

	// Validate legend
	assertEquals(parsed.legend, { 'D': 'DATA' });
});
