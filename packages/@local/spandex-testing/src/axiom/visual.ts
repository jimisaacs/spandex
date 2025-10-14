/**
 * Visual Showcase Axioms
 *
 * Tests that demonstrate spatial index behavior through ASCII art.
 * These are primarily for documentation and visual understanding.
 */

import { SpatialIndex } from '@jim/spandex';
import { render } from '@jim/spandex-ascii';
import { asciiStringCodec, createFixtureGroup } from '@local/snapmark';

export async function testVisualAxioms(
	t: Deno.TestContext,
	filePath: string | URL,
	implementation: () => SpatialIndex<string>,
): Promise<void> {
	const { assertMatch, flush } = createFixtureGroup(asciiStringCodec(), {
		header: '# Implementation Visual Axioms\n\nAutomatically generated fixture file.',
		context: t,
		filePath,
	});

	await t.step('LWW example (from docs)', () => {
		const index = implementation();

		// Step 1: Color A1:C2 Red
		index.insert([0, 1, 2, 2], 'RED');

		// Step 2: Color B0:D2 Blue (overlaps with red)
		index.insert([1, 0, 3, 2], 'BLUE');

		const actual = render(() => index.query(), { R: 'RED', B: 'BLUE' });

		assertMatch(actual, { name: 'LWW Example' });
	});

	await t.step('Single rectangle', () => {
		const index = implementation();
		index.insert([1, 1, 3, 2], 'TEST');

		const actual = render(() => index.query(), { T: 'TEST' });

		assertMatch(actual, { name: 'Single Rectangle' });
	});

	await t.step('Vertical stripes', () => {
		const index = implementation();

		index.insert([0, 0, 0, 3], 'A');
		index.insert([2, 0, 2, 3], 'B');
		index.insert([4, 0, 4, 3], 'C');

		const actual = render(() => index.query(), { A: 'A', B: 'B', C: 'C' });

		assertMatch(actual, { name: 'Horizontal Stripes' });
	});

	await t.step('Complex fragmentation', () => {
		const index = implementation();

		index.insert([0, 0, 4, 4], 'BASE');
		index.insert([2, 2, 2, 2], 'CENTER');
		index.insert([3, 3, 4, 4], 'CORNER');

		const actual = render(() => index.query(), { B: 'BASE', C: 'CENTER', O: 'CORNER' });

		assertMatch(actual, { name: 'Complex Fragmentation (numeric values)' });
	});

	await t.step('Diagonal pattern', () => {
		const index = implementation();

		index.insert([0, 0, 0, 0], 'one');
		index.insert([1, 1, 1, 1], 'two');
		index.insert([2, 2, 2, 2], 'three');
		index.insert([3, 3, 3, 3], 'four');
		index.insert([4, 4, 4, 4], 'five');

		const actual = render(() => index.query(), { '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five' });

		assertMatch(actual, { name: 'Diagonal Pattern (numeric values)' });
	});

	await t.step('Progressive overlap', () => {
		const index = implementation();

		index.insert([0, 0, 3, 2], 'first');
		index.insert([2, 1, 4, 3], 'second');
		index.insert([1, 2, 3, 4], 'third');

		const actual = render(() => index.query(), { f: 'first', s: 'second', t: 'third' });

		assertMatch(actual, { name: 'Progressive Overlap (numeric values)' });
	});

	await flush();
}
