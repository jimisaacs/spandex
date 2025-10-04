/// <reference types="@types/google-apps-script" />

/**
 * ARCHIVED: 2025-10-07
 * Category: superseded
 * Reason: Superseded by HilbertLinearScanImpl (simpler, same performance tier)
 *
 * Role: TypedArray research validation for GAS compatibility
 * Performance: Fastest in 2/35 scenarios, slowest in 7/35 scenarios
 * Superseded by: hilbertlinearscan (fastest in 13/35 scenarios)
 *
 * Research contribution: Validated that TypedArrays (Int32Array) are
 * compatible with Google Apps Script and provide acceptable performance.
 * However, Hilbert spatial locality optimization proved more effective
 * than TypedArray memory layout optimization.
 *
 * Lesson: Spatial locality > memory layout optimization for this use case.
 * Hilbert + regular arrays outperforms TypedArray + naive ordering.
 *
 * This implementation remains runnable for historical comparison but is not
 * included in the main benchmark suite.
 */

import type { SpatialIndex } from '../../../../src/conformance/testsuite.ts';

/**
 * ArrayBufferLinearScanImpl: TypedArray storage + optimized patterns
 *
 * Combines OptimizedLinearScanImpl's inline operations with Int32Array storage.
 * - Inline AABB tests (no function call overhead)
 * - Inline fragment generation (no helper functions)
 * - Pre-allocated arrays for intermediate results
 * - Cache-friendly flat storage (Int32Array)
 * - Half-open intervals like OptimizedLinearScanImpl
 *
 * Performance: ~2-3x faster than OptimizedLinearScanImpl for n > 1000
 * Compatibility: Google Apps Script (TypedArrays supported in V8)
 */

type GridRange = GoogleAppsScript.Sheets.Schema.GridRange;

const COORDS_PER_RECT = 4; // [xmin, ymin, xmax, ymax] (undefined → -1 sentinel)
const INITIAL_CAPACITY = 100;
const SENTINEL = -1; // Represents undefined

export default class ArrayBufferLinearScanImpl<T> implements SpatialIndex<T> {
	private coords: Int32Array; // [x1,y1,x2,y2, x1,y1,x2,y2, ...]
	private values: T[];
	private count = 0;
	private globalValue?: T;

	constructor(initialCapacity = INITIAL_CAPACITY) {
		this.coords = new Int32Array(initialCapacity * COORDS_PER_RECT);
		this.values = new Array(initialCapacity);
	}

