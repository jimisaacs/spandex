/**
 * Regression Test Suite
 *
 * Comprehensive round-trip scenarios for render ↔ parse validation.
 * All tests here must support BOTH rendering and parsing.
 *
 * - Render direction: GENERATES regression.md fixtures (UPDATE_FIXTURES=1)
 * - Parse direction: CONSUMES regression.md fixtures (round-trip validation)
 *
 * Includes single-grid and multi-state rendering scenarios.
 */

import type { SpatialIndex } from '@jim/spandex';
import { MortonLinearScanImpl } from '@jim/spandex';
import { renderProgression, renderStates } from '@jim/spandex-ascii';
import * as rect from '@jim/spandex/rect';
import { asciiStringCodec, createFixtureGroup } from '@local/snapmark';

const FIXTURE_PATH = new URL('./fixtures/regression.md', import.meta.url);
// const FIXTURE_PATH = new URL('./fixtures/regression-finite-only.md', import.meta.url);

//#region REGRESSION SCENARIOS

Deno.test('Regression - Round-trip Scenarios', async (t) => {
	const { assertMatch, flush } = createFixtureGroup(asciiStringCodec(), {
		context: t,
		filePath: FIXTURE_PATH,
	});

	//#region COMPARISONS (independent states, same input)

	await t.step('Coordinate System Modes', async () => {
		// Show viewport vs absolute rendering
		const result = renderProgression(
			() => new MortonLinearScanImpl<string>(),
			[
				{
					name: 'Viewport Mode',
					action: (idx: SpatialIndex<string>) => idx.insert([5, 10, 6, 10], 'DATA'),
				},
			],
			{ 'D': 'DATA' },
			{ coordinateSystem: 'viewport', strict: true },
		);

		const result2 = renderProgression(
			() => new MortonLinearScanImpl<string>(),
			[
				{
					name: 'Absolute Mode',
					action: (idx: SpatialIndex<string>) => idx.insert([5, 10, 6, 10], 'DATA'),
				},
			],
			{ 'D': 'DATA' },
			{ coordinateSystem: 'absolute', strict: true },
		);

		const result3 = renderProgression(
			() => new MortonLinearScanImpl<string>(),
			[
				{
					name: 'Negative Coords',
					action: (idx: SpatialIndex<string>) => idx.insert([-5, -3, -2, -1], 'DATA'),
				},
			],
			{ 'D': 'DATA' },
			{ coordinateSystem: 'absolute', strict: true },
		);

		// Combine results with separator
		const combined = `${result}\n\n---\n\n${result2}\n\n---\n\n${result3}`;
		await assertMatch(combined, { name: 'Coordinate System Modes' });
	});

	//#endregion

	//#region VARIATIONS (related but independent scenarios)

	await t.step('Infinity Edges (all directions)', async () => {
		const top = new MortonLinearScanImpl<string>();
		top.insert([0, -Infinity, 0, 0], 'TOP');

		const right = new MortonLinearScanImpl<string>();
		right.insert([0, 0, Infinity, 0], 'RIGHT');

		const bottom = new MortonLinearScanImpl<string>();
		bottom.insert([0, 0, 0, Infinity], 'BOTTOM');

		const left = new MortonLinearScanImpl<string>();
		left.insert([-Infinity, 0, 0, 0], 'LEFT');

		const result = renderStates(
			[
				{ name: 'Top ∞', query: () => top.query() },
				{ name: 'Right ∞', query: () => right.query() },
				{ name: 'Bottom ∞', query: () => bottom.query() },
				{ name: 'Left ∞', query: () => left.query() },
			],
			{ 'T': 'TOP', 'R': 'RIGHT', 'B': 'BOTTOM', 'L': 'LEFT' },
		);

		await assertMatch(result, { name: 'Infinity Edges (all directions)' });
	});

	await t.step('Infinity Corners', async () => {
		const topLeft = new MortonLinearScanImpl<string>();
		topLeft.insert([-Infinity, -Infinity, 2, 2], 'TOP-LEFT');

		const topRight = new MortonLinearScanImpl<string>();
		topRight.insert([0, -Infinity, Infinity, 2], 'TOP-RIGHT');

		const bottomLeft = new MortonLinearScanImpl<string>();
		bottomLeft.insert([-Infinity, 0, 2, Infinity], 'BOTTOM-LEFT');

		const bottomRight = new MortonLinearScanImpl<string>();
		bottomRight.insert([0, 0, Infinity, Infinity], 'BOTTOM-RIGHT');

		const result = renderStates(
			[
				{ name: 'Top-Left', query: () => topLeft.query() },
				{ name: 'Top-Right', query: () => topRight.query() },
				{ name: 'Bottom-Left', query: () => bottomLeft.query() },
				{ name: 'Bottom-Right', query: () => bottomRight.query() },
			],
			{ '1': 'TOP-LEFT', '2': 'TOP-RIGHT', '3': 'BOTTOM-LEFT', '4': 'BOTTOM-RIGHT' },
		);

		await assertMatch(result, { name: 'Infinity Corners' });
	});

	await t.step('Infinity Bands (3 edges)', async () => {
		// Horizontal band: infinite on top, left, right; finite on bottom
		const horizontal = new MortonLinearScanImpl<string>();
		horizontal.insert([-Infinity, -Infinity, Infinity, 2], 'HBAND');

		// Vertical band: infinite on left, top, bottom; finite on right
		const vertical = new MortonLinearScanImpl<string>();
		vertical.insert([-Infinity, -Infinity, 2, Infinity], 'VBAND');

		const result = renderStates(
			[
				{ name: 'Horizontal Band', query: () => horizontal.query() },
				{ name: 'Vertical Band', query: () => vertical.query() },
			],
			{ 'H': 'HBAND', 'V': 'VBAND' },
		);

		await assertMatch(result, { name: 'Infinity Bands (3 edges)' });
	});

	await t.step('Data Density Variations', async () => {
		const singleCell = new MortonLinearScanImpl<string>();
		singleCell.insert([1, 1, 1, 1], 'X');

		const sparse = new MortonLinearScanImpl<string>();
		sparse.insert([0, 0, 0, 0], 'A');
		sparse.insert([3, 3, 3, 3], 'B');
		sparse.insert([6, 6, 6, 6], 'C');

		const dense = new MortonLinearScanImpl<string>();
		for (let x = 0; x < 4; x++) {
			for (let y = 0; y < 4; y++) {
				dense.insert([x, y, x, y], 'D');
			}
		}

		const result = renderStates(
			[
				{ name: 'Single Cell', query: () => singleCell.query() },
				{ name: 'Sparse', query: () => sparse.query() },
				{ name: 'Dense 4×4', query: () => dense.query() },
			],
			{ 'X': 'X', 'A': 'A', 'B': 'B', 'C': 'C', 'D': 'D' },
		);

		await assertMatch(result, { name: 'Data Density Variations' });
	});

	//#endregion

	//#region CUMULATIVE EVOLUTIONS (showing LWW/decomposition)

	await t.step('Cross Formation (LWW decomposition)', async () => {
		const result = renderProgression(
			() => new MortonLinearScanImpl<string>(),
			[
				{ name: 'Empty', action: () => {} },
				{
					name: 'Add Horizontal',
					action: (idx: SpatialIndex<string>) => idx.insert([-Infinity, 1, Infinity, 1], 'H'),
				},
				{
					name: 'Add Vertical (LWW)',
					action: (idx: SpatialIndex<string>) => idx.insert([1, -Infinity, 1, Infinity], 'V'),
				},
			],
			{ 'H': 'H', 'V': 'V' },
		);

		await assertMatch(result, { name: 'Cross Formation (LWW decomposition)' });
	});

	await t.step('Global Override Evolution', async () => {
		const result = renderProgression(
			() => new MortonLinearScanImpl<string>(),
			[
				{
					name: 'Global Fill',
					action: (idx: SpatialIndex<string>) => idx.insert(rect.ALL, 'GLOBAL'),
				},
				{
					name: 'Positive Local Wins',
					action: (idx: SpatialIndex<string>) => idx.insert([2, 2, 2, 2], 'LOCAL+'),
				},
				{
					name: 'Negative Local Wins',
					action: (idx: SpatialIndex<string>) => idx.insert([-2, -2, -2, -2], 'LOCAL-'),
				},
			],
			{ 'G': 'GLOBAL', '+': 'LOCAL+', '-': 'LOCAL-' },
		);

		await assertMatch(result, { name: 'Global Override Evolution' });
	});

	await t.step('Overlap Decomposition (fragments)', async () => {
		const result = renderProgression(
			() => new MortonLinearScanImpl<string>(),
			[
				{
					name: 'Shape A',
					action: (idx: SpatialIndex<string>) => idx.insert([0, 0, 2, 2], 'A'),
				},
				{
					name: 'Add B (decomposes A)',
					action: (idx: SpatialIndex<string>) => idx.insert([1, 1, 3, 3], 'B'),
				},
				{
					name: 'Add C (further decomp)',
					action: (idx: SpatialIndex<string>) => idx.insert([2, 0, 2, 3], 'C'),
				},
			],
			{ 'A': 'A', 'B': 'B', 'C': 'C' },
		);

		await assertMatch(result, { name: 'Overlap Decomposition (fragments)' });
	});

	//#endregion

	//#region SINGLE STATES (no value in multi-state)

	await t.step('Empty Index', async () => {
		const result = renderProgression(
			() => new MortonLinearScanImpl<string>(),
			[{ name: 'Empty', action: () => {} }],
			{},
			{ strict: true },
		);

		await assertMatch(result, { name: 'Empty Index' });
	});

	await t.step('All Infinity (no finite data)', async () => {
		const result = renderProgression(
			() => new MortonLinearScanImpl<string>(),
			[{
				name: 'Infinite Everywhere',
				action: (idx: SpatialIndex<string>) => idx.insert(rect.ALL, 'EVERYWHERE'),
			}],
			{ '∞': 'EVERYWHERE' },
			{ strict: true },
		);

		await assertMatch(result, { name: 'All Infinity (no finite data)' });
	});

	//#endregion

	//#region PROGRESSION FEATURES (spacing, multi-state)

	await t.step('Two-state progression', async () => {
		const result = renderProgression(
			() => new MortonLinearScanImpl<string>(),
			[
				{
					name: 'After H',
					action: (idx: SpatialIndex<string>) => idx.insert([-Infinity, 1, Infinity, 1], 'HORIZONTAL'),
				},
				{
					name: 'After V',
					action: (idx: SpatialIndex<string>) => idx.insert([1, -Infinity, 1, Infinity], 'VERTICAL'),
				},
			],
			{ 'H': 'HORIZONTAL', 'V': 'VERTICAL' },
		);

		await assertMatch(result, { name: 'Two-state progression' });
	});

	await t.step('Three-state progression with empty state', async () => {
		const result = renderProgression(
			() => new MortonLinearScanImpl<string>(),
			[
				{ name: 'Empty', action: () => {} },
				{
					name: 'After H',
					action: (idx: SpatialIndex<string>) => idx.insert([-Infinity, 1, Infinity, 1], 'HORIZONTAL'),
				},
				{
					name: 'After V',
					action: (idx: SpatialIndex<string>) => idx.insert([1, -Infinity, 1, Infinity], 'VERTICAL'),
				},
			],
			{ 'H': 'HORIZONTAL', 'V': 'VERTICAL' },
		);

		await assertMatch(result, { name: 'Three-state progression with empty state' });
	});

	await t.step('Custom spacing between grids', async () => {
		const result = renderProgression(
			() => new MortonLinearScanImpl<string>(),
			[
				{
					name: 'A',
					action: (idx: SpatialIndex<string>) => idx.insert([0, 0, 0, 0], 'X'),
				},
				{
					name: 'B',
					action: (idx: SpatialIndex<string>) => idx.insert([1, 0, 1, 0], 'Y'),
				},
			],
			{ 'X': 'X', 'Y': 'Y' },
			{ spacing: 5 },
		);

		await assertMatch(result, { name: 'Custom spacing between grids' });
	});

	await t.step('Independent states (non-cumulative)', async () => {
		// Create two independent indexes
		const index1 = new MortonLinearScanImpl<string>();
		index1.insert([0, 0, 1, 0], 'RED');

		const index2 = new MortonLinearScanImpl<string>();
		index2.insert([0, 0, 1, 0], 'BLUE');

		// Capture snapshots
		const state1 = Array.from(index1.query());
		const state2 = Array.from(index2.query());

		const result = renderStates(
			[
				{ name: 'Index A', query: () => state1.values() },
				{ name: 'Index B', query: () => state2.values() },
			],
			{ 'R': 'RED', 'B': 'BLUE' },
		);

		await assertMatch(result, { name: 'Independent states (non-cumulative)' });
	});

	//#endregion

	await flush();
});

//#endregion
