/**
 * Structural invariants of the R*-tree: balanced, within its fill factor, tight
 * bounding boxes, every rectangle reachable exactly once.
 *
 * The axiom suite already proves the tree stores the right rectangles. These
 * prove it stores them in something that is actually an R-tree. Forced
 * reinsertion is what breaks that: it pulls a subtree out and puts it back from
 * the root, corrupting depth if a payload re-enters at the wrong level, losing
 * rectangles if a removed child is dropped, and leaving stale boxes if an
 * ancestor is not retightened. None of it shows up in a query result until the
 * tree is big enough for pruning to skip the damaged subtree.
 *
 * Validated by breaking the implementation on purpose, one defect at a time.
 *
 * Caught: reinsertion skipping the box retighten; a payload re-entering at level
 * 0 instead of its own; a removed child dropped; a split ignoring the fill
 * factor; tombstones leaking into the leaf scan; the descent ignoring the
 * payload; the descent falling back to area enlargement alone; every geometric
 * measure saturating at infinity.
 *
 * Measured and *not* caught: neutralising the unbounded-axis half of the measure.
 * That costs about 28% on mixed finite and unbounded data, and nothing observable
 * through the public API moves. The last step in this file says so.
 */

import type { Rectangle } from '@jim/spandex';
import createRStarTreeIndex, { type RStarTreeIndex } from '@jim/spandex/index/rstartree';
import * as r from '@jim/spandex/r';
import { assertInvariants } from '@local/spandex-testing/axiom';
import { seededRandom } from '@local/spandex-testing/utils';
import { assertEquals, assertGreater, assertLess, assertLessOrEqual, assertNotEquals } from '@std/assert';

/**
 * Every violation the tree reports, plus the two library-wide invariants.
 *
 * `structuralViolations` inspects the shape of the tree, not the geometry in it,
 * so without `assertInvariants` these sequences would pass while storing
 * overlapping rectangles.
 */
function assertWellFormed<T extends string>(index: RStarTreeIndex<T>, context: string): void {
	const problems = index.structuralViolations();
	assertEquals(problems, [], `${context}: ${problems.join('; ')}`);
	assertInvariants(index, context);
}

Deno.test('RStarTreeImpl - Structural invariants', async (t) => {
	await t.step('Empty tree is well formed', () => {
		assertWellFormed(createRStarTreeIndex<string>(), 'empty');
	});

	await t.step('Sparse inserts stay well formed at every step', () => {
		const index = createRStarTreeIndex<string>();
		const random = seededRandom(1234);

		// Enough inserts to grow several levels, checked after each one so a
		// violation names the insert that introduced it.
		for (let i = 0; i < 400; i++) {
			const x = Math.floor(random() * 5000);
			const y = Math.floor(random() * 5000);
			index.insert(r.make(x, y, x + 3, y + 3), `s_${i}`);
			assertWellFormed(index, `after sparse insert ${i}`);
		}

		assertGreater(index.getTreeQualityMetrics().depth, 2, 'the tree should have grown past a single split');
	});

	await t.step('Overlapping inserts stay well formed through decomposition', () => {
		const index = createRStarTreeIndex<string>();

		// Every insert here overlaps stored rectangles, so each one tombstones
		// entries and places fragments. That drives the tombstone rebuild as
		// well as the ordinary insert path.
		for (let i = 0; i < 300; i++) {
			const x = i % 12;
			const y = Math.floor(i / 6);
			index.insert(r.make(x, y, x + 4, y + 4), `o_${i}`);
			assertWellFormed(index, `after overlapping insert ${i}`);
		}
	});

	await t.step('Unbounded rectangles stay well formed', () => {
		const index = createRStarTreeIndex<string>();

		// Rows and columns that run to infinity are ordinary input here: an
		// empty Google Sheets GridRange is spelled that way. The split
		// heuristics measure infinity, so this is the path where a comparison
		// against NaN would silently pick the wrong grouping.
		for (let i = 0; i < 60; i++) {
			index.insert([i * 10, 0, i * 10 + 5, r.posInf], `col_${i}`);
			assertWellFormed(index, `after unbounded column ${i}`);
		}
		for (let i = 0; i < 60; i++) {
			index.insert([r.negInf, i * 10, 400, i * 10 + 2], `row_${i}`);
			assertWellFormed(index, `after unbounded row ${i}`);
		}
	});

	await t.step('The universal rectangle resets to a well-formed tree', () => {
		const index = createRStarTreeIndex<string>();
		for (let i = 0; i < 50; i++) index.insert(r.make(i, i, i + 2, i + 2), `pre_${i}`);

		index.insert(r.ALL, 'universe');
		assertWellFormed(index, 'after the universal rectangle');
		assertEquals(index.size(), 1, 'the universal rectangle covers everything stored before it');

		index.insert(r.make(5, 5, 9, 9), 'sub');
		assertWellFormed(index, 'after overlapping the universal rectangle');
	});

	await t.step('Every leaf sits at the same depth', () => {
		const index = createRStarTreeIndex<string>();
		const random = seededRandom(99);

		// A skewed distribution is what unbalances a tree whose reinsertion
		// puts a payload back at the wrong level: most inserts land in one
		// corner and a few far away.
		for (let i = 0; i < 600; i++) {
			const far = i % 25 === 0;
			const x = far ? 90000 + Math.floor(random() * 1000) : Math.floor(random() * 200);
			const y = far ? 90000 + Math.floor(random() * 1000) : Math.floor(random() * 200);
			index.insert(r.make(x, y, x + 1, y + 1), `k_${i}`);
		}

		assertWellFormed(index, 'skewed distribution');
	});
});

