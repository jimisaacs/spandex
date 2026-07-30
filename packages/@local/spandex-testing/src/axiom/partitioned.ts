/**
 * Partitioned Index Axioms
 *
 * A partitioned index stores one spatial index per attribute and joins them on
 * query, so its results are grid cells cut at partition boundaries rather than
 * the rectangles that were inserted. Cell counts therefore differ from a plain
 * index over the same operations, and the canonical fragment counts do not
 * apply here.
 *
 * What does carry over is every invariant about the view a caller sees: cells
 * must be well-formed and disjoint, they must not repeat, and each must report
 * the attributes actually covering it. Those are checked below.
 */

import type { PartitionedSpatialIndex, Rectangle, SpatialIndex } from '@jim/spandex';
import * as r from '@jim/spandex/r';
import { assert, assertEquals, assertFalse } from '@std/assert';

type Props = { background?: string; fontColor?: string; fontSize?: number };

/** Factory for a partitioned index over `Props`, given a partition factory. */
export type PartitionedFactory = (
	indexFactory: <V>() => SpatialIndex<V>,
) => PartitionedSpatialIndex<Props>;

/**
 * Assert the joined view is well-formed: no inverted cells, no duplicated
 * cells, and no two cells overlapping.
 *
 * A joined view that overlaps itself would report two different attribute sets
 * for the same coordinate, so this is the partitioned analogue of the
 * disjointness invariant on a plain index.
 */
export const assertJoinInvariants = (
	index: PartitionedSpatialIndex<Props>,
	context: string,
): void => {
	const cells = Array.from(index.query());

	for (const [bounds] of cells) {
		const [xmin, ymin, xmax, ymax] = bounds;
		assertFalse(
			xmin > xmax || ymin > ymax,
			`${context}: inverted cell [${xmin}, ${ymin}, ${xmax}, ${ymax}]`,
		);
	}

	const seen = cells.map(([b]) => b.join(','));
	assertEquals(seen.length, new Set(seen).size, `${context}: duplicate cells in the joined view`);

	for (let i = 0; i < cells.length; i++) {
		for (let j = i + 1; j < cells.length; j++) {
			const [ax1, ay1, ax2, ay2] = cells[i]![0];
			const [bx1, by1, bx2, by2] = cells[j]![0];
			const overlaps = ax1 <= bx2 && bx1 <= ax2 && ay1 <= by2 && by1 <= ay2;
			assertFalse(
				overlaps,
				`${context}: overlapping cells [${ax1},${ay1},${ax2},${ay2}] and [${bx1},${by1},${bx2},${by2}]`,
			);
		}
	}
};

