/**
 * @module
 *
 * Linear scan over an array kept in Morton (Z-order) order. Best for n < 100, and
 * for write-heavy work above that.
 *
 * A Morton code interleaves the bits of x and y to map a point onto a curve that
 * mostly keeps neighbours near each other, so the scan walks memory in roughly
 * spatial order. Encoding is a handful of bit operations, which is why it beat a
 * Hilbert curve here despite Hilbert's better locality: see
 * docs/analyses/morton-vs-hilbert-analysis.md.
 *
 * **Complexity**: insert is O(n), so n inserts are O(n²) as the store grows.
 * Query is an O(n) scan. Quadratic insert is the accepted cost below n=100; above
 * it, reach for the R*-tree.
 *
 * **Reference**: Morton, G. M. (1966). "A Computer Oriented Geodetic Data Base
 * and a New Technique in File Sequencing." IBM Technical Report.
 */

import { computeExtent } from '../extent.ts';
import { hits, subtractInto } from '../decompose.ts';
import * as r from '../r.ts';
import type { ExtentResult, QueryResult, Rectangle, SpatialIndex } from '../types.ts';

/** Coordinates are masked to 16 bits; above this they wrap in the ordering only. */
const MAX_COORD = 0xFFFF;

/**
 * Morton code of a 2D point, by interleaving the bits of x and y.
 *
 * Uses the "magic bits" masks rather than a bit-by-bit loop, so it is a fixed
 * handful of operations. Coordinates are masked to 16 bits, so anything above
 * 65535 wraps and loses locality. That costs speed, never correctness: the code
 * only decides iteration order, and bounds are stored as given.
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

/**
 * Morton code of a rectangle's centre; infinite edges anchor at 0.
 *
 * Halved with `Math.floor`, not `>> 1`: a shift coerces to int32, so once the two
 * edges sum past 2³¹ the centre wraps negative and the ordering turns to noise.
 * Results stay correct either way, since the scan visits every entry.
 */
function mortonOf(b: Readonly<Rectangle>): number {
	const centerX = r.isFin(b[0]) && r.isFin(b[2]) ? Math.floor((b[0] + b[2]) / 2) : 0;
	const centerY = r.isFin(b[1]) && r.isFin(b[3]) ? Math.floor((b[1] + b[3]) / 2) : 0;
	return mortonCode(centerX, centerY);
}

function byMorton(a: { morton: number }, b: { morton: number }): number {
	return a.morton - b.morton;
}

interface Entry<T> {
	bounds: Readonly<Rectangle>;
	value: T;
	morton: number;
}

/** `SpatialIndex<T>` plus size tracking. */
export interface MortonLinearScanIndex<T> extends SpatialIndex<T> {
	/** Count of stored rectangles (O(1)) */
	size(): number;
}

class MortonLinearScanImpl<T> implements MortonLinearScanIndex<T> {
	private entries: Array<Entry<T>> = [];
	private extentCached: ExtentResult | null = null;
	/** Bumped by every mutation, so an open query iterator can tell it went stale. */
	private version = 0;
	/**
	 * Reused across inserts. Consumed before `insert` returns and never handed out,
	 * so one buffer serves every call instead of one array per overlapping entry.
	 */
	private readonly fragScratch: Array<Readonly<Rectangle>> = [];
	private readonly pending: Array<Entry<T>> = [];

	insert(bounds: Readonly<Rectangle>, value: T): void {
		bounds = r.validated(bounds);

		this.extentCached = null;
		this.version++;

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

		// One backward merge into the Morton-ordered entries. Splicing each fragment
		// in turn shifts O(n) elements per fragment; sorting the few fragments and
		// merging once is O(n + F log F) for the same result.
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
		const stamp = this.version;
		const entries = this.entries;
		for (let i = 0; i < entries.length; i++) {
			// An insert rewrites this array in place and the universal rectangle
			// replaces it outright, so an iterator held across one either walks a
			// detached snapshot or stops early. Both are silent, so refuse.
			if (this.version !== stamp) {
				throw new Error(
					'Query iterator invalidated: the index was modified while this query was being iterated.',
				);
			}
			const entry = entries[i]!;
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
 * Best for n < 100. Insert and query are both O(n).
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
