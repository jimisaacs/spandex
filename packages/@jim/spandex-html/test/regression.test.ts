/**
 * HTML Regression Test Suite
 *
 * Comprehensive fixture-based validation of HTML table rendering.
 * Uses shared scenarios from `@local/spandex-testing/regression-scenarios`.
 *
 * **Note**: HTML backend does not support parsing (fixture generation only).
 */

import { createFixtureGroup, type FixtureCodec } from '@local/snapmark';
import { createRegressionScenarios } from '@local/spandex-testing/regression-scenarios';
import { createRenderer } from '../src/mod.ts';
import type { HTMLLegend } from '../src/types.ts';

/** Fixture codec for HTML strings */
const htmlCodec = (): FixtureCodec<string> => ({
	encode: (value) => value,
	decode: (encoded) => encoded,
});

/**
 * Convert ASCII-style legend to HTML format with auto-generated colors.
 *
 * HTML legend keys are serialized VALUES (not labels) to match backend lookup.
 * For objects, keys are JSON-stringified to align with `serializeValue()`.
 */
function toHTMLLegend<T>(asciiLegend: Record<string, T>): HTMLLegend<T> {
	const defaultColors = ['#ff5555', '#55ff55', '#5555ff', '#ffff55', '#ff55ff', '#55ffff'];
	const result: HTMLLegend<T> = {};

	Object.entries(asciiLegend).forEach(([label, value], i) => {
		const valueKey = typeof value === 'object' ? JSON.stringify(value) : String(value);
		result[valueKey] = {
			label,
			color: defaultColors[i % defaultColors.length] ?? '#999999',
			value,
		};
	});

	return result;
}

const FIXTURE_PATH = new URL('./fixtures/regression.md', import.meta.url);

//#region REGRESSION SCENARIOS

