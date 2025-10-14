/**
 * Morton Curve (Z-Order) Linear Scan - PRODUCTION IMPLEMENTATION
 *
 * Linear scan implementation using Morton codes (Z-order curve) for spatial ordering.
 * Replaced HilbertLinearScan (archived) after benchmarking showed 25% speedup.
 *
 * **Algorithm**: Morton curve uses bit interleaving to map 2D coordinates to 1D.
 * For a point (x, y), interleave bits: x₀y₀x₁y₁x₂y₂... where xᵢ is the i-th bit of x.
 *
 * **Performance**: 25% faster than Hilbert (7.0µs → 5.6µs @ n=50) due to constant-time
 * encoding. Simpler bit operations outweigh Hilbert's theoretically better locality.
 *
 * **Complexity**:
 * - Insert: O(n) per operation (scan existing + splice fragments into sorted array)
 * - n sequential inserts: O(n²) total work (index grows from 0 to ≈4n entries)
 * - Query: O(n) linear scan
 * - Space: O(n) entries stored (empirically ≈4n worst case, see test/adversarial.test.ts)
 *
 * **Performance note**: Quadratic complexity acceptable for target use case (n < 100).
 * For n ≥ 100, use RStarTreeImpl (O(log n) per operation).
 *
 * **vs Hilbert (archived)**: Same algorithmic complexity, but Morton has:
 * - ✅ Simpler implementation (pure bit operations, no quadrant rotation)
 * - ✅ Constant-time encoding (vs 16 iterations for Hilbert)
 * - ✅ 25% faster in practice (simpler encoding outweighs locality difference)
 * - Theoretically: Slightly inferior locality, but encoding speed dominates at small n
 *
 * **References**:
 * - Morton, G. M. (1966). "A Computer Oriented Geodetic Data Base and a New Technique
 *   in File Sequencing." IBM Technical Report.
 * - Performance analysis: docs/analyses/morton-vs-hilbert-analysis.md
 */

import * as rect from '../rect.ts';
import type { QueryResult, Rectangle, SpatialIndex } from '../types.ts';

/** Max coordinate value (16-bit): 65535. Larger values wrap but remain correct. */
const MAX_COORD = 0xFFFF;

/**
 * Calculate Morton code (Z-order) for a 2D point using bit interleaving.
 *
 * **Algorithm**: Interleave bits of x and y coordinates.
 * Example: x=0b101 (5), y=0b011 (3) → morton=0b100111 (39)
 *           x bits: _1_0_1
 *           y bits: 0_1_1_
 *           result: 100111
 *
 * **Complexity**: O(1) - fixed number of bit operations (32 bits max)
 *
 * **Implementation**: Uses "magic bits" method with bit masks for efficiency.
 * Faster than naive bit-by-bit interleaving.
 *
 * @param x - X coordinate
 * @param y - Y coordinate
 * @returns Morton code (1D index preserving spatial locality)
 *
 * **Note**: Coordinates are masked to 16 bits. Larger coordinates wrap/collide
 * but algorithm remains correct (same behavior as archived Hilbert implementation).
 */
function mortonCode(x: number, y: number): number {
	x = x & MAX_COORD;
	y = y & MAX_COORD;

	// Optimized: combine mask and shift operations, reduce reassignments
	// Spread x bits: 0000abcd → 0a0b0c0d
	x = (x | (x << 8)) & 0x00FF00FF;
	x = (x | (x << 4)) & 0x0F0F0F0F;
	x = (x | (x << 2)) & 0x33333333;
	x = (x | (x << 1)) & 0x55555555;

	// Spread y bits using same pattern
	y = (y | (y << 8)) & 0x00FF00FF;
	y = (y | (y << 4)) & 0x0F0F0F0F;
	y = (y | (y << 2)) & 0x33333333;
	y = (y | (y << 1)) & 0x55555555;

	// Interleave: x bits in even positions, y bits in odd positions
	// Result: yₙxₙ...y₁x₁y₀x₀
	return x | (y << 1);
}

function intersects(a: Rectangle, b: Rectangle): boolean {
	return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
}