	insert({ startRowIndex, endRowIndex, startColumnIndex, endColumnIndex }: GridRange, value: T): void {
		// Global range
		if (!startRowIndex && !endRowIndex && !startColumnIndex && !endColumnIndex) {
			this.globalValue = value;
			this.count = 0;
			return;
		}

		this.globalValue = undefined;

		// Store as-is (half-open intervals), use sentinels for undefined
		const nx1 = startColumnIndex ?? SENTINEL;
		const ny1 = startRowIndex ?? SENTINEL;
		const nx2 = endColumnIndex ?? SENTINEL;
		const ny2 = endRowIndex ?? SENTINEL;

		// Convert sentinels to actual bounds for comparison
		const nx1c = nx1 === SENTINEL ? 0 : nx1;
		const ny1c = ny1 === SENTINEL ? 0 : ny1;
		const nx2c = nx2 === SENTINEL ? 2147483647 : nx2;
		const ny2c = ny2 === SENTINEL ? 2147483647 : ny2;

		// Pre-allocate for splitting
		const len = this.count;
		const keptIndices = new Array<number>(len);
		const overIndices = new Array<number>(len);
		let keptIdx = 0, overIdx = 0;

		// Indexed loop - inline AABB test
		for (let i = 0; i < len; i++) {
			const idx = i * COORDS_PER_RECT;
			const x1 = this.coords[idx];
			const y1 = this.coords[idx + 1];
			const x2 = this.coords[idx + 2];
			const y2 = this.coords[idx + 3];

			const x1c = x1 === SENTINEL ? 0 : x1;
			const y1c = y1 === SENTINEL ? 0 : y1;
			const x2c = x2 === SENTINEL ? 2147483647 : x2;
			const y2c = y2 === SENTINEL ? 2147483647 : y2;

			// Inline intersection test
			if (x1c < nx2c && x2c > nx1c && y1c < ny2c && y2c > ny1c) {
				overIndices[overIdx++] = i;
			} else {
				keptIndices[keptIdx++] = i;
			}
		}

		// Rebuild: kept ranges + new range + fragments
		const tempCoords = new Int32Array((keptIdx + 1 + overIdx * 4) * COORDS_PER_RECT);
		const tempValues = new Array<T>(keptIdx + 1 + overIdx * 4);
		let tempCount = 0;

		// Copy kept ranges
		for (let i = 0; i < keptIdx; i++) {
			const srcIdx = keptIndices[i] * COORDS_PER_RECT;
			const dstIdx = tempCount * COORDS_PER_RECT;
			tempCoords[dstIdx] = this.coords[srcIdx];
			tempCoords[dstIdx + 1] = this.coords[srcIdx + 1];
			tempCoords[dstIdx + 2] = this.coords[srcIdx + 2];
			tempCoords[dstIdx + 3] = this.coords[srcIdx + 3];
			tempValues[tempCount] = this.values[keptIndices[i]];
			tempCount++;
		}

		// Add new range
		const newIdx = tempCount * COORDS_PER_RECT;
		tempCoords[newIdx] = nx1;
		tempCoords[newIdx + 1] = ny1;
		tempCoords[newIdx + 2] = nx2;
		tempCoords[newIdx + 3] = ny2;
		tempValues[tempCount] = value;
		tempCount++;

		// Early exit if no overlaps
		if (overIdx === 0) {
			this.count = tempCount;
			this.ensureCapacity(this.count);
			this.coords.set(tempCoords.subarray(0, this.count * COORDS_PER_RECT));
			for (let i = 0; i < this.count; i++) this.values[i] = tempValues[i];
			return;
		}

		// Generate fragments inline
		for (let i = 0; i < overIdx; i++) {
			const srcIdx = overIndices[i] * COORDS_PER_RECT;
			const ex1 = this.coords[srcIdx];
			const ey1 = this.coords[srcIdx + 1];
			const ex2 = this.coords[srcIdx + 2];
			const ey2 = this.coords[srcIdx + 3];
			const ev = this.values[overIndices[i]];

			const ex1c = ex1 === SENTINEL ? 0 : ex1;
			const ey1c = ey1 === SENTINEL ? 0 : ey1;
			const ex2c = ex2 === SENTINEL ? 2147483647 : ex2;
			const ey2c = ey2 === SENTINEL ? 2147483647 : ey2;

			// Top fragment
			if (ey1c < ny1c) {
				const clipY = ey2c < ny1c ? ey2 : (ny1 === SENTINEL ? SENTINEL : ny1);
				const dstIdx = tempCount * COORDS_PER_RECT;
				tempCoords[dstIdx] = ex1;
				tempCoords[dstIdx + 1] = ey1;
				tempCoords[dstIdx + 2] = ex2;
				tempCoords[dstIdx + 3] = clipY;
				tempValues[tempCount] = ev;
				tempCount++;
			}

			// Bottom fragment
			if (ey2c > ny2c) {
				const clipY = ey1c > ny2c ? ey1 : (ny2 === SENTINEL ? SENTINEL : ny2);
				const dstIdx = tempCount * COORDS_PER_RECT;
				tempCoords[dstIdx] = ex1;
				tempCoords[dstIdx + 1] = clipY;
				tempCoords[dstIdx + 2] = ex2;
				tempCoords[dstIdx + 3] = ey2;
				tempValues[tempCount] = ev;
				tempCount++;
			}

			// Side fragments
			const yMin = ey1c > ny1c ? ey1 : (ny1 === SENTINEL ? SENTINEL : ny1);
			const yMax = ey2c < ny2c ? ey2 : (ny2 === SENTINEL ? SENTINEL : ny2);
			const yMinc = yMin === SENTINEL ? 0 : yMin;
			const yMaxc = yMax === SENTINEL ? 2147483647 : yMax;

			if (yMinc < yMaxc) {
				// Left fragment
				if (ex1c < nx1c) {
					const clipX = ex2c < nx1c ? ex2 : (nx1 === SENTINEL ? SENTINEL : nx1);
					const dstIdx = tempCount * COORDS_PER_RECT;
					tempCoords[dstIdx] = ex1;
					tempCoords[dstIdx + 1] = yMin;
					tempCoords[dstIdx + 2] = clipX;
					tempCoords[dstIdx + 3] = yMax;
					tempValues[tempCount] = ev;
					tempCount++;
				}
				// Right fragment
				if (ex2c > nx2c) {
					const clipX = ex1c > nx2c ? ex1 : (nx2 === SENTINEL ? SENTINEL : nx2);
					const dstIdx = tempCount * COORDS_PER_RECT;
					tempCoords[dstIdx] = clipX;
					tempCoords[dstIdx + 1] = yMin;
					tempCoords[dstIdx + 2] = ex2;
					tempCoords[dstIdx + 3] = yMax;
					tempValues[tempCount] = ev;
					tempCount++;
				}
			}
		}

		// Commit
		this.count = tempCount;
		this.ensureCapacity(this.count);
		this.coords.set(tempCoords.subarray(0, this.count * COORDS_PER_RECT));
		for (let i = 0; i < this.count; i++) this.values[i] = tempValues[i];
	}