Deno.test('RStarTreeImpl - Tree quality', async (t) => {
	await t.step('Depth stays logarithmic in the stored rectangles', () => {
		const index = createRStarTreeIndex<string>();
		const random = seededRandom(2024);
		for (let i = 0; i < 5000; i++) {
			const x = Math.floor(random() * 50000);
			const y = Math.floor(random() * 50000);
			index.insert(r.make(x, y, x + 2, y + 2), `q_${i}`);
		}

		const { depth } = index.getTreeQualityMetrics();
		const n = index.size();

		// A tree with a 40% minimum fill factor is at most log(n) base
		// MIN_ENTRIES deep. Allowing one extra level absorbs the root, which is
		// exempt from the minimum.
		const ceiling = Math.ceil(Math.log(n) / Math.log(4)) + 1;
		assertLessOrEqual(depth, ceiling, `depth ${depth} exceeds the ${ceiling}-level ceiling at n=${n}`);
		assertWellFormed(index, 'after 5000 sparse inserts');
	});

	await t.step('Sibling overlap stays small on clustered data', () => {
		const index = createRStarTreeIndex<string>();
		const random = seededRandom(7);
		for (let i = 0; i < 1000; i++) {
			const cx = Math.floor(random() * 10) * 500;
			const cy = Math.floor(random() * 10) * 500;
			const x = cx + Math.floor(random() * 60);
			const y = cy + Math.floor(random() * 60);
			index.insert(r.make(x, y, x + 9, y + 9), `c_${i}`);
		}

		// Sibling overlap is what a query pays to visit subtrees that cannot hold
		// its answer, and the quantity the R* heuristics exist to reduce.
		//
		// Calibrated on this exact seeded scenario: as written it reaches 2.7e5,
		// area enlargement alone reaches 9.8e5, and a payload-blind descent reaches
		// 3.8e9. So ~1.5x headroom, and it fails either way of losing the
		// heuristic.
		const { overlapArea } = index.getTreeQualityMetrics();
		assertLess(
			overlapArea,
			400_000,
			`sibling overlap ${overlapArea.toExponential(3)} is high enough that the split heuristic is not working`,
		);
	});

	await t.step('Unbounded rectangles still partition, so queries still prune', () => {
		// A saturating measure returns infinity for every unbounded box, so every
		// candidate compares equal, the tree stops partitioning, and a query reads
		// almost the whole index. This guards that, and it is the primary
		// deployment path: an empty Google Sheets GridRange is unbounded.
		const index = createRStarTreeIndex<string>();
		const random = seededRandom(5);

		// Full-width rows in shuffled order, so nothing but the heuristics can
		// produce a good grouping.
		const tops = Array.from({ length: 2000 }, (_, i) => i * 4);
		for (let i = tops.length - 1; i > 0; i--) {
			const j = Math.floor(random() * (i + 1));
			[tops[i], tops[j]] = [tops[j]!, tops[i]!];
		}
		tops.forEach((y, i) => index.insert([r.negInf, y, 400, y + 2], `row_${i}`));

		assertWellFormed(index, 'shuffled unbounded rows');

		// A one-cell query matches at most one row. Before the pair-valued measures
		// this scanned essentially every stored rectangle, and 20000 such queries
		// took about fifty times as long.
		let scanned = 0;
		for (let i = 0; i < 200; i++) {
			const y = Math.floor(random() * 8000);
			for (const _ of index.query(r.make(10, y, 10, y))) scanned++;
		}
		assertLessOrEqual(scanned, 200, 'a one-cell query must match at most one full-width row');

		const { overlapArea, depth } = index.getTreeQualityMetrics();
		assertLessOrEqual(depth, 6, `depth ${depth} suggests the unbounded axis is driving the tree shape`);

		// A quality metric that saturates cannot report quality. This stays a
		// real number because the metric measures overlap over the bounded axes,
		// and it was infinity for every unbounded tree before that change.
		assertNotEquals(overlapArea, Infinity, 'the overlap metric must stay finite on unbounded data');
	});

	await t.step('Finite and unbounded rectangles mixed together still partition', () => {
		// Where the unbounded-axis count carries the measure rather than the
		// magnitude: columns scattered among finite rectangles. Grouping the
		// columns is what lets the finite ones keep pruning.
		//
		// Measured, not pinned: 5000 point queries take ~16ms with the pair
		// measure, ~370ms with a saturating one, and neutralising the count term
		// costs ~28%. None of that is asserted, because the wasted node visits are
		// not observable through the public API and a wall-clock assertion would
		// be flaky. What is asserted is that the answers and the tree stay right.
		const index = createRStarTreeIndex<string>();
		const random = seededRandom(31);

		const ops: Rectangle[] = [];
		for (let i = 0; i < 1000; i++) {
			const x = Math.floor(random() * 4000), y = Math.floor(random() * 4000);
			ops.push([x, y, x + 3, y + 3]);
		}
		for (let i = 0; i < 100; i++) {
			const x = Math.floor(random() * 4000);
			ops.push([x, r.negInf, x + 1, r.posInf]);
		}
		for (let i = ops.length - 1; i > 0; i--) {
			const j = Math.floor(random() * (i + 1));
			[ops[i], ops[j]] = [ops[j]!, ops[i]!];
		}
		ops.forEach((bounds, i) => index.insert(bounds, `m_${i}`));

		assertWellFormed(index, 'finite and unbounded mixed');

		// Every probe lands in at most one finite rectangle and one column, since
		// the store is disjoint. A wrong answer here would mean the unbounded
		// rows and the finite ones stopped agreeing on what covers a cell.
		for (let i = 0; i < 300; i++) {
			const x = Math.floor(random() * 4000), y = Math.floor(random() * 4000);
			assertLessOrEqual(Array.from(index.query(r.make(x, y, x, y))).length, 1);
		}
	});
});