function subtract(a: Rectangle, b: Rectangle): Rectangle[] {
	const [ax1, ay1, ax2, ay2] = a;
	const [bx1, by1, bx2, by2] = b;

	if (bx1 <= ax1 && bx2 >= ax2 && by1 <= ay1 && by2 >= ay2) return [];

	const fragments: Rectangle[] = [];

	// Top strip (before B starts in y direction)
	if (ay1 < by1) fragments.push(rect.canonicalized([ax1, ay1, ax2, by1 - 1]));
	// Bottom strip (after B ends in y direction)
	if (ay2 > by2) fragments.push(rect.canonicalized([ax1, by2 + 1, ax2, ay2]));
	// Side strips (only if overlapping Y range exists)
	const yMin = Math.max(ay1, by1);
	const yMax = Math.min(ay2, by2);
	if (yMin <= yMax) {
		if (ax1 < bx1) fragments.push(rect.canonicalized([ax1, yMin, bx1 - 1, yMax]));
		if (ax2 > bx2) fragments.push(rect.canonicalized([bx2 + 1, yMin, ax2, yMax]));
	}

	return fragments;
}

function binarySearch(entries: Array<Entry<unknown>>, morton: number): number {
	let left = 0;
	let right = entries.length;
	while (left < right) {
		const mid = (left + right) >> 1;
		if (entries[mid].morton < morton) {
			left = mid + 1;
		} else {
			right = mid;
		}
	}
	return left;
}

interface Entry<T> {
	bounds: Rectangle;
	value: T;
	morton: number;
}

/**
 * Linear scan with Morton curve (Z-order) sorting for spatial locality
 */
export default class MortonLinearScanImpl<T> implements SpatialIndex<T> {
	private entries: Array<Entry<T>> = [];

	insert(bounds: Rectangle, value: T): void {
		bounds = rect.validated(bounds);

		// Global range (infinite bounds) - fast path
		if (rect.isAll(bounds)) {
			this.entries = [{ bounds, value, morton: 0 }];
			return;
		}

		// Single-pass O(n): decompose overlaps and keep non-overlapping entries
		const fragments: Array<Entry<T>> = [];
		const entries = this.entries;
		let writeIdx = 0;
		for (let i = 0; i < entries.length; i++) {
			const entry = entries[i];
			if (intersects(bounds, entry.bounds)) {
				const frags = subtract(entry.bounds, bounds);
				for (let j = 0; j < frags.length; j++) {
					const frag = frags[j];
					const centerX = (frag[0] + frag[2]) >> 1;
					const centerY = (frag[1] + frag[3]) >> 1;
					const morton = mortonCode(centerX, centerY);
					fragments.push({ bounds: frag, value: entry.value, morton });
				}
			} else {
				entries[writeIdx++] = entry;
			}
		}
		entries.length = writeIdx;

		const centerX = (bounds[0] + bounds[2]) >> 1;
		const centerY = (bounds[1] + bounds[3]) >> 1;
		const morton = mortonCode(centerX, centerY);
		fragments.push({ bounds, value, morton });

		// Complexity: O(k·n) where k = fragments.length, n = entries.length
		// Each splice is O(n) due to array element shifting
		// Trade-off: Maintains sorted order for cache locality (worth it for small k)
		for (let i = 0; i < fragments.length; i++) {
			const entry = fragments[i];
			const pos = binarySearch(entries, entry.morton); // O(log n)
			entries.splice(pos, 0, entry); // O(n) - shifts elements
		}
	}

	*query(bounds: Rectangle = rect.ALL): IterableIterator<QueryResult<T>> {
		bounds = rect.validated(bounds);

		// Linear scan (Morton ordering may help with cache locality)
		const entries = this.entries;
		for (let i = 0; i < entries.length; i++) {
			const entry = entries[i];
			if (intersects(bounds, entry.bounds)) {
				yield [entry.bounds, entry.value];
			}
		}
	}

	/**
	 * Number of non-overlapping ranges stored in index.
	 * Useful for fragmentation analysis and performance testing.
	 */
	get size(): number {
		return this.entries.length;
	}
}
