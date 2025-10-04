/// <reference types="@types/google-apps-script" />

/**
 * ARCHIVED: 2025-10-06
 * Category: failed-experiments
 * Status: ❌ INTENTIONALLY BROKEN - demonstrates why this architecture doesn't work
 *
 * **This is a FAILED EXPERIMENT. Tests FAIL conformance (7 of 13). This is EXPECTED.**
 *
 * **Why this architecture fails:**
 *
 * The hybrid approach (TypedArray storage + separate R-tree index) has a fundamental flaw:
 * when overlapping entries are "deleted," they're only marked in the TypedArray, but the
 * R-tree index still points to them. Rebuilding the R-tree on every insert would be O(n log n),
 * defeating the purpose of having an index.
 *
 * **Conformance test failures** (7 of 13):
 * - Overlap resolution: R-tree returns deleted entries
 * - Last writer wins: Stale index pointers
 * - Edge cases: Global range doesn't clear R-tree
 * - Property-based: Random overlaps expose stale entries
 * - Idempotency: Deleted entries resurface
 * - Fragment generation: Decomposition incomplete
 * - Stress test: Duplicates and overlaps accumulate
 *
 * **Performance findings** (from archive/docs/experiments/hybrid-rtree-results.md):
 * - 1.9-27x slower than specialized implementations (even if it worked)
 * - Indirection overhead between structures nullifies benefits
 *
 * **Architectural lesson:**
 * Combining separate storage + index structures creates synchronization problems.
 * Either store data IN the index (RTreeImpl) or use no index (HilbertLinearScanImpl).
 *
 * **This file is kept for:**
 * - Educational value: shows why hybrid ≠ optimal
 * - Historical reference: documents failed architectural approach
 * - Research honesty: preserves failed experiments
 *
 * **Do not use this implementation.** Use RTreeImpl (n≥100) or HilbertLinearScanImpl (n<100).
 */

import type { SpatialIndex } from '../../../../src/conformance/testsuite.ts';

/**
 * HybridRTreeImpl: TypedArray storage + R-tree spatial index
 *
 * ⚠️ Research finding: 1.9-27x slower than specialized implementations
 * - Indirection overhead between TypedArray and R-tree nullified benefits
 * - Double structure (storage + index) adds complexity without performance gain
 * - Initial implementation failed conformance tests (later fixed for research)
 *
 * Performance (n=1000, overlapping):
 * - HybridRTree: 6.8ms
 * - RTree: 3.6ms (1.9x faster)
 * - ArrayBufferLinearScan: 6.4ms (competitive with hybrid)
 *
 * Kept for:
 * - Research comparison baseline
 * - Demonstrating "hybrid ≠ optimal" architectural principle
 * - Historical reference for failed approach
 * - Educational value (shows why indirection costs matter)
 *
 * Recommendation: Use RTreeImpl (n>1000) or HilbertLinearScanImpl (n<100) instead
 */

type GridRange = GoogleAppsScript.Sheets.Schema.GridRange;
type Rectangle = readonly [xmin: number, ymin: number, xmax: number, ymax: number];

const MAX_ENTRIES = 9;
const MIN_ENTRIES = 4;

interface RTreeNode {
	readonly isLeaf: boolean;
	readonly entries: Array<{ readonly id: number; readonly bbox: Rectangle }>;
	readonly children?: RTreeNode[];
}

/**
 * Hybrid R-tree: TypedArray storage + R-tree index
 *
 * Stores rectangle coordinates in Int32Array for cache locality,
 * while maintaining an R-tree index for spatial queries.
 */
export default class HybridRTreeImpl<T> implements SpatialIndex<T> {
	private coords = new Int32Array(1024); // Pre-allocate, grow as needed
	private values: T[] = [];
	private coordsUsed = 0;
	private root: RTreeNode = { isLeaf: true, entries: [] };

	get isEmpty(): boolean {
		return this.coordsUsed === 0;
	}

	insert(gridRange: GridRange, value: T): void {
		const range = this.toInclusive(gridRange);

		// Find overlapping entries
		const overlaps = this.queryTree(range);

		// Build fragments: new range + decomposed old ranges
		const fragments: Array<{ rect: Rectangle; value: T }> = [{ rect: range, value }];

		for (const id of overlaps) {
			const oldRect = this.getRect(id);
			const oldValue = this.values[id];

			// Decompose OLD range by subtracting NEW range
			for (const frag of this.subtract(oldRect, range)) {
				fragments.push({ rect: frag, value: oldValue });
			}

			// Remove old entry
			this.removeEntry(id);
		}

		// Insert all fragments
		for (const { rect, value: fragValue } of fragments) {
			const id = this.allocateEntry(rect, fragValue);
			this.insertIntoTree(id, rect);
		}
	}

