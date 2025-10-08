/// <reference types="@types/google-apps-script" />

/**
 * Morton Curve (Z-Order) Linear Scan - PRODUCTION IMPLEMENTATION
 *
 * Linear scan implementation using Morton codes (Z-order curve) for spatial ordering.
 * Replaced HilbertLinearScan (archived) after benchmarking showed 25% speedup.
 *
 * **Algorithm**: Morton curve uses bit interleaving to map 2D coordinates to 1D.
 * For a point (x, y), interleave bits: x₀y₀x₁y₁x₂y₂... where xᵢ is the i-th bit of x.
 *
 * **Performance**: 25% faster than Hilbert (6.9µs → 5.2µs @ n=50) due to constant-time
 * encoding. Simpler bit operations outweigh Hilbert's theoretically better locality.
 *
 * **Complexity**:
 * - Insert: O(n) average (scan + splice), O(n log n) worst case
 * - Query: O(n) linear scan
 * - Space: O(n)
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

import type { SpatialIndex } from '../conformance/testsuite.ts';

type GridRange = GoogleAppsScript.Sheets.Schema.GridRange;
type Rectangle = readonly [xmin: number, ymin: number, xmax: number, ymax: number];

/**
 * Maximum coordinate value for Morton code mapping.
 *
 * Set to 2^16 = 65,536 (matches archived Hilbert implementation).
 * Covers typical spreadsheet usage (most sheets < 10K rows/cols).
 */
const MAX_COORD = 1 << 16; // 65536

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
 * @param x - X coordinate (column)
 * @param y - Y coordinate (row)
 * @returns Morton code (1D index preserving spatial locality)
 *
 * **Note**: Coordinates are masked to 16 bits. Larger coordinates wrap/collide
 * but algorithm remains correct (same behavior as archived Hilbert implementation).
 */
function mortonCode(x: number, y: number): number {
	// Mask to 16 bits (matches archived Hilbert implementation)
	x = x & 0xFFFF;
	y = y & 0xFFFF;

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

/** Convert GridRange (half-open) to Rectangle (closed) */
function toInclusive(gridRange: GridRange): Rectangle {
	return [
		gridRange.startColumnIndex ?? 0,
		gridRange.startRowIndex ?? 0,
		(gridRange.endColumnIndex ?? MAX_COORD) - 1,
		(gridRange.endRowIndex ?? MAX_COORD) - 1,
	];
}

/** Convert Rectangle (closed) to GridRange (half-open) */
function toExclusive(rect: Rectangle): GridRange {
	const endCol = rect[2] + 1;
	const endRow = rect[3] + 1;
	return {
		startColumnIndex: rect[0] === 0 ? undefined : rect[0],
		startRowIndex: rect[1] === 0 ? undefined : rect[1],
		endColumnIndex: endCol === MAX_COORD ? undefined : endCol,
		endRowIndex: endRow === MAX_COORD ? undefined : endRow,
	};
}

/** Check if two rectangles intersect */
function intersects(a: Rectangle, b: Rectangle): boolean {
	return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
}

/** Subtract rectangle b from a, returning 0-4 non-overlapping fragments */
function subtract(a: Rectangle, b: Rectangle): Rectangle[] {
	if (!intersects(a, b)) return [a];

	const [ax1, ay1, ax2, ay2] = a;
	const [bx1, by1, bx2, by2] = b;

	if (bx1 <= ax1 && bx2 >= ax2 && by1 <= ay1 && by2 >= ay2) return [];

	const fragments: Rectangle[] = [];

	// Top strip (before B starts in y direction)
	if (ay1 < by1) fragments.push([ax1, ay1, ax2, by1 - 1]);
	// Bottom strip (after B ends in y direction)
	if (ay2 > by2) fragments.push([ax1, by2 + 1, ax2, ay2]);
	// Left strip
	if (ax1 < bx1) fragments.push([ax1, Math.max(ay1, by1), bx1 - 1, Math.min(ay2, by2)]);
	// Right strip
	if (ax2 > bx2) fragments.push([bx2 + 1, Math.max(ay1, by1), ax2, Math.min(ay2, by2)]);

	return fragments.filter((f) => f[0] <= f[2] && f[1] <= f[3]);
}

/** Binary search for Morton code insertion position */
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
	rect: Rectangle;
	value: T;
	morton: number;
}

/**
 * Linear scan with Morton curve (Z-order) sorting for spatial locality
 */
export default class MortonLinearScanImpl<T> implements SpatialIndex<T> {
	private entries: Array<Entry<T>> = [];

	get isEmpty(): boolean {
		return this.entries.length === 0;
	}

	get size(): number {
		return this.entries.length;
	}

	insert(gridRange: GridRange, value: T): void {
		const range = toInclusive(gridRange);
		const entries = this.entries;

		// Single-pass: find overlaps AND remove non-overlapping entries in-place
		const overlapping: Array<Entry<T>> = [];
		let writeIdx = 0;
		for (let i = 0; i < entries.length; i++) {
			if (intersects(range, entries[i].rect)) {
				overlapping.push(entries[i]);
			} else {
				entries[writeIdx++] = entries[i];
			}
		}
		entries.length = writeIdx;

		// Re-insert old fragments (that don't overlap with new range)
		for (let i = 0; i < overlapping.length; i++) {
			const old = overlapping[i];
			const fragments = subtract(old.rect, range);
			for (let j = 0; j < fragments.length; j++) {
				const frag = fragments[j];
				const centerX = (frag[0] + frag[2]) >> 1;
				const centerY = (frag[1] + frag[3]) >> 1;
				const morton = mortonCode(centerX, centerY);
				const pos = binarySearch(entries, morton);
				entries.splice(pos, 0, { rect: frag, value: old.value, morton });
			}
		}

		// Insert new range with Morton ordering
		const centerX = (range[0] + range[2]) >> 1;
		const centerY = (range[1] + range[3]) >> 1;
		const morton = mortonCode(centerX, centerY);
		const pos = binarySearch(entries, morton);
		entries.splice(pos, 0, { rect: range, value, morton });
	}

	getAllRanges(): Array<{ gridRange: GridRange; value: T }> {
		const entries = this.entries;
		const results = new Array(entries.length);
		for (let i = 0; i < entries.length; i++) {
			results[i] = { gridRange: toExclusive(entries[i].rect), value: entries[i].value };
		}
		return results;
	}

	query(gridRange: GridRange): Array<{ gridRange: GridRange; value: T }> {
		const range = toInclusive(gridRange);
		const entries = this.entries; // Cache property access
		const results: Array<{ gridRange: GridRange; value: T }> = [];

		// Linear scan (Morton ordering may help with cache locality)
		for (let i = 0; i < entries.length; i++) {
			const entry = entries[i];
			if (intersects(range, entry.rect)) {
				results.push({
					gridRange: toExclusive(entry.rect),
					value: entry.value,
				});
			}
		}
		return results;
	}
}
