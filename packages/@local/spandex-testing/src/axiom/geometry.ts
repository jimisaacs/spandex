/**
 * Geometric Correctness Axioms (ASCII-Based)
 *
 * Tests geometric correctness using ASCII visualization. Each test has a visual fixture
 * that documents expected behavior, making these tests both verification and documentation.
 */

import type { SpatialIndex } from '@jim/spandex';
import { render } from '@jim/spandex-ascii';
import { asciiStringCodec, createFixtureGroup } from '@local/snapmark';

export async function testGeometryAxioms(
	t: Deno.TestContext,
	filePath: string | URL,
	implementation: () => SpatialIndex<string>,
): Promise<void> {
	const { assertMatch, flush } = createFixtureGroup(asciiStringCodec(), {
		header: '# Implementation Geometry Axioms\n\nAutomatically generated fixture file.',
		context: t,
		filePath,
	});

	//#region Single Cell & Basic Shapes

	await t.step('Single cell', () => {
		const index = implementation();
		index.insert([1, 1, 3, 2], 'TEST');

		const actual = render(() => index.query(), { T: 'TEST' });

		assertMatch(actual, { name: 'Single Rectangle' });
	});

	await t.step('Empty index', () => {
		const index = implementation();

		const actual = render(() => index.query(), {});

		assertMatch(actual, { name: 'Empty Index' });
	});
	//#endregion Single Cell & Basic Shapes

	//#region Adjacency (Non-Overlapping)

	await t.step('Adjacent horizontal', () => {
		const index = implementation();
		index.insert([0, 0, 4, 9], 'left');
		index.insert([5, 0, 9, 9], 'right');

		const actual = render(() => index.query(), { l: 'left', r: 'right' });

		assertMatch(actual, { name: 'Adjacent Horizontal Ranges' });
	});

	await t.step('Adjacent vertical', () => {
		const index = implementation();
		index.insert([0, 0, 9, 4], 'top');
		index.insert([0, 5, 9, 9], 'bottom');

		const actual = render(() => index.query(), { t: 'top', b: 'bottom' });

		assertMatch(actual, { name: 'Adjacent Vertical Ranges' });
	});

	await t.step('Adjacent corners', () => {
		const index = implementation();
		index.insert([0, 0, 4, 4], 'A');
		index.insert([5, 0, 9, 4], 'B');
		index.insert([0, 5, 4, 9], 'C');
		index.insert([5, 5, 9, 9], 'D');

		const actual = render(() => index.query(), { A: 'A', B: 'B', C: 'C', D: 'D' });

		assertMatch(actual, { name: 'Adjacent Corner Ranges' });
	});

	await t.step('Non-overlapping grid', () => {
		const index = implementation();
		index.insert([0, 0, 1, 1], 'A');
		index.insert([2, 0, 3, 1], 'B');
		index.insert([0, 2, 1, 3], 'C');
		index.insert([2, 2, 3, 3], 'D');

		const actual = render(() => index.query(), { A: 'A', B: 'B', C: 'C', D: 'D' });

		assertMatch(actual, { name: 'Adjacent Non-Overlapping' });
	});
	//#endregion Adjacency (Non-Overlapping)

	//#region Overlap Patterns

	await t.step('Full overlap (center punch)', () => {
		const index = implementation();
		index.insert([1, 1, 4, 4], 'first');
		index.insert([2, 2, 3, 3], 'second');

		const actual = render(() => index.query(), { f: 'first', s: 'second' });

		assertMatch(actual, { name: 'Overlap Resolution' });
	});

	await t.step('Last writer wins', () => {
		const index = implementation();
		index.insert([1, 1, 2, 2], 'first');
		index.insert([2, 2, 3, 3], 'second');

		const actual = render(() => index.query(), { f: 'first', s: 'second' });

		assertMatch(actual, { name: 'Last Writer Wins' });
	});

	await t.step('4-way split', () => {
		const index = implementation();
		index.insert([0, 0, 9, 9], 'base');
		index.insert([3, 3, 6, 6], 'center');

		const actual = render(() => index.query(), { b: 'base', c: 'center' });

		assertMatch(actual, { name: 'Fragment Generation (4-split)' });
	});

	await t.step('L-shaped overlap', () => {
		const index = implementation();
		index.insert([0, 0, 9, 9], 'base');
		index.insert([5, 5, 14, 14], 'overlap');

		const actual = render(() => index.query(), { b: 'base', o: 'overlap' });

		assertMatch(actual, { name: 'L-Shaped Overlap' });
	});

	await t.step('Non-overlapping preservation', () => {
		const index = implementation();
		index.insert([1, 1, 2, 2], 'first');
		index.insert([5, 5, 6, 6], 'second');

		const actual = render(() => index.query(), { f: 'first', s: 'second' });

		assertMatch(actual, { name: 'Non-Overlapping Preservation' });
	});
	//#endregion Overlap Patterns

	//#region Special Coordinates

	await t.step('Point, strips, and origin', () => {
		const index = implementation();
		index.insert([5, 5, 5, 5], 'point');
		index.insert([0, 10, 12, 10], 'horizontal');
		index.insert([6, 0, 6, 12], 'vertical');
		index.insert([0, 0, 4, 4], 'origin');

		const actual = render(() => index.query(), { p: 'point', h: 'horizontal', v: 'vertical', o: 'origin' });

		assertMatch(actual, { name: 'Boundary Conditions' });
	});

	await t.step('Global range override', () => {
		const index = implementation();
		index.insert([1, 1, 1, 1], 'cell');
		index.insert([2, 1, 2, 1], 'adjacent');

		index.insert([
			Number.NEGATIVE_INFINITY,
			Number.NEGATIVE_INFINITY,
			Number.POSITIVE_INFINITY,
			Number.POSITIVE_INFINITY,
		], 'global');

		const actual = render(() => index.query(), { c: 'cell', a: 'adjacent', g: 'global' });

		assertMatch(actual, { name: 'Global Range Override' });
	});

	await t.step('Infinite ranges', () => {
		const index = implementation();
		index.insert([4, 0, 6, Infinity], 'vertical');
		index.insert([0, 5, Infinity, 7], 'horizontal');

		const actual = render(() => index.query(), { v: 'vertical', h: 'horizontal' });

		assertMatch(actual, { name: 'Infinite Ranges' });
	});
	//#endregion Special Coordinates

	//#region Viewport

	await t.step('Viewport offset', () => {
		const index = implementation();
		index.insert([5, 5, 7, 7], 'DATA');

		const actual = render(() => index.query(), { D: 'DATA' });

		assertMatch(actual, { name: 'Viewport Offset' });
	});

	await t.step('Query boundary precision', () => {
		const index = implementation();
		index.insert([5, 5, 8, 8], 'test');

		const actual = render(() => index.query(), { t: 'test' });

		assertMatch(actual, { name: 'Query Boundary Precision' });
	});
	//#endregion Viewport

	await flush();
}