	getAllRanges(): Array<{ gridRange: GridRange; value: T }> {
		const result: Array<{ gridRange: GridRange; value: T }> = [];
		const count = this.coordsUsed / 4;

		for (let id = 0; id < count; id++) {
			const offset = id * 4;

			// Skip deleted entries (marked with MAX_SAFE_INTEGER)
			if (this.coords[offset] === Number.MAX_SAFE_INTEGER) continue;

			const gridRange: GridRange = {
				startRowIndex: this.coords[offset],
				startColumnIndex: this.coords[offset + 1],
				endRowIndex: this.coords[offset + 2] + 1,
				endColumnIndex: this.coords[offset + 3] + 1,
			};
			result.push({ gridRange, value: this.values[id] });
		}

		return result;
	}

	query(gridRange: GridRange): Array<{ gridRange: GridRange; value: T }> {
		const range = this.toInclusive(gridRange);
		const ids = this.queryTree(range);
		return ids.map((id) => {
			const offset = id * 4;
			const gr: GridRange = {
				startRowIndex: this.coords[offset],
				startColumnIndex: this.coords[offset + 1],
				endRowIndex: this.coords[offset + 2] + 1,
				endColumnIndex: this.coords[offset + 3] + 1,
			};
			return { gridRange: gr, value: this.values[id] };
		});
	}

	// --- Internal methods ---

	private toInclusive(gridRange: GridRange): Rectangle {
		return [
			gridRange.startRowIndex ?? 0,
			gridRange.startColumnIndex ?? 0,
			(gridRange.endRowIndex ?? Number.MAX_SAFE_INTEGER) - 1,
			(gridRange.endColumnIndex ?? Number.MAX_SAFE_INTEGER) - 1,
		];
	}

	private allocateEntry(rect: Rectangle, value: T): number {
		const id = this.coordsUsed / 4;

		// Grow array if needed
		if (this.coordsUsed + 4 > this.coords.length) {
			const newCoords = new Int32Array(this.coords.length * 2);
			newCoords.set(this.coords);
			this.coords = newCoords;
		}

		this.coords[this.coordsUsed++] = rect[0];
		this.coords[this.coordsUsed++] = rect[1];
		this.coords[this.coordsUsed++] = rect[2];
		this.coords[this.coordsUsed++] = rect[3];
		this.values.push(value);

		return id;
	}

	private getRect(id: number): Rectangle {
		const offset = id * 4;
		return [
			this.coords[offset],
			this.coords[offset + 1],
			this.coords[offset + 2],
			this.coords[offset + 3],
		];
	}

	private removeEntry(id: number): void {
		// Mark as deleted (simple approach - can optimize later)
		this.coords[id * 4] = Number.MAX_SAFE_INTEGER;
	}

	private insertIntoTree(id: number, rect: Rectangle): void {
		this.root = this.insertNode(this.root, id, rect, 0);
	}

	private insertNode(node: RTreeNode, id: number, rect: Rectangle, depth: number): RTreeNode {
		if (node.isLeaf) {
			const entries = [...node.entries, { id, bbox: rect }];
			if (entries.length <= MAX_ENTRIES) {
				return { isLeaf: true, entries };
			}
			// Split leaf
			return this.splitNode({ isLeaf: true, entries });
		}

		// Find best child
		let bestChild = 0;
		let minEnlargement = Number.MAX_VALUE;

		for (let i = 0; i < node.children!.length; i++) {
			const child = node.children![i];
			const bbox = this.getNodeBBox(child);
			const enlargement = this.enlargement(bbox, rect);
			if (enlargement < minEnlargement) {
				minEnlargement = enlargement;
				bestChild = i;
			}
		}

		const children = [...node.children!];
		children[bestChild] = this.insertNode(children[bestChild], id, rect, depth + 1);

		const entries = children.map((c) => ({ id: 0, bbox: this.getNodeBBox(c) }));

		if (children.length <= MAX_ENTRIES) {
			return { isLeaf: false, entries, children };
		}

		return this.splitNode({ isLeaf: false, entries, children });
	}

