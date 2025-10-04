/// <reference types="@types/google-apps-script" />

/**
 * ARCHIVED: 2025-10-07
 * Category: superseded
 * Reason: Superseded by HilbertLinearScanImpl (2x faster)
 *
 * Role: Legacy optimized version (pre-Hilbert curve research)
 * Performance: Fastest in 3/35 scenarios, slowest in 5/35 scenarios
 * Superseded by: hilbertlinearscan (fastest in 13/35 scenarios)
 *
 * Historical context: This was the production linear scan implementation before
 * discovering Hilbert curve spatial locality optimization. Good research step,
 * but Hilbert curve proved to be a superior optimization approach.
 *
 * Lesson: V8 optimizations (inline operations, monomorphic shapes) provided gains,
 * but spatial locality (Hilbert ordering) provided even larger gains.
 *
 * This implementation remains runnable for historical comparison but is not
 * included in the main benchmark suite.
 */

import type { SpatialIndex } from '../../../../src/conformance/testsuite.ts';

/**
 * OptimizedLinearScanImpl: V8-optimized linear scan for sparse data
 *
 * Research-validated winner for sparse data (n < 100): cache locality + V8 JIT optimizations
 * deliver 2-3x speedup over R-tree on small datasets.
 *
 * Algorithm: O(n) insert/query, but with n < 100 overhead dominates complexity
 *
 * Optimizations:
 * - Direct GridRange storage (avoid coordinate conversion)
 * - Inline geometric operations (eliminate function call overhead)
 * - Tuple storage for cache locality
 * - Monomorphic object shapes for V8 JIT
 *
 * Use cases: Spreadsheet properties (n=20-50), any spatial index with n < 100
 *
 * See docs/sparse-data-analysis.md for performance validation
 */

type GridRange = GoogleAppsScript.Sheets.Schema.GridRange;

type RectangleWithValue<T> = readonly [
	xmin: number | undefined,
	ymin: number | undefined,
	xmax: number | undefined,
	ymax: number | undefined,
	value: T,
];

export default class OptimizedLinearScanImpl<T> implements SpatialIndex<T> {
	private globalValue?: T;
	private ranges: Array<RectangleWithValue<T>> = [];

	insert({ startRowIndex, endRowIndex, startColumnIndex, endColumnIndex }: GridRange, value: T): void {
		if (!startRowIndex && !endRowIndex && !startColumnIndex && !endColumnIndex) {
			this.globalValue = value;
			this.ranges = [];
			return;
		}

		this.globalValue = undefined;

		const newRange: RectangleWithValue<T> = [
			startColumnIndex,
			startRowIndex,
			endColumnIndex,
			endRowIndex,
			value,
		] as const;
		const [nx1 = 0, ny1 = 0, nx2 = Infinity, ny2 = Infinity] = newRange;

		// Pre-allocate arrays to avoid V8 growth checks
		const len = this.ranges.length;
		const kept = new Array<RectangleWithValue<T>>(len);
		const overlapping = new Array<RectangleWithValue<T>>(len);
		let keptIdx = 0, overIdx = 0;

		// Indexed loop for V8 optimization (faster than for-of)
		for (let i = 0; i < len; i++) {
			const [x1 = 0, y1 = 0, x2 = Infinity, y2 = Infinity] = this.ranges[i];
			if (x1 < nx2 && x2 > nx1 && y1 < ny2 && y2 > ny1) {
				overlapping[overIdx++] = this.ranges[i];
			} else {
				kept[keptIdx++] = this.ranges[i];
			}
		}

		kept.length = keptIdx;
		overlapping.length = overIdx;

		this.ranges = kept;
		this.ranges.push(newRange);

		// Early exit if no overlaps (e.g., sparse/non-overlapping insertions)
		if (overIdx === 0) return;

		for (let i = 0; i < overIdx; i++) {
			const [ex1 = 0, ey1 = 0, ex2 = Infinity, ey2 = Infinity, ev] = overlapping[i];
			// Top fragment: if existing starts before new, clip at new's start
			if (ey1 < ny1) {
				const clipY = ey2 < ny1 ? ey2 : ny1;
				this.ranges.push([ex1, ey1, ex2, clipY, ev] as const);
			}
			// Bottom fragment: if existing extends beyond new, clip at new's end
			if (ey2 > ny2) {
				const clipY = ey1 > ny2 ? ey1 : ny2;
				this.ranges.push([ex1, clipY, ex2, ey2, ev] as const);
			}
			// Side fragments only in overlapping Y region
			const yMin = ey1 > ny1 ? ey1 : ny1;
			const yMax = ey2 < ny2 ? ey2 : ny2;
			if (yMin < yMax) {
				// Left fragment
				if (ex1 < nx1) {
					const clipX = ex2 < nx1 ? ex2 : nx1;
					this.ranges.push([ex1, yMin, clipX, yMax, ev] as const);
				}
				// Right fragment
				if (ex2 > nx2) {
					const clipX = ex1 > nx2 ? ex1 : nx2;
					this.ranges.push([clipX, yMin, ex2, yMax, ev] as const);
				}
			}
		}
	}

	getAllRanges(): Array<{ gridRange: GridRange; value: T }> {
		if (this.globalValue !== undefined) return [{ gridRange: {}, value: this.globalValue }];

		return this.ranges.map(([xmin, ymin, xmax, ymax, value]) => ({
			gridRange: { startRowIndex: ymin, endRowIndex: ymax, startColumnIndex: xmin, endColumnIndex: xmax },
			value,
		}));
	}

	query({ startRowIndex, endRowIndex, startColumnIndex, endColumnIndex }: GridRange): Array<
		{ gridRange: GridRange; value: T }
	> {
		if (this.globalValue !== undefined) return [{ gridRange: {}, value: this.globalValue }];

		const [qx1 = 0, qy1 = 0, qx2 = Infinity, qy2 = Infinity] = [
			startColumnIndex,
			startRowIndex,
			endColumnIndex,
			endRowIndex,
		];
		const results: Array<{ gridRange: GridRange; value: T }> = [];

		for (let i = 0; i < this.ranges.length; i++) {
			const [x1 = 0, y1 = 0, x2 = Infinity, y2 = Infinity, value] = this.ranges[i];
			if (x1 < qx2 && x2 > qx1 && y1 < qy2 && y2 > qy1) {
				results.push({
					gridRange: { startRowIndex: y1, endRowIndex: y2, startColumnIndex: x1, endColumnIndex: x2 },
					value,
				});
			}
		}

		return results;
	}

	get isEmpty(): boolean {
		return this.globalValue === undefined && this.ranges.length === 0;
	}
}
