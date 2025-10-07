/**
 * Adversarial Worst-Case Tests
 *
 * Purpose: Empirically validate O(n) fragmentation bound (not O(4^n))
 *
 * Tests pathological insertion patterns designed to maximize fragmentation
 */

/// <reference types="@types/google-apps-script" />

import { assertLess } from '@std/assert';
import MortonLinearScanImpl from '../src/implementations/mortonlinearscan.ts';
import CompactMortonLinearScanImpl from '../src/implementations/compactmortonlinearscan.ts';
import RTreeImpl from '../src/implementations/rtree.ts';

Deno.test('Adversarial: Concentric rectangles (maximize overlaps)', () => {
	const index = new MortonLinearScanImpl<string>();
	const fragmentCounts: number[] = [];

	// Pathological pattern: Each insert fully contains all previous
	// This maximizes overlap count: insert i overlaps with ALL i-1 previous ranges
	for (let i = 0; i < 100; i++) {
		const size = 100 - i; // Shrinking from outside-in
		index.insert({
			startRowIndex: i,
			endRowIndex: 100 - i,
			startColumnIndex: i,
			endColumnIndex: 100 - i,
		}, `value${i}`);

		fragmentCounts.push(index.size);
	}

	const finalCount = fragmentCounts[99];

	// Theoretical worst: 4^100 (exponential - impossible)
	// Our claim: O(n) practical bound → should be linear
	// Allow up to 4x growth: 100 inserts → max 400 ranges
	assertLess(finalCount, 400, `Expected O(n) fragmentation, got ${finalCount} ranges after 100 inserts`);

	// Measure average fragmentation factor
	const avgFragments = finalCount / 100;
	console.log(`Concentric pattern: ${finalCount} final ranges, ${avgFragments.toFixed(2)}x avg fragmentation`);

	// Should be bounded, not exponential
	assertLess(avgFragments, 5, `Fragmentation should be bounded, got ${avgFragments.toFixed(2)}x`);
});

Deno.test('Adversarial: Diagonal sweep (maximize edge cases)', () => {
	const index = new MortonLinearScanImpl<string>();
	const fragmentCounts: number[] = [];

	// Pattern: Diagonal sweep that partially overlaps many previous ranges
	for (let i = 0; i < 100; i++) {
		index.insert({
			startRowIndex: i,
			endRowIndex: i + 20,
			startColumnIndex: i,
			endColumnIndex: i + 20,
		}, `value${i}`);

		fragmentCounts.push(index.size);
	}

	const finalCount = fragmentCounts[99];

	// Should still be O(n)
	assertLess(finalCount, 400, `Expected O(n), got ${finalCount} ranges`);

	const avgFragments = finalCount / 100;
	console.log(`Diagonal pattern: ${finalCount} final ranges, ${avgFragments.toFixed(2)}x avg fragmentation`);

	assertLess(avgFragments, 5, `Bounded fragmentation expected`);
});

Deno.test('Adversarial: Checkerboard (maximize decomposition)', () => {
	const index = new MortonLinearScanImpl<string>();

	// Pattern: Insert large blocks, then small blocks that punch holes
	// This creates maximum decomposition complexity
	for (let i = 0; i < 10; i++) {
		// Large block
		index.insert({
			startRowIndex: i * 20,
			endRowIndex: (i + 1) * 20,
			startColumnIndex: 0,
			endColumnIndex: 100,
		}, `block${i}`);
	}

	const afterBlocks = index.size;
	console.log(`After 10 large blocks: ${afterBlocks} ranges`);

	// Punch holes (small rectangles that decompose each large block)
	for (let i = 0; i < 50; i++) {
		const row = Math.floor(Math.random() * 200);
		const col = Math.floor(Math.random() * 100);
		index.insert({
			startRowIndex: row,
			endRowIndex: row + 3,
			startColumnIndex: col,
			endColumnIndex: col + 3,
		}, `hole${i}`);
	}

	const afterHoles = index.size;
	console.log(`After 50 holes: ${afterHoles} ranges`);

	// 60 total inserts → should have < 240 ranges (4x factor)
	assertLess(afterHoles, 240, `Expected O(n), got ${afterHoles} ranges from 60 inserts`);
});

