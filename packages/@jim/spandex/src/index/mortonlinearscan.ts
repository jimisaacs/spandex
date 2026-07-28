/**
 * @module
 *
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

import { computeExtent } from '../extent.ts';
import { hits, subtractInto } from '../decompose.ts';
import * as r from '../r.ts';
import type { ExtentResult, QueryResult, Rectangle, SpatialIndex } from '../types.ts';

/** Max coordinate value (16-bit): 65535. Coordinates > 65535 wrap in Morton encoding but geometry remains correct. */
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
 * **Coordinate limits**: Coordinates are masked to 16 bits via bitwise AND.
 * - Coordinates ≤ 65535: Full spatial locality preserved
 * - Coordinates > 65535: Wrap in Morton encoding (degrades locality) but geometry remains correct
 * - Example: mortonCode(65536, 0) = mortonCode(0, 0) (collision in ordering, not geometry)
 *
 * **Why this is safe**: Morton code only affects iteration order for spatial locality.
 * The actual rectangle bounds are stored as-is. Wrapping degrades performance (worse locality)
 * but does not cause correctness issues.
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

/** Morton code of a rectangle's centre; infinite edges anchor at 0. */
function mortonOf(b: Readonly<Rectangle>): number {
	const centerX = r.isFin(b[0]) && r.isFin(b[2]) ? (b[0] + b[2]) >> 1 : 0;
	const centerY = r.isFin(b[1]) && r.isFin(b[3]) ? (b[1] + b[3]) >> 1 : 0;
	return mortonCode(centerX, centerY);
}

function byMorton(a: { morton: number }, b: { morton: number }): number {
	return a.morton - b.morton;
}

function binarySearch(entries: Array<Entry<unknown>>, morton: number): number {
	let left = 0;
	let right = entries.length;
	while (left < right) {
		const mid = (left + right) >> 1;
		if (entries[mid]!.morton < morton) {
			left = mid + 1;
		} else {
			right = mid;
		}
	}
	return left;
}

interface Entry<T> {
	bounds: Readonly<Rectangle>;
	value: T;
	morton: number;
}

/**
 * Morton Linear Scan Index with additional introspection methods.
 *
 * Extends `SpatialIndex<T>` with size tracking.
 */
export interface MortonLinearScanIndex<T> extends SpatialIndex<T> {
	/** Count of stored rectangles (O(1)) */
	size(): number;
}

/**
 * Linear scan with Morton curve (Z-order) sorting for spatial locality
 */
class MortonLinearScanImpl<T> implements MortonLinearScanIndex<T> {
	private entries: Array<Entry<T>> = [];
	private extentCached: ExtentResult | null = null;
	/**
	 * Reused across inserts. Fully consumed before `insert` returns and never
	 * handed out, so one buffer serves every call instead of one array per
	 * overlapping entry.
	 */
	private readonly fragScratch: Array<Readonly<Rectangle>> = [];
	private readonly pending: Array<Entry<T>> = [];

	insert(bounds: Readonly<Rectangle>, value: T): void {
		bounds = r.validated(bounds);

		this.extentCached = null;

		// Global range (infinite bounds) - fast path
		if (r.isAll(bounds)) {
			this.entries = [{ bounds, value, morton: 0 }];
			return;
		}

		const [nx1, ny1, nx2, ny2] = bounds;

		// Single-pass O(n): decompose overlaps and keep non-overlapping entries
		const fragments = this.pending;
		const frags = this.fragScratch;
		fragments.length = 0;
		const entries = this.entries;
		let writeIdx = 0;
		for (let i = 0; i < entries.length; i++) {
			const entry = entries[i]!;
			const [ex1, ey1, ex2, ey2] = entry.bounds;
			if (hits(nx1, ny1, nx2, ny2, ex1, ey1, ex2, ey2)) {
				frags.length = 0;
				subtractInto(ex1, ey1, ex2, ey2, nx1, ny1, nx2, ny2, frags);
				for (let j = 0; j < frags.length; j++) {
					const frag = frags[j]!;
					fragments.push({ bounds: frag, value: entry.value, morton: mortonOf(frag) });
				}
			} else {
				entries[writeIdx++] = entry;
			}
		}
		entries.length = writeIdx;

		fragments.push({ bounds: r.owned(bounds), value, morton: mortonOf(bounds) });

		// Merge the fragments into the Morton-ordered entries in one backward
		// pass. Splicing each fragment in turn shifts O(n) elements per
		// fragment; sorting the handful of fragments and merging once costs
		// O(n + F log F) and leaves the same order.
		fragments.sort(byMorton);
		const kept = entries.length;
		const added = fragments.length;
		entries.length = kept + added;
		let w = kept + added - 1;
		let i = kept - 1;
		let j = added - 1;
		while (j >= 0) {
			entries[w--] = (i >= 0 && entries[i]!.morton > fragments[j]!.morton) ? entries[i--]! : fragments[j--]!;
		}
		fragments.length = 0;
	}

	*query(bounds: Readonly<Rectangle> = r.ALL): IterableIterator<QueryResult<T>> {
		bounds = r.validated(bounds);

		// Linear scan (Morton ordering may help with cache locality)
		const [qx1, qy1, qx2, qy2] = bounds;
		const entries = this.entries;
		for (const entry of entries) {
			const [ex1, ey1, ex2, ey2] = entry.bounds;
			if (hits(qx1, qy1, qx2, qy2, ex1, ey1, ex2, ey2)) yield [entry.bounds, entry.value];
		}
	}

	extent(): ExtentResult {
		return this.extentCached ??= computeExtent(this.query());
	}

	size(): number {
		return this.entries.length;
	}
}

/**
 * Create a Morton curve (Z-order) linear scan spatial index.
 *
 * **Best for**: n < 100 ranges (sparse data)
 * **Complexity**: O(n) insert/query, O(n²) for n inserts
 * **Performance**: ~6µs insert @ n=50
 *
 * @returns New spatial index instance
 *
 * @example
 * ```typescript
 * import createMortonLinearScanIndex from '@jim/spandex';
 * import * as r from '@jim/spandex/r';
 *
 * const index = createMortonLinearScanIndex<string>();
 *
 * // Insert overlapping ranges - automatic decomposition
 * index.insert(r.make(0, 0, 10, 10), 'area1');
 * index.insert(r.make(5, 5, 15, 15), 'area2'); // Fragments area1
 *
 * // Query ranges intersecting [7,7,8,8]
 * for (const [bounds, value] of index.query(r.make(7, 7, 8, 8))) {
 *   console.log(bounds, value);
 * }
 * ```
 */
export default function createMortonLinearScanIndex<T>(): MortonLinearScanIndex<T> {
	return new MortonLinearScanImpl<T>();
}