/** Axioms every partitioned index implementation must satisfy. */
export async function testPartitionedAxioms(
	t: Deno.TestContext,
	create: PartitionedFactory,
	partitionFactory: <V>() => SpatialIndex<V>,
): Promise<void> {
	const make = () => create(partitionFactory);

	await t.step('Empty state', () => {
		const index = make();
		assertEquals(Array.from(index.query()).length, 0, 'empty index yields no cells');
		assertEquals(index.extent().empty, true, 'empty index reports an empty extent');
	});

	await t.step('Joined view stays disjoint', () => {
		const index = make();

		index.set([0, 0, 9, 9], 'background', 'red');
		assertJoinInvariants(index, 'one partition');

		index.set([5, 5, 14, 14], 'fontColor', 'blue');
		assertJoinInvariants(index, 'two overlapping partitions');

		index.set([2, 2, 7, 7], 'background', 'green');
		assertJoinInvariants(index, 'overwrite within a partition');

		index.set([20, 20, 24, 24], 'fontSize', 12);
		assertJoinInvariants(index, 'disjoint third partition');
	});

	await t.step('Last writer wins within a partition', () => {
		const index = make();

		index.set([0, 0, 9, 9], 'background', 'red');
		index.set([0, 0, 9, 9], 'background', 'green');
		assertJoinInvariants(index, 'after overwrite');

		for (const [, attrs] of index.query()) {
			assertEquals(attrs.background, 'green', 'the later write must win');
		}
	});

	await t.step('Partitions are independent', () => {
		const index = make();

		index.set([0, 0, 9, 9], 'background', 'red');
		index.set([0, 0, 9, 9], 'fontColor', 'blue');
		index.set([0, 0, 9, 9], 'background', 'green');

		for (const [, attrs] of index.query()) {
			assertEquals(attrs.background, 'green', 'overwriting one attribute must not disturb another');
			assertEquals(attrs.fontColor, 'blue', 'the untouched attribute must survive');
		}
	});

	await t.step('Query window bounds the results', () => {
		const index = make();
		index.set([0, 0, 9, 9], 'background', 'red');
		index.set([20, 20, 29, 29], 'fontColor', 'blue');

		const window: Readonly<Rectangle> = [0, 0, 4, 4];
		const cells = Array.from(index.query(window));
		assert(cells.length > 0, 'the window covers data and should return cells');
		for (const [bounds] of cells) {
			const [x1, y1, x2, y2] = bounds;
			const intersects = x1 <= window[2] && window[0] <= x2 && y1 <= window[3] && window[1] <= y2;
			assert(intersects, `cell [${bounds}] lies outside the query window`);
		}
	});

	await t.step('Clear resets every observable', () => {
		const index = make();
		index.set([0, 0, 9, 9], 'background', 'red');

		const clearable = index as PartitionedSpatialIndex<Props> & { clear?: () => void };
		if (!clearable.clear) return;

		clearable.clear();
		assertEquals(Array.from(index.query()).length, 0, 'no cells after clear');
		assertEquals(index.extent().empty, true, 'extent must report empty after clear');
	});

	await t.step('Non-integer coordinates are rejected', () => {
		const index = make();
		let threw = false;
		try {
			index.set([0, 0.5, 9, 9], 'background', 'red');
		} catch {
			threw = true;
		}
		assert(threw, 'fractional coordinates should be rejected at the boundary');
	});

	await t.step('A rejected write leaves no partition behind', () => {
		// Validating after creating the partition left the attribute registered
		// even though nothing was stored under it, so the index reported an
		// attribute as written to while also reporting itself empty. Two
		// observables that cannot both be right.
		const index = make();
		try {
			index.set([5, 0, 0, 0], 'background', 'red');
		} catch {
			// The rejection is the point; what matters is the state it leaves.
		}
		assertEquals(Array.from(index.query()).length, 0, 'a rejected write must store nothing');
		assertEquals(index.extent().empty, true, 'a rejected write must leave the index empty');

		const listable = index as PartitionedSpatialIndex<Props> & { keys?(): Iterable<keyof Props> };
		if (listable.keys) {
			assertEquals(
				Array.from(listable.keys()),
				[],
				'a rejected write must not register the attribute it tried to write',
			);
		}
	});

	await t.step('A query iterator does not survive a mutation', () => {
		// The joined view is built from a snapshot of every partition, so an
		// iterator held across a write would keep answering from a store the
		// index no longer has. That reads as fresh, which is worse than failing.
		const index = make();
		for (let i = 0; i < 8; i++) index.set([i * 4, 0, i * 4 + 2, 2], 'background', `c${i}`);

		const iterator = index.query();
		assertFalse(iterator.next().done, 'the iterator should yield a cell before the mutation');

		index.set([0, 8, 40, 10], 'fontColor', 'blue');

		let refused = false;
		try {
			iterator.next();
		} catch {
			refused = true;
		}
		assert(refused, 'continuing a joined query iterator after a write must throw');
	});

	await t.step('Infinite ranges join cleanly', () => {
		const index = make();
		index.set([1, 1, 3, 3], 'background', 'red');
		index.set([0, 0, r.posInf, r.posInf], 'fontColor', 'blue');
		assertJoinInvariants(index, 'finite and infinite partitions joined');
	});
}
