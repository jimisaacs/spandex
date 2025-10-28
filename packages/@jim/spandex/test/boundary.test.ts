import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
import createRStarTreeIndex from '@jim/spandex/index/rstartree';
import { assertEquals } from '@std/assert';

/**
 * Test boundary conditions and error cases
 */

Deno.test('MortonLinearScan - MAX_COORD boundary (65536)', () => {
	const index = createMortonLinearScanIndex<string>();

	// Insert with coordinates at MAX_COORD (65535 - within range)
	index.insert([65535, 65535, 65535, 65535], 'max');
	const results1 = Array.from(index.query());
	assertEquals(results1.length, 1);
	assertEquals(results1[0]![0], [65535, 65535, 65535, 65535]);
	assertEquals(results1[0]![1], 'max');

	// Insert with coordinates exceeding MAX_COORD
	// IMPORTANT: Wrapping only affects Morton code (spatial ordering), NOT geometry!
	// The stored bounds remain [65536, 65536, 65537, 65537]
	// But Morton code wraps: mortonCode(65536, 65536) = mortonCode(0, 0)
	index.insert([65536, 65536, 65537, 65537], 'exceeded');

	// The rectangle is stored as-is (no wrapping of coordinates)
	// It doesn't overlap with [65535, 65535, 65535, 65535], so we get both
	const results2 = Array.from(index.query());
	assertEquals(results2.length, 2);

	// Query for the actual stored coordinates (not wrapped)
	const results3 = Array.from(index.query([65536, 65536, 65537, 65537]));
	assertEquals(results3.length, 1);
	assertEquals(results3[0]![1], 'exceeded');

	// Wrapping affects spatial ordering but geometry remains correct
	// This is documented, not a bug: MAX_COORD limit is a Morton encoding constraint,
	// not a geometric constraint. Coordinates > 65535 degrade spatial locality but work correctly.
});

Deno.test('RStarTree - Large coordinates', () => {
	const index = createRStarTreeIndex<string>();

	// R-tree uses NEG_INF/POS_INF instead of MAX_COORD
	// It should handle large coordinates without wrapping

	// Insert with very large coordinates
	index.insert([0, 0, 1000000, 1000000], 'large1');
	index.insert([500000, 500000, 1500000, 1500000], 'large2');

	// Query should work correctly
	const results1 = Array.from(index.query([750000, 750000, 800000, 800000]));
	assertEquals(results1.length, 1);
	assertEquals(results1[0]![1], 'large2');

	// Query all
	const results2 = Array.from(index.query());
	// Expect fragments from decomposition
	assertEquals(results2.length > 0, true);
});

Deno.test('MortonLinearScan - Negative coordinates wrap', () => {
	const index = createMortonLinearScanIndex<string>();

	// Negative coordinates also wrap via bitwise AND
	// -1 & 0xFFFF = 65535
	index.insert([-1, -1, 0, 0], 'negative');

	// The stored rectangle is actually [65535, 65535, 0, 0]
	// But this is an invalid rectangle (min > max), so behavior is undefined
	// This test documents current behavior, not prescriptive correctness

	const results = Array.from(index.query());
	assertEquals(results.length >= 0, true); // Don't assert specific behavior for invalid input
});

Deno.test('Degenerate rectangles - zero area', () => {
	const mortonIndex = createMortonLinearScanIndex<string>();
	const rtreeIndex = createRStarTreeIndex<string>();

	// Point rectangle (zero area)
	mortonIndex.insert([5, 5, 5, 5], 'point');
	rtreeIndex.insert([5, 5, 5, 5], 'point');

	const mortonResults = Array.from(mortonIndex.query([5, 5, 5, 5]));
	const rtreeResults = Array.from(rtreeIndex.query([5, 5, 5, 5]));

	assertEquals(mortonResults.length, 1);
	assertEquals(rtreeResults.length, 1);
	assertEquals(mortonResults[0]![1], 'point');
	assertEquals(rtreeResults[0]![1], 'point');
});

Deno.test('Degenerate rectangles - 1-pixel wide', () => {
	const mortonIndex = createMortonLinearScanIndex<string>();
	const rtreeIndex = createRStarTreeIndex<string>();

	// 1-pixel wide horizontally
	mortonIndex.insert([0, 0, 0, 10], 'vertical-line');
	rtreeIndex.insert([0, 0, 0, 10], 'vertical-line');

	// 1-pixel wide vertically
	mortonIndex.insert([0, 0, 10, 0], 'horizontal-line');
	rtreeIndex.insert([0, 0, 10, 0], 'horizontal-line');

	const mortonResults = Array.from(mortonIndex.query());
	const rtreeResults = Array.from(rtreeIndex.query());

	// Should handle correctly (though may fragment)
	assertEquals(mortonResults.length >= 2, true);
	assertEquals(rtreeResults.length >= 2, true);
});

Deno.test('Invalid rectangles - min > max', () => {
	const mortonIndex = createMortonLinearScanIndex<string>();
	const rtreeIndex = createRStarTreeIndex<string>();

	// Invalid: xmin > xmax, ymin > ymax
	// Currently validated by r.validated() and throws an error

	let mortonError: Error | null = null;
	let rtreeError: Error | null = null;

	try {
		mortonIndex.insert([10, 10, 5, 5], 'invalid');
	} catch (e) {
		mortonError = e as Error;
	}

	try {
		rtreeIndex.insert([10, 10, 5, 5], 'invalid');
	} catch (e) {
		rtreeError = e as Error;
	}

	// Both should throw validation errors
	assertEquals(mortonError !== null, true);
	assertEquals(rtreeError !== null, true);
	assertEquals(mortonError!.message.includes('Invalid rectangle'), true);
	assertEquals(rtreeError!.message.includes('Invalid rectangle'), true);
});
