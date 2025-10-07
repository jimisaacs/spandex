/// <reference types="@types/google-apps-script" />

import type { SpatialIndex } from '../conformance/testsuite.ts';

/**
 * Compact Morton Linear Scan - PRODUCTION IMPLEMENTATION (compact variant)
 *
 * Linear scan implementation using Morton's efficient insertion algorithm with simplified spatial ordering.
 * **20% faster** than full MortonLinearScan, **13% smaller** bundle size (1,623 vs 1,876 bytes).
 *
 * **Algorithm**: Morton's single-pass overlap detection + binary search insertion, but replaces
 * complex 22-line bit-interleaving with 3-line XOR-based spatial hint.
 *
 * **Performance**: Simpler encoding outperforms full Morton (0.016ms vs 0.020ms @ n=50).
 * The encoding complexity was overhead, not benefit.
 *
 * **Complexity**:
 * - Insert: O(n) average (scan + splice), O(n log n) worst case
 * - Query: O(n) linear scan
 * - Space: O(n)
 *
 * **vs MortonLinearScan**: Same algorithmic approach, but:
 * - ✅ Simpler spatial hint (3 lines vs 22-line mortonCode function)
 * - ✅ 20% faster (simpler encoding = less overhead)
 * - ✅ 13% smaller bundle (1,623 vs 1,876 bytes)
 * - Spatial locality: "good enough" XOR-based hint vs theoretically optimal Z-order
 *
 * **vs CompactLinearScan** (SUPERSEDED):
 * - ✅ 2.4x faster average (15.3µs vs 36.5µs, wins ALL 35 scenarios)
 * - ❌ 32% larger bundle (1,623 vs 1,233 bytes)
 * - Uses Morton's efficient single-pass algorithm vs two-array rebuild pattern
 *
 * **Use cases**: Bundle-size-critical applications (Google Apps Script add-ons, browser extensions)
 * where 32% size increase is acceptable for 2.4x performance gain
 *
 * **References**:
 * - Analysis: docs/analyses/compact-morton-analysis.md
 * - Morton algorithm: src/implementations/mortonlinearscan.ts (original)
 * - Superseded: archive/src/implementations/superseded/compactlinearscan.ts
 */

type GridRange = GoogleAppsScript.Sheets.Schema.GridRange;
type Rectangle = readonly [xmin: number, ymin: number, xmax: number, ymax: number];

/**
 * Maximum coordinate value for bounded infinity representation.
 *
 * Set to 2^16 = 65,536 (matches MortonLinearScan and archived Hilbert).
 * Covers typical spreadsheet usage (most sheets < 10K rows/cols).
 * Coordinates ≥65K will be clamped but algorithm remains correct.
 */
const MAX_COORD = 1 << 16; // 65536

/**
 * Calculate lightweight spatial hint for 2D coordinates using XOR-based coarse grid.
 *
 * **Purpose**: Provides spatial locality (keeping nearby rectangles together in memory)
 * without the overhead of full Morton bit-interleaving.
 *
 * **Algorithm**:
 * 1. Mask coordinates to 16 bits (same as Morton)
 * 2. Divide space into 64×64 coarse grid (>> 6)
 * 3. XOR grid coordinates for mixing
 * 4. Pack into 32-bit value for stable ordering
 *
 * **Complexity**: O(1) - 6 simple operations (vs Morton's 16 bit-manipulation ops)
 *
 * **Performance**: 20% faster than full Morton encoding due to simplicity
 *
 * @param x - X coordinate (column)
 * @param y - Y coordinate (row)
 * @returns Spatial hint value (lower values = top-left, higher = bottom-right)
 *
 * **Note**: Coordinates are masked to 16 bits. Larger coordinates wrap/collide
 * but algorithm remains correct (same behavior as Morton implementation).
 */
const hint = (x: number, y: number) => {
	const cx = (x & 0xFFFF) >> 6; // Coarse grid X (1024 buckets)
	const cy = (y & 0xFFFF) >> 6; // Coarse grid Y (1024 buckets)
	return (cx ^ cy) | ((cx & 0xFF) << 8) | ((cy & 0xFF) << 16); // XOR + pack for stable ordering
};

/**
 * Internal entry format: stores rectangle bounds, value, and spatial hint for ordering.
 */
interface Entry<T> {
	rect: Rectangle;
	value: T;
	h: number; // Spatial hint for binary search ordering
}

/**
 * Compact Morton Linear Scan implementation.
 *
 * Maintains non-overlapping rectangles with last-writer-wins semantics using
 * Morton's efficient single-pass algorithm with simplified spatial ordering.
 */
export default class CompactMortonLinearScanImpl<T> implements SpatialIndex<T> {
	private entries: Array<Entry<T>> = [];

	/**
	 * Check if index is empty.
	 * @returns true if no ranges are stored
	 */
	get isEmpty(): boolean {
		return this.entries.length === 0;
	}

	get size(): number {
		return this.entries.length;
	}

