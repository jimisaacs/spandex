/// <reference types="@types/google-apps-script" />

/**
 * ARCHIVED: 2025-10-07
 * Category: superseded
 * Reason: Superseded by HilbertLinearScanImpl (2x faster, same algorithm)
 *
 * Role: Educational reference and test oracle for conformance tests
 * Performance: Fastest in 0/35 scenarios, slowest in 4/35 scenarios
 * Superseded by: hilbertlinearscan (2x speedup via Hilbert spatial locality)
 *
 * This implementation remains valuable as:
 * - Test oracle for conformance testing (clear, readable reference)
 * - Educational example of naive linear scan algorithm
 * - Historical baseline for research comparisons
 *
 * This implementation remains runnable for historical comparison but is not
 * included in the main benchmark suite.
 */

import type { SpatialIndex } from '../../../../src/conformance/testsuite.ts';

/**
 * Reference Implementation: Educational clarity with explicit geometric operations
 *
 * Core operations from computational geometry (de Berg et al.):
 * - Rectangle: [xmin, ymin, xmax, ymax] **inclusive coordinates** [min, max]
 * - Intersects: AABB overlap test O(1)
 * - Subtract: Rectangle decomposition into ≤4 fragments O(1)
 *
 * Note: GridRange uses exclusive end (half-open [start, end)), converted to inclusive for internal ops
 */

type GridRange = GoogleAppsScript.Sheets.Schema.GridRange;

type Rectangle = readonly [xmin: number, ymin: number, xmax: number, ymax: number];

const intersects = ([ax1, ay1, ax2, ay2]: Rectangle, [bx1, by1, bx2, by2]: Rectangle): boolean =>
	!(ax2 < bx1 || bx2 < ax1 || ay2 < by1 || by2 < ay1);

const subtract = ([ax1, ay1, ax2, ay2]: Rectangle, [bx1, by1, bx2, by2]: Rectangle): Rectangle[] => {
	// Geometric subtraction A \ B: cut rectangle A around B, generating up to 4 fragments
	const fragments: Rectangle[] = [];
	if (ay1 < by1) fragments.push([ax1, ay1, ax2, by1 - 1] as const); // Top strip (before B starts)
	if (ay2 > by2) fragments.push([ax1, by2 + 1, ax2, ay2] as const); // Bottom strip (after B ends)
	if (ax1 < bx1) fragments.push([ax1, Math.max(ay1, by1), bx1 - 1, Math.min(ay2, by2)] as const); // Left strip
	if (ax2 > bx2) fragments.push([bx2 + 1, Math.max(ay1, by1), ax2, Math.min(ay2, by2)] as const); // Right strip
	return fragments.filter(([xmin, ymin, xmax, ymax]) => xmin <= xmax && ymin <= ymax);
};

type SpatialState<T> =
	| { type: 'empty' }
	| { type: 'global'; value: T }
	| { type: 'spatial'; store: RectangleStore<T> };

// Maintains disjoint rectangles via decomposition
// O(n) insert with linear scan and set subtraction
class RectangleStore<T> {
	private items: Array<{ bounds: Rectangle; value: T }> = [];

	insert(bounds: Rectangle, value: T): void {
		// Linear scan to find overlaps - O(m) where m = current rectangle count
		const overlapping = this.items.filter((item) => intersects(bounds, item.bounds));
		this.items = this.items.filter((item) => !overlapping.includes(item));

		// Generate fragments via rectangle decomposition
		const fragments = [{ bounds, value }];
		for (const existing of overlapping) {
			for (const diffBounds of subtract(existing.bounds, bounds)) {
				fragments.push({ bounds: diffBounds, value: existing.value });
			}
		}
		this.items.push(...fragments);
	}

	get isEmpty(): boolean {
		return this.items.length === 0;
	}

	get size(): number {
		return this.items.length;
	}

	all(): Array<{ bounds: Rectangle; value: T }> {
		return [...this.items];
	}
}

/**
 * SpatialIndex: Maintains non-overlapping 2D ranges with last-writer-wins semantics
 *
 * States: empty → global (entire grid) → spatial (RectangleStore with decomposition)
 * Insert: O(m) where m = current range count (linear scan)
 * Query: O(m) returns all ranges
 *
 * Algorithm: Rectangle decomposition via set subtraction (de Berg et al., 2008)
 */