	private queryTree(range: Rectangle): number[] {
		const results: number[] = [];
		this.searchNode(this.root, range, results);
		return results;
	}

	private searchNode(node: RTreeNode, range: Rectangle, results: number[]): void {
		for (const entry of node.entries) {
			if (!this.intersects(entry.bbox, range)) continue;

			if (node.isLeaf) {
				// Check if not deleted
				if (this.coords[entry.id * 4] !== Number.MAX_SAFE_INTEGER) {
					results.push(entry.id);
				}
			}
		}

		if (!node.isLeaf) {
			for (let i = 0; i < node.children!.length; i++) {
				if (this.intersects(node.entries[i].bbox, range)) {
					this.searchNode(node.children![i], range, results);
				}
			}
		}
	}

	private splitNode(node: RTreeNode): RTreeNode {
		// Simple midpoint split for now
		const entries = node.isLeaf ? node.entries : node.entries;
		const mid = entries.length >> 1;

		const left = entries.slice(0, mid);
		const right = entries.slice(mid);

		if (node.isLeaf) {
			return {
				isLeaf: false,
				entries: [
					{ id: 0, bbox: this.getBBox(left.map((e) => e.bbox)) },
					{ id: 0, bbox: this.getBBox(right.map((e) => e.bbox)) },
				],
				children: [
					{ isLeaf: true, entries: left },
					{ isLeaf: true, entries: right },
				],
			};
		}

		return {
			isLeaf: false,
			entries: [
				{ id: 0, bbox: this.getBBox(left.map((e) => e.bbox)) },
				{ id: 0, bbox: this.getBBox(right.map((e) => e.bbox)) },
			],
			children: [
				{ isLeaf: false, entries: left, children: node.children!.slice(0, mid) },
				{ isLeaf: false, entries: right, children: node.children!.slice(mid) },
			],
		};
	}

	private subtract(a: Rectangle, b: Rectangle): Rectangle[] {
		if (!this.intersects(a, b)) return [a];

		const [ax1, ay1, ax2, ay2] = a;
		const [bx1, by1, bx2, by2] = b;

		if (bx1 <= ax1 && bx2 >= ax2 && by1 <= ay1 && by2 >= ay2) return [];

		const fragments: Rectangle[] = [];

		if (ax1 < bx1) fragments.push([ax1, ay1, Math.min(bx1 - 1, ax2), ay2]);
		if (ax2 > bx2) fragments.push([Math.max(bx2 + 1, ax1), ay1, ax2, ay2]);
		if (ay1 < by1) fragments.push([Math.max(ax1, bx1), ay1, Math.min(ax2, bx2), Math.min(by1 - 1, ay2)]);
		if (ay2 > by2) fragments.push([Math.max(ax1, bx1), Math.max(by2 + 1, ay1), Math.min(ax2, bx2), ay2]);

		return fragments.filter((f) => f[0] <= f[2] && f[1] <= f[3]);
	}

	private intersects(a: Rectangle, b: Rectangle): boolean {
		return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
	}

	private getNodeBBox(node: RTreeNode): Rectangle {
		return this.getBBox(node.entries.map((e) => e.bbox));
	}

	private getBBox(rects: Rectangle[]): Rectangle {
		let xmin = Number.MAX_SAFE_INTEGER;
		let ymin = Number.MAX_SAFE_INTEGER;
		let xmax = Number.MIN_SAFE_INTEGER;
		let ymax = Number.MIN_SAFE_INTEGER;

		for (const r of rects) {
			if (r[0] < xmin) xmin = r[0];
			if (r[1] < ymin) ymin = r[1];
			if (r[2] > xmax) xmax = r[2];
			if (r[3] > ymax) ymax = r[3];
		}

		return [xmin, ymin, xmax, ymax];
	}

	private enlargement(bbox: Rectangle, rect: Rectangle): number {
		const [x1, y1, x2, y2] = bbox;
		const [rx1, ry1, rx2, ry2] = rect;

		const oldArea = (x2 - x1 + 1) * (y2 - y1 + 1);
		const newArea = (Math.max(x2, rx2) - Math.min(x1, rx1) + 1) * (Math.max(y2, ry2) - Math.min(y1, ry1) + 1);

		return newArea - oldArea;
	}
}
