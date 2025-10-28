/**
 * Geometric Correctness Axioms (ASCII-Based)
 *
 * Tests geometric correctness using ASCII visualization. Each test has a visual fixture
 * that documents expected behavior, making these tests both verification and documentation.
 * Includes round-trip validation (render → parse → render).
 */

import type { SpatialIndex } from '@jim/spandex';
import { createRenderer } from '@jim/spandex-ascii';
import * as r from '@jim/spandex/r';
import { asciiStringCodec, createFixtureGroup } from '@local/snapmark';
import { validateRoundTrip } from '../round-trip.ts';

export async function testGeometryAxioms(
	t: Deno.TestContext,
	filePath: string | URL,
	implementation: () => SpatialIndex<string>,
): Promise<void> {
	const { render } = createRenderer();
	const { assertMatch, flush } = createFixtureGroup(asciiStringCodec(), {
		header: '# Implementation Geometry Axioms\n\nAutomatically generated fixture file.',
		context: t,
		filePath,
	});

	//#region Single Cell & Basic Shapes

	await t.step('Single cell', () => {
		const index = implementation();
		index.insert([1, 1, 3, 2], 'TEST');

		const legend = { T: 'TEST' };
		const actual = render(index, { legend });

		assertMatch(actual, { name: 'Single Rectangle' });
		validateRoundTrip(actual, 1, { legend });
	});

	await t.step('Empty index', () => {
		const index = implementation();

		const actual = render(index, { legend: {} });

		assertMatch(actual, { name: 'Empty Index' });
	});
	//#endregion Single Cell & Basic Shapes

	//#region Adjacency (Non-Overlapping)

	await t.step('Adjacent horizontal', () => {
		const index = implementation();
		index.insert([0, 0, 4, 9], 'left');
		index.insert([5, 0, 9, 9], 'right');

		const legend = { l: 'left', r: 'right' };
		const actual = render(index, { legend });

		assertMatch(actual, { name: 'Adjacent Horizontal Ranges' });
		validateRoundTrip(actual, 1, { legend });
	});

	await t.step('Adjacent vertical', () => {
		const index = implementation();
		index.insert([0, 0, 9, 4], 'top');
		index.insert([0, 5, 9, 9], 'bottom');

		const legend = { t: 'top', b: 'bottom' };
		const actual = render(index, { legend });

		assertMatch(actual, { name: 'Adjacent Vertical Ranges' });
		validateRoundTrip(actual, 1, { legend });
	});

	await t.step('Adjacent corners', () => {
		const index = implementation();
		index.insert([0, 0, 4, 4], 'A');
		index.insert([5, 0, 9, 4], 'B');
		index.insert([0, 5, 4, 9], 'C');
		index.insert([5, 5, 9, 9], 'D');

		const legend = { A: 'A', B: 'B', C: 'C', D: 'D' };
		const actual = render(index, { legend });

		assertMatch(actual, { name: 'Adjacent Corner Ranges' });
		validateRoundTrip(actual, 1, { legend });
	});

	await t.step('Non-overlapping grid', () => {
		const index = implementation();
		index.insert([0, 0, 1, 1], 'A');
		index.insert([2, 0, 3, 1], 'B');
		index.insert([0, 2, 1, 3], 'C');
		index.insert([2, 2, 3, 3], 'D');

		const legend = { A: 'A', B: 'B', C: 'C', D: 'D' };
		const actual = render(index, { legend });

		assertMatch(actual, { name: 'Adjacent Non-Overlapping' });
		validateRoundTrip(actual, 1, { legend });
	});
	//#endregion Adjacency (Non-Overlapping)

	//#region Overlap Patterns

	await t.step('Full overlap (center punch)', () => {
		const index = implementation();
		index.insert([1, 1, 4, 4], 'first');
		index.insert([2, 2, 3, 3], 'second');

		const legend = { f: 'first', s: 'second' };
		const actual = render(index, { legend });

		assertMatch(actual, { name: 'Overlap Resolution' });
		validateRoundTrip(actual, 1, { legend });
	});

	await t.step('Last writer wins', () => {
		const index = implementation();
		index.insert([1, 1, 2, 2], 'first');
		index.insert([2, 2, 3, 3], 'second');

		const legend = { f: 'first', s: 'second' };
		const actual = render(index, { legend });

		assertMatch(actual, { name: 'Last Writer Wins' });
		validateRoundTrip(actual, 1, { legend });
	});

	await t.step('4-way split', () => {
		const index = implementation();
		index.insert([0, 0, 9, 9], 'base');
		index.insert([3, 3, 6, 6], 'center');

		const legend = { b: 'base', c: 'center' };
		const actual = render(index, { legend });

		assertMatch(actual, { name: 'Fragment Generation (4-split)' });
		validateRoundTrip(actual, 1, { legend });
	});

	await t.step('L-shaped overlap', () => {
		const index = implementation();
		index.insert([0, 0, 9, 9], 'base');
		index.insert([5, 5, 14, 14], 'overlap');

		const legend = { b: 'base', o: 'overlap' };
		const actual = render(index, { legend });

		assertMatch(actual, { name: 'L-Shaped Overlap' });
		validateRoundTrip(actual, 1, { legend });
	});

	await t.step('Non-overlapping preservation', () => {
		const index = implementation();
		index.insert([1, 1, 2, 2], 'first');
		index.insert([5, 5, 6, 6], 'second');

		const legend = { f: 'first', s: 'second' };
		const actual = render(index, { legend });

		assertMatch(actual, { name: 'Non-Overlapping Preservation' });
		validateRoundTrip(actual, 1, { legend });
	});
	//#endregion Overlap Patterns

	//#region Special Coordinates

	await t.step('Point, strips, and origin', () => {
		const index = implementation();
		index.insert([5, 5, 5, 5], 'point');
		index.insert([0, 10, 12, 10], 'horizontal');
		index.insert([6, 0, 6, 12], 'vertical');
		index.insert([0, 0, 4, 4], 'origin');

		const actual = render(index, {
			legend: { p: 'point', h: 'horizontal', v: 'vertical', o: 'origin' },
		});

		assertMatch(actual, { name: 'Boundary Conditions' });
	});

	await t.step('Global range override', () => {
		const index = implementation();
		index.insert([1, 1, 1, 1], 'cell');
		index.insert([2, 1, 2, 1], 'adjacent');

		index.insert(r.ALL, 'global');

		const legend = { g: 'global' };
		const actual = render(index, { legend });

		assertMatch(actual, { name: 'Global Range Override' });
		// Skip round-trip: render() vs renderLayout() differ on infinity edge annotations
	});

	await t.step('Infinite ranges', () => {
		const index = implementation();
		index.insert([4, 0, 6, r.posInf], 'vertical');
		index.insert([0, 5, r.posInf, 7], 'horizontal');

		const legend = { v: 'vertical', h: 'horizontal' };
		const actual = render(index, { legend });

		assertMatch(actual, { name: 'Infinite Ranges' });
		// Skip round-trip: render() vs renderLayout() differ on infinity edge annotations
	});
	//#endregion Special Coordinates

	//#region Viewport

	await t.step('Viewport offset', () => {
		const index = implementation();
		index.insert([5, 5, 7, 7], 'DATA');

		const legend = { D: 'DATA' };
		const actual = render(index, { legend });

		assertMatch(actual, { name: 'Viewport Offset' });
		validateRoundTrip(actual, 1, { legend });
	});

	await t.step('Query boundary precision', () => {
		const index = implementation();
		index.insert([5, 5, 8, 8], 'test');

		const legend = { t: 'test' };
		const actual = render(index, { legend });

		assertMatch(actual, { name: 'Query Boundary Precision' });
		validateRoundTrip(actual, 1, { legend });
	});
	//#endregion Viewport

	await flush();
}