Deno.test('Adversarial: CompactMorton under same patterns', () => {
	const index = new CompactMortonLinearScanImpl<string>();
	const fragmentCounts: number[] = [];

	// Same concentric pattern as MortonLinearScan test
	for (let i = 0; i < 100; i++) {
		const size = 100 - i; // Shrinking from outside-in
		index.insert({
			startRowIndex: i,
			endRowIndex: 100 - i,
			startColumnIndex: i,
			endColumnIndex: 100 - i,
		}, `value${i}`);

		fragmentCounts.push(index.size);
	}

	const finalCount = fragmentCounts[99];
	const avgFragments = finalCount / 100;

	console.log(
		`CompactMorton concentric pattern: ${finalCount} final ranges, ${avgFragments.toFixed(2)}x avg fragmentation`,
	);

	// Same O(n) bound should apply
	assertLess(
		finalCount,
		400,
		`CompactMorton should have O(n) fragmentation, got ${finalCount} ranges after 100 inserts`,
	);
	assertLess(avgFragments, 5, 'CompactMorton fragmentation should be bounded');
});

Deno.test('Adversarial: RTree under same patterns', () => {
	const index = new RTreeImpl<string>();
	const fragmentCounts: number[] = [];

	// Same concentric pattern as MortonLinearScan test
	// But stop at size=1 to avoid degenerate ranges
	for (let i = 0; i < 50; i++) {
		const size = 100 - (i * 2); // Ensure size > 0
		if (size <= i * 2) break;

		index.insert({
			startRowIndex: i,
			endRowIndex: size,
			startColumnIndex: i,
			endColumnIndex: size,
		}, `value${i}`);

		fragmentCounts.push(index.size);
	}

	const n = fragmentCounts.length;
	const finalCount = fragmentCounts[n - 1];
	const avgFragments = finalCount / n;

	console.log(
		`RTree concentric pattern: ${n} inserts → ${finalCount} final ranges, ${
			avgFragments.toFixed(2)
		}x avg fragmentation`,
	);

	// Same O(n) bound should apply
	assertLess(finalCount, n * 4, `RTree should also have O(n) fragmentation, got ${finalCount} from ${n} inserts`);
	assertLess(avgFragments, 5, 'RTree fragmentation should be bounded');
});

Deno.test('Adversarial: Growth pattern analysis', () => {
	const index = new MortonLinearScanImpl<string>();
	const samples: Array<{ n: number; ranges: number; ratio: number }> = [];

	// Measure fragmentation at different scales
	for (let n = 10; n <= 100; n += 10) {
		const testIndex = new MortonLinearScanImpl<string>();

		for (let i = 0; i < n; i++) {
			const size = 100 - Math.floor((i / n) * 50);
			testIndex.insert({
				startRowIndex: i,
				endRowIndex: size,
				startColumnIndex: i,
				endColumnIndex: size,
			}, `v${i}`);
		}

		const ranges = testIndex.size;
		const ratio = ranges / n;
		samples.push({ n, ranges, ratio });
	}

	console.log('\nFragmentation growth pattern:');
	console.log('n\tRanges\tRatio');
	for (const s of samples) {
		console.log(`${s.n}\t${s.ranges}\t${s.ratio.toFixed(2)}x`);
	}

	// Check that growth is sub-quadratic (not exponential)
	// If fragmentation were exponential, ratio would grow rapidly
	// For O(n), ratio should stay relatively constant
	const firstRatio = samples[0].ratio;
	const lastRatio = samples[samples.length - 1].ratio;

	console.log(`\nRatio growth: ${firstRatio.toFixed(2)}x → ${lastRatio.toFixed(2)}x`);
	console.log(`Factor increase: ${(lastRatio / firstRatio).toFixed(2)}x`);

	// Ratio should not grow exponentially
	// Allow up to 3x growth in ratio (still linear overall)
	assertLess(lastRatio / firstRatio, 3, 'Fragmentation ratio should not grow exponentially');
});

Deno.test('Adversarial: Stress test with random overlaps', () => {
	const index = new MortonLinearScanImpl<string>();

	// Random insertion pattern (realistic worst-case)
	for (let i = 0; i < 200; i++) {
		const row1 = Math.floor(Math.random() * 100);
		const col1 = Math.floor(Math.random() * 100);
		const row2 = row1 + 5 + Math.floor(Math.random() * 20);
		const col2 = col1 + 5 + Math.floor(Math.random() * 20);

		index.insert({
			startRowIndex: row1,
			endRowIndex: row2,
			startColumnIndex: col1,
			endColumnIndex: col2,
		}, `random${i}`);
	}

	const finalCount = index.size;
	const ratio = finalCount / 200;

	console.log(`Random overlap stress: 200 inserts → ${finalCount} ranges (${ratio.toFixed(2)}x)`);

	// Allow up to 2x fragmentation for random patterns
	assertLess(finalCount, 400, `Random pattern should stay O(n), got ${finalCount} ranges`);
});