export default class LinearScanImpl<T> implements SpatialIndex<T> {
	private state: SpatialState<T> = { type: 'empty' };

	insert(gridRange: GridRange, value: T): void {
		const { startRowIndex: sr, endRowIndex: er, startColumnIndex: sc, endColumnIndex: ec } = gridRange;

		// Validation
		if (sr !== undefined && er !== undefined && sr >= er) throw new Error(`Invalid range: row ${sr} >= ${er}`);
		if (sc !== undefined && ec !== undefined && sc >= ec) throw new Error(`Invalid range: col ${sc} >= ${ec}`);

		// Global range: entire grid
		if (!sr && !er && !sc && !ec) {
			this.state = { type: 'global', value };
			return;
		}

		// Convert GridRange to Rectangle: [xmin, ymin, xmax, ymax]
		const bounds: Rectangle = [sc ?? 0, sr ?? 0, ec ? ec - 1 : Infinity, er ? er - 1 : Infinity] as const;

		if (this.state.type !== 'spatial') {
			this.state = { type: 'spatial', store: new RectangleStore<T>() };
		}

		this.state.store.insert(bounds, value);
		if (this.state.store.isEmpty) this.state = { type: 'empty' };
	}

	getAllRanges(): Array<{ gridRange: GridRange; value: T }> {
		if (this.state.type === 'global') return [{ gridRange: {}, value: this.state.value }];
		if (this.state.type === 'empty') return [];

		return this.state.store.all().map(({ bounds, value }) => {
			const [xmin, ymin, xmax, ymax] = bounds;
			const gridRange: GridRange = {};

			const isInfiniteRows = ymin === 0 && ymax === Infinity;
			const isInfiniteCols = xmin === 0 && xmax === Infinity;

			if (!isInfiniteRows) {
				gridRange.startRowIndex = ymin;
				gridRange.endRowIndex = ymax === Infinity ? undefined : ymax + 1;
			}
			if (!isInfiniteCols) {
				gridRange.startColumnIndex = xmin;
				gridRange.endColumnIndex = xmax === Infinity ? undefined : xmax + 1;
			}

			return { gridRange, value };
		});
	}

	query(queryRange: GridRange): Array<{ gridRange: GridRange; value: T }> {
		if (this.state.type === 'global') return [{ gridRange: {}, value: this.state.value }];
		if (this.state.type === 'empty') return [];

		// Convert query GridRange to Rectangle for overlap testing
		const { startRowIndex: sr, endRowIndex: er, startColumnIndex: sc, endColumnIndex: ec } = queryRange;
		const queryBounds: Rectangle = [sc ?? 0, sr ?? 0, ec ? ec - 1 : Infinity, er ? er - 1 : Infinity] as const;

		// Linear scan: filter items that intersect query bounds
		return this.state.store.all()
			.filter(({ bounds }) => intersects(bounds, queryBounds))
			.map(({ bounds, value }) => {
				const [xmin, ymin, xmax, ymax] = bounds;
				const gridRange: GridRange = {};

				const isInfiniteRows = ymin === 0 && ymax === Infinity;
				const isInfiniteCols = xmin === 0 && xmax === Infinity;

				if (!isInfiniteRows) {
					gridRange.startRowIndex = ymin;
					gridRange.endRowIndex = ymax === Infinity ? undefined : ymax + 1;
				}
				if (!isInfiniteCols) {
					gridRange.startColumnIndex = xmin;
					gridRange.endColumnIndex = xmax === Infinity ? undefined : xmax + 1;
				}

				return { gridRange, value };
			});
	}

	get isEmpty(): boolean {
		return this.state.type === 'empty';
	}

	getMetrics(): { type: string; size: number } {
		switch (this.state.type) {
			case 'empty':
				return { type: 'empty', size: 0 };
			case 'global':
				return { type: 'global', size: 1 };
			case 'spatial':
				return { type: 'rectangle-store', size: this.state.store.size };
		}
	}
}
