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

import { createRenderer } from '@jim/spandex-ascii';
import { asciiStringCodec, createFixtureGroup } from '@local/snapmark';
import { createRegressionScenarios } from '@local/spandex-testing/regression-scenarios';
import { validateRoundTrip } from '@local/spandex-testing/round-trip';

const FIXTURE_PATH = new URL('./fixtures/regression.md', import.meta.url);

//#region REGRESSION SCENARIOS

Deno.test('Regression - Round-trip Scenarios', async (t) => {
	const { renderLayout, renderProgression } = createRenderer();
	const scenarios = createRegressionScenarios();

	const { assertMatch, flush } = createFixtureGroup(asciiStringCodec(), {
		context: t,
		filePath: FIXTURE_PATH,
	});

	//#region COMPARISONS (independent states, same input)

	await t.step('Origin Inclusion Modes', async () => {
		const { index1, index2, index3 } = scenarios.originInclusion();
		const legend = { 'D': 'DATA' };

		const result = renderLayout(
			[
				{ params: { name: 'No Origin 1' }, source: index1 },
				{ params: { name: 'No Origin 2' }, source: index2 },
				{ params: { name: 'No Origin 3' }, source: index3 },
			],
			{ legend, strict: true, includeOrigin: false },
		);

		const result2 = renderLayout(
			[
				{ params: { name: 'Origin Included 1' }, source: index1 },
				{ params: { name: 'Origin Included 2' }, source: index2 },
				{ params: { name: 'Origin Included 3' }, source: index3 },
			],
			{ legend, strict: true, includeOrigin: true },
		);

		await assertMatch(result, { name: 'Origin Excluded' });
		await assertMatch(result2, { name: 'Origin Included' });

		// Validate round-trip parsing
		validateRoundTrip<string>(result, 3, { legend }, true);
		validateRoundTrip<string>(result2, 3, { legend }, true);
	});

	//#endregion

	//#region VARIATIONS (related but independent scenarios)

	await t.step('Infinity Edges (all directions)', async () => {
		const { top, right, bottom, left } = scenarios.infinityEdges();
		const legend = { 'T': 'TOP', 'R': 'RIGHT', 'B': 'BOTTOM', 'L': 'LEFT' };

		const result = renderLayout(
			[
				{ params: { name: 'Top ∞' }, source: top },
				{ params: { name: 'Right ∞' }, source: right },
				{ params: { name: 'Bottom ∞' }, source: bottom },
				{ params: { name: 'Left ∞' }, source: left },
			],
			{ legend, strict: true },
		);

		await assertMatch(result, { name: 'Infinity Edges (all directions)' });
		validateRoundTrip<string>(result, 4, { legend }, true);
	});

	await t.step('Infinity Corners', async () => {
		const { topLeft, topRight, bottomLeft, bottomRight } = scenarios.infinityCorners();
		const legend = { '1': 'TOP-LEFT', '2': 'TOP-RIGHT', '3': 'BOTTOM-LEFT', '4': 'BOTTOM-RIGHT' };

		const result = renderLayout(
			[
				{ params: { name: 'Top-Left' }, source: topLeft },
				{ params: { name: 'Top-Right' }, source: topRight },
				{ params: { name: 'Bottom-Left' }, source: bottomLeft },
				{ params: { name: 'Bottom-Right' }, source: bottomRight },
			],
			{ legend, strict: true },
		);

		await assertMatch(result, { name: 'Infinity Corners' });
		validateRoundTrip<string>(result, 4, { legend }, true);
	});

	await t.step('Infinity Bands (3 edges)', async () => {
		const { horizontal, vertical } = scenarios.infinityBands();
		const legend = { 'H': 'HBAND', 'V': 'VBAND' };

		const result = renderLayout(
			[
				{ params: { name: 'Horizontal Band' }, source: horizontal },
				{ params: { name: 'Vertical Band' }, source: vertical },
			],
			{ legend, strict: true },
		);

		await assertMatch(result, { name: 'Infinity Bands (3 edges)' });
		validateRoundTrip<string>(result, 2, { legend }, true);
	});

	await t.step('Data Density Variations', async () => {
		const { singleCell, sparse, dense } = scenarios.dataDensity();
		const legend = { 'X': 'X', 'A': 'A', 'B': 'B', 'C': 'C', 'D': 'D' };

		const result = renderLayout(
			[
				{ params: { name: 'Single Cell' }, source: singleCell },
				{ params: { name: 'Sparse' }, source: sparse },
				{ params: { name: 'Dense 4×4' }, source: dense },
			],
			{ legend, strict: true },
		);

		await assertMatch(result, { name: 'Data Density Variations' });
		validateRoundTrip<string>(result, 3, { legend }, true);
	});

	await t.step('Partitioned Index - Multiple attributes', async () => {
		type CellData = { bg: string; fg: string };
		const { factory, steps } = scenarios.progressions.partitionedMultiple<CellData>();
		const legend = {
			'B': { bg: 'BACK' },
			'F': { fg: 'FORE' },
			'X': { bg: 'BACK', fg: 'FORE' },
			'D': { bg: 'DARK', fg: 'FORE' },
		};

		const result = renderProgression(
			factory,
			steps.map(({ name, action }) => ({ params: { name }, action })),
			{ legend, strict: true },
		);

		await assertMatch(result, { name: 'Partitioned Index - Multiple attributes' });
		validateRoundTrip<Record<string, unknown>>(result, 3, { legend }, true);
	});

	await t.step('Partitioned Index - Attribute override', async () => {
		type CellData = { color: string };
		const { factory, steps } = scenarios.progressions.partitionedOverride<CellData>();
		const legend = { 'R': { color: 'RED' }, 'B': { color: 'BLUE' } };

		const result = renderProgression(
			factory,
			steps.map(({ name, action }) => ({ params: { name }, action })),
			{ legend, strict: true },
		);

		await assertMatch(result, { name: 'Partitioned Index - Attribute override' });
		validateRoundTrip<Record<string, unknown>>(result, 2, { legend }, true);
	});

	//#endregion

	//#region CUMULATIVE EVOLUTIONS (showing LWW/decomposition)

	await t.step('Cross Formation (LWW decomposition)', async () => {
		const { factory, steps } = scenarios.progressions.crossFormation();
		const legend = { 'H': 'H', 'V': 'V' };

		const result = renderProgression(
			factory,
			steps.map(({ name, action }) => ({ params: { name }, action })),
			{ legend, strict: true },
		);

		await assertMatch(result, { name: 'Cross Formation (LWW decomposition)' });
		validateRoundTrip<string>(result, 3, { legend }, true);
	});

	await t.step('Global Override Evolution', async () => {
		const { factory, steps } = scenarios.progressions.globalOverride();
		const legend = { 'G': 'GLOBAL', '+': 'LOCAL+', '-': 'LOCAL-' };

		const result = renderProgression(
			factory,
			steps.map(({ name, action }) => ({ params: { name }, action })),
			{ legend, strict: true },
		);

		await assertMatch(result, { name: 'Global Override Evolution' });
		validateRoundTrip<string>(result, 3, { legend }, true);
	});

	await t.step('Overlap Decomposition (fragments)', async () => {
		const { factory, steps } = scenarios.progressions.overlapDecomposition();
		const legend = { 'A': 'A', 'B': 'B', 'C': 'C' };

		const result = renderProgression(
			factory,
			steps.map(({ name, action }) => ({ params: { name }, action })),
			{ legend, strict: true },
		);

		await assertMatch(result, { name: 'Overlap Decomposition (fragments)' });
		validateRoundTrip<string>(result, 3, { legend }, true);
	});

	//#endregion

	//#region SINGLE STATES (no value in multi-state)

	await t.step('Empty Index', async () => {
		const { factory, steps } = scenarios.progressions.empty();
		const result = renderProgression(
			factory,
			steps.map(({ name, action }) => ({ params: { name }, action })),
			{ legend: {}, strict: true },
		);

		await assertMatch(result, { name: 'Empty Index' });
		validateRoundTrip<string>(result, 1, { legend: {} }, true);
	});

	await t.step('All Infinity (no finite data)', async () => {
		const { viewport, absolute } = scenarios.allInfinity();
		const legend = { '∞': 'EVERYWHERE' };

		const result = renderLayout(
			[
				{ source: viewport, params: { name: 'Origin Excluded', includeOrigin: false } },
				{ source: absolute, params: { name: 'Origin Included', includeOrigin: true } },
			],
			{ legend, strict: true },
		);

		await assertMatch(result, { name: 'All Infinity (no finite data)' });
		validateRoundTrip<string>(result, 2, { legend }, true);
	});

	//#endregion

	//#region PROGRESSION FEATURES (spacing, multi-state)

	await t.step('Two-state progression', async () => {
		const { factory, steps } = scenarios.progressions.twoState();
		const legend = { 'H': 'HORIZONTAL', 'V': 'VERTICAL' };

		const result = renderProgression(
			factory,
			steps.map(({ name, action }) => ({ params: { name }, action })),
			{ legend, strict: true },
		);

		await assertMatch(result, { name: 'Two-state progression' });
		validateRoundTrip<string>(result, 2, { legend }, true);
	});

	await t.step('Three-state progression with empty state', async () => {
		const { factory, steps } = scenarios.progressions.threeState();
		const legend = { 'H': 'HORIZONTAL', 'V': 'VERTICAL' };

		const result = renderProgression(
			factory,
			steps.map(({ name, action }) => ({ params: { name }, action })),
			{ legend, strict: true },
		);

		await assertMatch(result, { name: 'Three-state progression with empty state' });
		validateRoundTrip<string>(result, 3, { legend }, true);
	});

	await t.step('Custom spacing between grids', async () => {
		const { factory, steps } = scenarios.progressions.customSpacing();
		const legend = { 'X': 'X', 'Y': 'Y' };

		const result = renderProgression(
			factory,
			steps.map(({ name, action }) => ({ params: { name }, action })),
			{ legend, spacing: 5, strict: true },
		);

		await assertMatch(result, { name: 'Custom spacing between grids' });
		validateRoundTrip<string>(result, 2, { legend, spacing: 5 }, true);
	});

	await t.step('Independent states (non-cumulative)', async () => {
		const { index1, index2 } = scenarios.independentStates();
		const legend = { 'R': 'RED', 'B': 'BLUE' };

		const result = renderLayout(
			[
				{ params: { name: 'Index A' }, source: index1 },
				{ params: { name: 'Index B' }, source: index2 },
			],
			{ legend, spacing: 5 },
		);

		await assertMatch(result, { name: 'Independent states (non-cumulative)' });
		validateRoundTrip<string>(result, 2, { legend, spacing: 5 }, true);
	});

	//#endregion

	await flush();
});

//#endregion