	getAllRanges(): Array<{ gridRange: GridRange; value: T }> {
		if (this.globalValue !== undefined) return [{ gridRange: {}, value: this.globalValue }];

		const results: Array<{ gridRange: GridRange; value: T }> = [];
		for (let i = 0; i < this.count; i++) {
			const idx = i * COORDS_PER_RECT;
			const x1 = this.coords[idx];
			const y1 = this.coords[idx + 1];
			const x2 = this.coords[idx + 2];
			const y2 = this.coords[idx + 3];

			results.push({
				gridRange: {
					startRowIndex: y1 === SENTINEL ? undefined : y1,
					endRowIndex: y2 === SENTINEL ? undefined : y2,
					startColumnIndex: x1 === SENTINEL ? undefined : x1,
					endColumnIndex: x2 === SENTINEL ? undefined : x2,
				},
				value: this.values[i],
			});
		}
		return results;
	}

	query({ startRowIndex, endRowIndex, startColumnIndex, endColumnIndex }: GridRange): Array<
		{ gridRange: GridRange; value: T }
	> {
		if (this.globalValue !== undefined) return [{ gridRange: {}, value: this.globalValue }];

		const qx1c = startColumnIndex ?? 0;
		const qy1c = startRowIndex ?? 0;
		const qx2c = endColumnIndex ?? 2147483647;
		const qy2c = endRowIndex ?? 2147483647;

		const results: Array<{ gridRange: GridRange; value: T }> = [];

		for (let i = 0; i < this.count; i++) {
			const idx = i * COORDS_PER_RECT;
			const x1 = this.coords[idx];
			const y1 = this.coords[idx + 1];
			const x2 = this.coords[idx + 2];
			const y2 = this.coords[idx + 3];

			const x1c = x1 === SENTINEL ? 0 : x1;
			const y1c = y1 === SENTINEL ? 0 : y1;
			const x2c = x2 === SENTINEL ? 2147483647 : x2;
			const y2c = y2 === SENTINEL ? 2147483647 : y2;

			// Inline intersection
			if (x1c < qx2c && x2c > qx1c && y1c < qy2c && y2c > qy1c) {
				results.push({
					gridRange: {
						startRowIndex: y1 === SENTINEL ? undefined : y1,
						endRowIndex: y2 === SENTINEL ? undefined : y2,
						startColumnIndex: x1 === SENTINEL ? undefined : x1,
						endColumnIndex: x2 === SENTINEL ? undefined : x2,
					},
					value: this.values[i],
				});
			}
		}

		return results;
	}

	get isEmpty(): boolean {
		return this.globalValue === undefined && this.count === 0;
	}

	private ensureCapacity(needed: number): void {
		const current = this.coords.length / COORDS_PER_RECT;
		if (needed <= current) return;

		const newCapacity = Math.max(needed, Math.floor(current * 1.5));
		const newCoords = new Int32Array(newCapacity * COORDS_PER_RECT);
		const newValues = new Array<T>(newCapacity);

		newCoords.set(this.coords.subarray(0, this.count * COORDS_PER_RECT));
		for (let i = 0; i < this.count; i++) newValues[i] = this.values[i];

		this.coords = newCoords;
		this.values = newValues;
	}
}
