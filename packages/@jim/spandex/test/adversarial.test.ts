/**
 * Adversarial Worst-Case Tests
 *
 * Purpose: Empirically validate O(n) fragmentation bound (not O(4^n))
 *
 * Tests pathological insertion patterns designed to maximize fragmentation
 */

import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
import createRStarTreeIndex from '@jim/spandex/index/rstartree';
import * as r from '@jim/spandex/r';
import { seededRandom } from '@local/spandex-testing/utils';
import { assertLess } from '@std/assert';

Deno.test('Adversarial - All patterns', async (t) => {
	await t.step('Concentric rectangles (maximize overlaps)', () => {
		const index = createMortonLinearScanIndex<`rect-${number}`>();
		const fragmentCounts: number[] = [];

		// Pathological pattern: Each insert fully contains all previous
		// This maximizes overlap count: insert i overlaps with ALL i-1 previous ranges
		for (let i = 0; i < 50; i++) {
			// Concentric rectangles shrinking inward: (0,0,99,99), (1,1,98,98), ..., (49,49,50,50)
			const size = 99 - i; // Shrinking from outside-in, stops when size = i (valid range)
			index.insert(r.make(i, i, size, size), `rect-${i}`);

			fragmentCounts.push(index.size());
		}

		const finalCount = fragmentCounts.at(-1)!;

		// Theoretical worst: 4^50 (exponential - impossible)
		// Our claim: O(n) practical bound → should be linear
		// Allow up to 4x growth: 50 inserts → max 200 ranges
		assertLess(finalCount, 200, `Expected O(n) fragmentation, got ${finalCount} ranges after 50 inserts`);

		// Measure average fragmentation factor
		const avgFragments = finalCount / 50;

		// Should be bounded, not exponential
		assertLess(avgFragments, 5, `Fragmentation should be bounded, got ${avgFragments.toFixed(2)}x`);
	});

	await t.step('Diagonal sweep (maximize edge cases)', () => {
		const index = createMortonLinearScanIndex<`val-${number}`>();
		const fragmentCounts: number[] = [];

		// Pattern: Diagonal sweep that partially overlaps many previous ranges
		for (let i = 0; i < 100; i++) {
			index.insert(r.make(i, i, i + 19, i + 19), `val-${i}`);

			fragmentCounts.push(index.size());
		}

		const finalCount = fragmentCounts.at(-1)!;

		// Should still be O(n)
		assertLess(finalCount, 400, `Expected O(n), got ${finalCount} ranges`);

		const avgFragments = finalCount / 100;

		assertLess(avgFragments, 5, `Bounded fragmentation expected`);
	});

	await t.step('Checkerboard (maximize decomposition)', () => {
		const index = createMortonLinearScanIndex<`block-${number}` | `hole-${number}`>();
		const random = seededRandom(42); // Deterministic seed

		// Pattern: Insert large blocks, then small blocks that punch holes
		// This creates maximum decomposition complexity
		for (let i = 0; i < 10; i++) {
			// Large block
			index.insert(r.make(0, i * 20, 99, (i + 1) * 20 - 1), `block-${i}`);
		}

		// Punch holes (small rectangles that decompose each large block)
		for (let i = 0; i < 50; i++) {
			const col = Math.floor(random() * 100);
			const row = Math.floor(random() * 200);
			index.insert(r.make(col, row, col + 2, row + 2), `hole-${i}`);
		}

		const finalCount = index.size();

		// 60 total inserts → should have < 240 ranges (4x factor)
		assertLess(finalCount, 240, `Expected O(n), got ${finalCount} ranges from 60 inserts`);
	});

	await t.step('RStarTree under same patterns', () => {
		const index = createRStarTreeIndex<string>();
		const fragmentCounts: number[] = [];

		// Same concentric pattern as MortonLinearScan test
		// But stop at size=1 to avoid degenerate ranges
		for (let i = 0; i < 50; i++) {
			const size = 100 - (i * 2); // Ensure size > 0
			if (size <= i * 2) break;

			index.insert(r.make(i, i, size - 1, size - 1), `val-${i}`);

			fragmentCounts.push(index.size());
		}

		const n = fragmentCounts.length;
		const finalCount = fragmentCounts.at(-1)!;
		const avgFragments = finalCount / n;

		// Same O(n) bound should apply
		assertLess(
			finalCount,
			n * 4,
			`R*-tree should also have O(n) fragmentation, got ${finalCount} from ${n} inserts`,
		);
		assertLess(avgFragments, 5, 'R*-tree fragmentation should be bounded');
	});

	await t.step('Growth pattern analysis', () => {
		const samples: Array<{ n: number; ranges: number; ratio: number }> = [];

		// Measure fragmentation at different scales
		for (let n = 10; n <= 100; n += 10) {
			const testIndex = createMortonLinearScanIndex<`val-${number}`>();

			for (let i = 0; i < n; i++) {
				// Ensure valid rectangles: xmax >= xmin, ymax >= ymin
				// Start from large (200) and shrink, ensuring size always > i
				const size = 200 - Math.floor((i / n) * 50);
				testIndex.insert(r.make(i, i, size - 1, size - 1), `val-${i}`);
			}

			const ranges = testIndex.size();
			const ratio = ranges / n;
			samples.push({ n, ranges, ratio });
		}

		// Check that growth is sub-quadratic (not exponential)
		// If fragmentation were exponential, ratio would grow rapidly
		// For O(n), ratio should stay relatively constant
		const firstRatio = samples.at(0)!.ratio;
		const lastRatio = samples.at(-1)!.ratio;

		// Ratio should not grow exponentially
		// Allow up to 3x growth in ratio (still linear overall)
		assertLess(lastRatio / firstRatio, 3, 'Fragmentation ratio should not grow exponentially');
	});

	await t.step('Stress test with random overlaps', () => {
		const index = createMortonLinearScanIndex<`rand-${number}`>();
		const random = seededRandom(123); // Deterministic seed

		// Random insertion pattern (realistic worst-case)
		for (let i = 0; i < 200; i++) {
			const ymin = Math.floor(random() * 100);
			const xmin = Math.floor(random() * 100);
			const height = 5 + Math.floor(random() * 20);
			const width = 5 + Math.floor(random() * 20);

			index.insert(r.make(xmin, ymin, xmin + width - 1, ymin + height - 1), `rand-${i}`);
		}

		const finalCount = index.size();
		const ratio = finalCount / 200;

		// Allow up to 2x fragmentation for random patterns
		assertLess(finalCount, 400, `Random pattern should stay O(n), got ${finalCount} ranges (${ratio.toFixed(2)}x)`);
	});
});