Deno.test('HTML Regression Scenarios', async (t) => {
	const { renderLayout, renderProgression } = createRenderer();
	const scenarios = createRegressionScenarios();

	const { assertMatch, flush } = createFixtureGroup(htmlCodec(), {
		context: t,
		filePath: FIXTURE_PATH,
	});

	//#region SECTION 1: CORE BEHAVIOR - What the library does

	await t.step('Overlap Decomposition (fragments)', async () => {
		const { factory, steps } = scenarios.progressions
			.overlapDecomposition();
		const legend = toHTMLLegend({ 'A': 'A', 'B': 'B', 'C': 'C' } as const);

		const result = renderProgression(
			factory,
			steps.map(({ name, action }) => ({ params: { name }, action })),
			{ legend, strict: true },
		);

		await assertMatch(result, {
			name: 'Overlap Decomposition (fragments)',
		});
	});

	await t.step('Cross Formation (LWW decomposition)', async () => {
		const { factory, steps } = scenarios.progressions.crossFormation();
		const legend = toHTMLLegend({ 'H': 'H', 'V': 'V' } as const);

		const result = renderProgression(
			factory,
			steps.map(({ name, action }) => ({ params: { name }, action })),
			{ legend, strict: true },
		);

		await assertMatch(result, {
			name: 'Cross Formation (LWW decomposition)',
		});
	});

	await t.step('Data Density Variations', async () => {
		const { singleCell, sparse, dense } = scenarios.dataDensity();
		const legend = toHTMLLegend(
			{
				'X': 'X',
				'A': 'A',
				'B': 'B',
				'C': 'C',
				'D': 'D',
			} as const,
		);

		const result = renderLayout(
			[
				{ params: { name: 'Single Cell' }, source: singleCell },
				{ params: { name: 'Sparse' }, source: sparse },
				{ params: { name: 'Dense 4×4' }, source: dense },
			],
			{ legend, strict: true },
		);

		await assertMatch(result, { name: 'Data Density Variations' });
	});

	//#endregion

	//#region SECTION 2: PRACTICAL FEATURES - How to use it

	await t.step('Partitioned Index - Multiple attributes', async () => {
		type CellData = { bg: string; fg: string };
		const { factory, steps } = scenarios.progressions.partitionedMultiple<
			CellData
		>();
		const legend = toHTMLLegend({
			'B': { bg: 'BACK' },
			'F': { fg: 'FORE' },
			'X': { bg: 'BACK', fg: 'FORE' },
			'D': { bg: 'DARK', fg: 'FORE' },
		});

		const result = renderProgression(
			factory,
			steps.map(({ name, action }) => ({ params: { name }, action })),
			{ legend, strict: true },
		);

		await assertMatch(result, {
			name: 'Partitioned Index - Multiple attributes',
		});
	});

	await t.step('Partitioned Index - Attribute override', async () => {
		type CellData = { color: string };
		const { factory, steps } = scenarios.progressions.partitionedOverride<
			CellData
		>();
		const legend = toHTMLLegend({
			'R': { color: 'RED' },
			'B': { color: 'BLUE' },
		});

		const result = renderProgression(
			factory,
			steps.map(({ name, action }) => ({ params: { name }, action })),
			{ legend, strict: true },
		);

		await assertMatch(result, {
			name: 'Partitioned Index - Attribute override',
		});
	});

	await t.step('Global Override Evolution', async () => {
		const { factory, steps } = scenarios.progressions.globalOverride();
		const legend = toHTMLLegend({
			'G': 'GLOBAL',
			'+': 'LOCAL+',
			'-': 'LOCAL-',
		});

		const result = renderProgression(
			factory,
			steps.map(({ name, action }) => ({ params: { name }, action })),
			{ legend, strict: true },
		);

		await assertMatch(result, { name: 'Global Override Evolution' });
	});

	//#endregion

	//#region SECTION 3: COORDINATE CAPABILITIES - What it can handle

	await t.step('Origin Inclusion Modes', async () => {
		const { index1, index2, index3 } = scenarios.originInclusion();
		const legend = toHTMLLegend({ D: 'DATA' } as const);

		const noOrigin = renderLayout(
			[
				{ params: { name: 'No Origin 1' }, source: index1 },
				{ params: { name: 'No Origin 2' }, source: index2 },
				{ params: { name: 'No Origin 3' }, source: index3 },
			],
			{ legend, strict: true, includeOrigin: false },
		);

		const withOrigin = renderLayout(
			[
				{ params: { name: 'Origin Included 1' }, source: index1 },
				{ params: { name: 'Origin Included 2' }, source: index2 },
				{ params: { name: 'Origin Included 3' }, source: index3 },
			],
			{ legend, strict: true, includeOrigin: true },
		);

		await assertMatch(noOrigin, { name: 'Origin Excluded' });
		await assertMatch(withOrigin, { name: 'Origin Included' });
	});

	await t.step('Infinity Edges (all directions)', async () => {
		const { top, right, bottom, left } = scenarios.infinityEdges();
		const legend = toHTMLLegend(
			{
				'T': 'TOP',
				'R': 'RIGHT',
				'B': 'BOTTOM',
				'L': 'LEFT',
			} as const,
		);

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
	});

	await t.step('Infinity Corners', async () => {
		const { topLeft, topRight, bottomLeft, bottomRight } = scenarios
			.infinityCorners();
		const legend = toHTMLLegend(
			{
				'1': 'TOP-LEFT',
				'2': 'TOP-RIGHT',
				'3': 'BOTTOM-LEFT',
				'4': 'BOTTOM-RIGHT',
			} as const,
		);

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
	});

	await t.step('Infinity Bands (3 edges)', async () => {
		const { horizontal, vertical } = scenarios.infinityBands();
		const legend = toHTMLLegend({ 'H': 'HBAND', 'V': 'VBAND' } as const);

		const result = renderLayout(
			[
				{ params: { name: 'Horizontal Band' }, source: horizontal },
				{ params: { name: 'Vertical Band' }, source: vertical },
			],
			{ legend, strict: true },
		);

		await assertMatch(result, { name: 'Infinity Bands (3 edges)' });
	});

	//#endregion

	//#region SECTION 4: EDGE CASES - Completeness

	await t.step('Empty Index', async () => {
		const { factory, steps } = scenarios.progressions.empty();
		const result = renderProgression(
			factory,
			steps.map(({ name, action }) => ({ params: { name }, action })),
			{ legend: {}, strict: true },
		);

		await assertMatch(result, { name: 'Empty Index' });
	});

	await t.step('All Infinity (no finite data)', async () => {
		const { viewport, absolute } = scenarios.allInfinity();
		const legend = toHTMLLegend({ '∞': 'EVERYWHERE' } as const);

		const result = renderLayout(
			[
				{
					source: viewport,
					params: { name: 'Origin Excluded', includeOrigin: false },
				},
				{
					source: absolute,
					params: { name: 'Origin Included', includeOrigin: true },
				},
			],
			{ legend, strict: true },
		);

		await assertMatch(result, { name: 'All Infinity (no finite data)' });
	});

	//#endregion

	//#region SECTION 5: META FEATURES - Renderer capabilities

	await t.step('Two-state progression', async () => {
		const { factory, steps } = scenarios.progressions.twoState();
		const legend = toHTMLLegend({ 'H': 'HORIZONTAL', 'V': 'VERTICAL' } as const);

		const result = renderProgression(
			factory,
			steps.map(({ name, action }) => ({ params: { name }, action })),
			{ legend, strict: true },
		);

		await assertMatch(result, { name: 'Two-state progression' });
	});

	await t.step('Three-state progression with empty state', async () => {
		const { factory, steps } = scenarios.progressions.threeState();
		const legend = toHTMLLegend({ 'H': 'HORIZONTAL', 'V': 'VERTICAL' } as const);

		const result = renderProgression(
			factory,
			steps.map(({ name, action }) => ({ params: { name }, action })),
			{ legend, strict: true },
		);

		await assertMatch(result, {
			name: 'Three-state progression with empty state',
		});
	});

	await t.step('Custom spacing between grids', async () => {
		const { factory, steps } = scenarios.progressions.customSpacing();
		const legend = toHTMLLegend({ 'X': 'X', 'Y': 'Y' } as const);

		const result = renderProgression(
			factory,
			steps.map(({ name, action }) => ({ params: { name }, action })),
			{ legend, spacing: 5, strict: true },
		);

		await assertMatch(result, { name: 'Custom spacing between grids' });
	});

	await t.step('Independent states (non-cumulative)', async () => {
		const { index1, index2 } = scenarios.independentStates();
		const legend = toHTMLLegend({ 'R': 'RED', 'B': 'BLUE' } as const);

		const result = renderLayout(
			[
				{ params: { name: 'Index A' }, source: index1 },
				{ params: { name: 'Index B' }, source: index2 },
			],
			{ legend, spacing: 5, strict: true },
		);

		await assertMatch(result, {
			name: 'Independent states (non-cumulative)',
		});
	});

	//#endregion

	await flush();
});

//#endregion
