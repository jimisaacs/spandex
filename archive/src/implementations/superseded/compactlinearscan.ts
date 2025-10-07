/// <reference types="@types/google-apps-script" />

/**
 * ARCHIVED: 2025-10-07
 * Category: superseded
 * Superseded by: CompactMortonLinearScan
 *
 * Reason: CompactMortonLinearScan delivers 2.4x average speedup at small n (target use case)
 * with only 32% bundle size increase (1,623 bytes vs 1,230 bytes). CompactLinearScan was never
 * fastest in any benchmark scenario (0/35 wins). The performance gain from Morton's superior
 * single-pass algorithm justifies the modest size increase.
 *
 * Key findings:
 * - 2.4x average speedup at n ≤ 60 (e.g., 5.2µs vs 15.8µs for single-cell edits)
 * - CompactMortonLinearScan has most stable measurements (1.06% CV vs 1.79% CV)
 * - Uses efficient single-pass overlap detection vs inefficient two-array rebuild
 * - CompactMorton achieved 7/35 wins (20%), CompactLinearScan achieved 0/35 wins (0%)
 *
 * This implementation remains runnable for historical comparison but is not
 * included in the main benchmark suite.
 */

import type { SpatialIndex } from '../../../../src/conformance/testsuite.ts';

/**
 * Compact Implementation: Same algorithm as Reference, minimal code
 * Inclusive coordinates [min, max] for cleaner arithmetic
 */

type GridRange = GoogleAppsScript.Sheets.Schema.GridRange;

type Rectangle = readonly [xmin: number, ymin: number, xmax: number, ymax: number];

const hits = ([ax1, ay1, ax2, ay2]: Rectangle, [bx1, by1, bx2, by2]: Rectangle) =>
	!(ax2 < bx1 || bx2 < ax1 || ay2 < by1 || by2 < ay1);

const cut = ([ax1, ay1, ax2, ay2]: Rectangle, [bx1, by1, bx2, by2]: Rectangle): Rectangle[] => {
	const f: Rectangle[] = [];
	if (ay1 < by1) f.push([ax1, ay1, ax2, by1 - 1] as const);
	if (ay2 > by2) f.push([ax1, by2 + 1, ax2, ay2] as const);
	const yMin = ay1 > by1 ? ay1 : by1, yMax = ay2 < by2 ? ay2 : by2;
	if (ax1 < bx1 && yMin <= yMax) f.push([ax1, yMin, bx1 - 1, yMax] as const);
	if (ax2 > bx2 && yMin <= yMax) f.push([bx2 + 1, yMin, ax2, yMax] as const);
	return f;
};

export default class CompactLinearScanImpl<T> implements SpatialIndex<T> {
	private items: Array<{ rect: Rectangle; value: T }> = [];

	insert({ startRowIndex: sr, endRowIndex: er, startColumnIndex: sc, endColumnIndex: ec }: GridRange, value: T) {
		if (!sr && !er && !sc && !ec) return void (this.items = [{ rect: [0, 0, Infinity, Infinity], value }]);

		const rect: Rectangle = [sc ?? 0, sr ?? 0, (ec ?? Infinity) - 1, (er ?? Infinity) - 1];
		const kept: typeof this.items = [], over: typeof this.items = [];

		for (const item of this.items) (hits(rect, item.rect) ? over : kept).push(item);

		this.items = kept;
		this.items.push({ rect, value });
		for (const { rect: r, value: v } of over) {
			for (const frag of cut(r, rect)) this.items.push({ rect: frag, value: v });
		}
	}

	getAllRanges() {
		return this.items.map(({ rect: [x1, y1, x2, y2], value }) => ({
			gridRange: x1 + y1 + x2 + y2 === Infinity ? {} : {
				startRowIndex: y1,
				endRowIndex: y2 === Infinity ? undefined : y2 + 1,
				startColumnIndex: x1,
				endColumnIndex: x2 === Infinity ? undefined : x2 + 1,
			},
			value,
		}));
	}

	query({ startRowIndex: sr, endRowIndex: er, startColumnIndex: sc, endColumnIndex: ec }: GridRange) {
		const qRect: Rectangle = [sc ?? 0, sr ?? 0, (ec ?? Infinity) - 1, (er ?? Infinity) - 1];
		return this.items.filter(({ rect }) => hits(rect, qRect)).map(({ rect: [x1, y1, x2, y2], value }) => ({
			gridRange: x1 + y1 + x2 + y2 === Infinity ? {} : {
				startRowIndex: y1,
				endRowIndex: y2 === Infinity ? undefined : y2 + 1,
				startColumnIndex: x1,
				endColumnIndex: x2 === Infinity ? undefined : x2 + 1,
			},
			value,
		}));
	}

	get isEmpty() {
		return !this.items.length;
	}
}