	/**
	 * Insert a range with last-writer-wins semantics.
	 *
	 * **Algorithm**: Morton's efficient single-pass approach:
	 * 1. Single-pass overlap detection (in-place removal of overlapping entries)
	 * 2. Geometric subtraction of overlapping ranges → ≤4 fragments each
	 * 3. Binary search insertion of all fragments + new range (maintains spatial ordering)
	 *
	 * **Complexity**: O(n) average, O(n log n) worst case
	 * - Single pass: O(n)
	 * - Fragments: O(m) where m = overlapping entries (usually small)
	 * - Binary search insertion: O(log n) per fragment
	 *
	 * **Invariants maintained**:
	 * - No overlapping rectangles (disjointness)
	 * - Spatial ordering by hint value (cache locality)
	 * - Last writer wins (new range replaces overlapping portions)
	 *
	 * @param gridRange - Google Sheets GridRange (half-open intervals [start, end))
	 * @param value - Value to associate with this range
	 */
	insert(gridRange: GridRange, value: T): void {
		const r: Rectangle = [
			gridRange.startColumnIndex ?? 0,
			gridRange.startRowIndex ?? 0,
			(gridRange.endColumnIndex ?? MAX_COORD) - 1,
			(gridRange.endRowIndex ?? MAX_COORD) - 1,
		];

		// Single-pass overlap detection (Morton's efficient approach)
		const over: Array<Entry<T>> = [];
		let writeIdx = 0;
		for (let i = 0; i < this.entries.length; i++) {
			const e = this.entries[i];
			if (!(r[2] < e.rect[0] || r[0] > e.rect[2] || r[3] < e.rect[1] || r[1] > e.rect[3])) {
				over.push(e);
			} else {
				this.entries[writeIdx++] = e;
			}
		}
		this.entries.length = writeIdx;

		// Re-insert fragments
		for (const old of over) {
			const [ax1, ay1, ax2, ay2] = old.rect;
			const [bx1, by1, bx2, by2] = r;

			// Fast complete-overlap check
			if (bx1 <= ax1 && bx2 >= ax2 && by1 <= ay1 && by2 >= ay2) continue;

			// Generate fragments (geometric subtraction - matches LinearScan reference)
			const frags: Rectangle[] = [];
			// Top strip (before B starts in y direction)
			if (ay1 < by1) frags.push([ax1, ay1, ax2, by1 - 1]);
			// Bottom strip (after B ends in y direction)
			if (ay2 > by2) frags.push([ax1, by2 + 1, ax2, ay2]);
			// Left strip
			if (ax1 < bx1) frags.push([ax1, Math.max(ay1, by1), bx1 - 1, Math.min(ay2, by2)]);
			// Right strip
			if (ax2 > bx2) frags.push([bx2 + 1, Math.max(ay1, by1), ax2, Math.min(ay2, by2)]);

			for (const f of frags.filter((x) => x[0] <= x[2] && x[1] <= x[3])) {
				const h = hint((f[0] + f[2]) >> 1, (f[1] + f[3]) >> 1);
				let lo = 0, hi = this.entries.length;
				while (lo < hi) {
					const mid = (lo + hi) >> 1;
					if (this.entries[mid].h < h) lo = mid + 1;
					else hi = mid;
				}
				this.entries.splice(lo, 0, { rect: f, value: old.value, h });
			}
		}

		// Insert new range
		const h = hint((r[0] + r[2]) >> 1, (r[1] + r[3]) >> 1);
		let lo = 0, hi = this.entries.length;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if (this.entries[mid].h < h) lo = mid + 1;
			else hi = mid;
		}
		this.entries.splice(lo, 0, { rect: r, value, h });
	}

	/**
	 * Get all stored ranges in spatial order.
	 *
	 * @returns Array of {gridRange, value} pairs in spatial hint order (cache-friendly iteration)
	 *
	 * **Complexity**: O(n)
	 */
	getAllRanges(): Array<{ gridRange: GridRange; value: T }> {
		return this.entries.map(({ rect: [x1, y1, x2, y2], value }) => {
			// Convert internal MAX_COORD back to undefined (represents infinite range)
			const endRow = y2 + 1;
			const endCol = x2 + 1;
			return {
				gridRange: {
					startRowIndex: y1 === 0 ? undefined : y1,
					startColumnIndex: x1 === 0 ? undefined : x1,
					endRowIndex: endRow === MAX_COORD ? undefined : endRow,
					endColumnIndex: endCol === MAX_COORD ? undefined : endCol,
				},
				value,
			};
		});
	}

	/**
	 * Query for ranges intersecting the given rectangle.
	 *
	 * @param gridRange - Query rectangle (half-open intervals [start, end))
	 * @returns Array of intersecting {gridRange, value} pairs
	 *
	 * **Complexity**: O(n) linear scan (no spatial index structure)
	 *
	 * **Note**: Spatial ordering may improve cache locality during scan, but
	 * doesn't reduce algorithmic complexity (would need tree structure for O(log n)).
	 */
	query(gridRange: GridRange): Array<{ gridRange: GridRange; value: T }> {
		const qr: Rectangle = [
			gridRange.startColumnIndex ?? 0,
			gridRange.startRowIndex ?? 0,
			(gridRange.endColumnIndex ?? MAX_COORD) - 1,
			(gridRange.endRowIndex ?? MAX_COORD) - 1,
		];

		return this.entries
			.filter(({ rect: r }) => !(qr[2] < r[0] || qr[0] > r[2] || qr[3] < r[1] || qr[1] > r[3]))
			.map(({ rect: [x1, y1, x2, y2], value }) => {
				// Convert internal MAX_COORD back to undefined (represents infinite range)
				const endRow = y2 + 1;
				const endCol = x2 + 1;
				return {
					gridRange: {
						startRowIndex: y1 === 0 ? undefined : y1,
						startColumnIndex: x1 === 0 ? undefined : x1,
						endRowIndex: endRow === MAX_COORD ? undefined : endRow,
						endColumnIndex: endCol === MAX_COORD ? undefined : endCol,
					},
					value,
				};
			});
	}
}
