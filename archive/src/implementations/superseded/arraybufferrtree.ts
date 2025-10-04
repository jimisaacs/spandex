/// <reference types="@types/google-apps-script" />

/**
 * ARCHIVED: 2025-10-07
 * Category: superseded
 * Reason: Superseded by RTreeImpl (R* split faster, better tree quality)
 *
 * Role: Midpoint split research and algorithm comparison
 * Performance: Fastest in 8/35 scenarios (tied with RTree), but 15% slower construction
 * Superseded by: rtree (R* split algorithm)
 *
 * Research contribution: Validated midpoint split as a simpler alternative to R* split,
 * but R* proved superior in both construction speed and query performance.
 *
 * Performance comparison (n=2500):
 * - Construction: R* 1.92ms vs Midpoint 2.20ms (R* 15% faster)
 * - Queries (overlapping n=1000): R* 15.1ms vs Midpoint 20.3ms (R* 34% faster)
 *
 * See docs/analyses/r-star-analysis.md for detailed comparison.
 *
 * This implementation remains runnable for historical comparison but is not
 * included in the main benchmark suite.
 */

import type { SpatialIndex } from '../../../../src/conformance/testsuite.ts';

/**
 * ArrayBufferRTreeImpl: R-tree using simple midpoint split
 *
 * Research finding: 15% slower construction than R*, workload-dependent query performance.
 * - Construction: R* is faster (1.92ms vs 2.20ms at n=2500)
 * - Queries: Slightly slower on sequential, significantly slower on overlapping (see docs)
 *
 * Algorithm: O(log n) insert/query, O(m) midpoint split where m=10 max entries
 * - Simpler than R* split (no axis selection or overlap minimization)
 * - Faster split computation, but tree quality trade-offs affect queries
 *
 * Implementation: TypedArrays for coordinates, midpoint split, regular arrays for children
 *
 * Use cases: Alternative to R* when simplicity preferred over optimal performance
 *
 * See RTreeImpl for R* split (recommended), docs/r-star-analysis.md for detailed comparison
 */

type GridRange = GoogleAppsScript.Sheets.Schema.GridRange;

const COORDS = 4;
const MAX_ENTRIES = 10;
const NEG_INF = -2147483648;
const POS_INF = 2147483647;

export default class ArrayBufferRTreeImpl<T> implements SpatialIndex<T> {
	// Node metadata
	private nodeTypes: Uint8Array; // 0=internal, 1=leaf
	private nodeBounds: Int32Array; // [x1,y1,x2,y2] per node (HOT PATH)
	private nodeChildren: Array<number[]>; // Child/entry indices per node
	private nodeCount = 0;
	private nodeCapacity: number;

	// Entry storage
	private entryBounds: Int32Array; // [x1,y1,x2,y2] per entry (HOT PATH)
	private entryValues: T[];
	private entryActive: Uint8Array; // 1=active, 0=deleted
	private entryCount = 0;
	private entryCapacity: number;

	private rootIdx = -1;
	private globalValue?: T;

	constructor() {
		this.nodeCapacity = 100;
		this.nodeTypes = new Uint8Array(this.nodeCapacity);
		this.nodeBounds = new Int32Array(this.nodeCapacity * COORDS);
		this.nodeChildren = new Array(this.nodeCapacity);

		this.entryCapacity = 100;
		this.entryBounds = new Int32Array(this.entryCapacity * COORDS);
		this.entryValues = new Array(this.entryCapacity);
		this.entryActive = new Uint8Array(this.entryCapacity);
	}

	insert(gridRange: GridRange, value: T): void {
		// Global range
		if (
			!gridRange.startRowIndex && !gridRange.endRowIndex &&
			!gridRange.startColumnIndex && !gridRange.endColumnIndex
		) {
			this.globalValue = value;
			this.rootIdx = -1;
			this.nodeCount = 0;
			this.entryCount = 0;
			return;
		}

		const bounds = this.toRect(gridRange);
		if (bounds[0] > bounds[2] || bounds[1] > bounds[3]) throw new Error('Invalid GridRange');

		this.globalValue = undefined;

		// Initialize tree if empty
		if (this.rootIdx === -1) {
			this.rootIdx = this.createNode(1); // Leaf
		}

		// Find overlapping entries
		const overlapping = this.searchEntries(this.rootIdx, bounds);

		// Mark overlapping entries as deleted
		for (const entryIdx of overlapping) {
			this.entryActive[entryIdx] = 0;
		}

		// Generate fragments
		const fragments: Array<[number, number, number, number, T]> = [[...bounds, value]];
		for (const idx of overlapping) {
			const oldBounds = this.getEntryBounds(idx);
			const oldValue = this.entryValues[idx];
			for (const frag of this.cut(oldBounds, bounds)) {
				fragments.push([...frag, oldValue]);
			}
		}

		// Insert all fragments
		for (const [x1, y1, x2, y2, v] of fragments) {
			const entryIdx = this.addEntry([x1, y1, x2, y2], v);
			const splitNodeIdx = this.insertIntoNode(this.rootIdx, entryIdx);

			if (splitNodeIdx !== -1) {
				// Root split - create new root
				const newRootIdx = this.createNode(0); // Internal
				this.nodeChildren[newRootIdx] = [this.rootIdx, splitNodeIdx];
				this.updateBounds(newRootIdx);
				this.rootIdx = newRootIdx;
			}
		}
	}

	getAllRanges(): Array<{ gridRange: GridRange; value: T }> {
		if (this.globalValue !== undefined) {
			return [{ gridRange: {}, value: this.globalValue }];
		}

		const results: Array<{ gridRange: GridRange; value: T }> = [];
		for (let i = 0; i < this.entryCount; i++) {
			if (this.entryActive[i]) {
				results.push({
					gridRange: this.toGridRange(this.getEntryBounds(i)),
					value: this.entryValues[i],
				});
			}
		}
		return results;
	}

	query(gridRange: GridRange): Array<{ gridRange: GridRange; value: T }> {
		if (this.globalValue !== undefined) {
			return [{ gridRange: {}, value: this.globalValue }];
		}

		if (this.rootIdx === -1) return [];

		const bounds = this.toRect(gridRange);
		const entryIndices = this.searchEntries(this.rootIdx, bounds);

		return entryIndices.map((idx) => ({
			gridRange: this.toGridRange(this.getEntryBounds(idx)),
			value: this.entryValues[idx],
		}));
	}

	get isEmpty(): boolean {
		return this.globalValue === undefined && this.rootIdx === -1;
	}

	/**
	 * Tree Quality Metrics (Research/Diagnostic)
	 *
	 * Measures R-tree structural quality. See RTreeImpl for detailed implementation.
	 */
	getTreeQualityMetrics(): { depth: number; overlapArea: number; deadSpace: number; nodeCount: number } {
		if (this.rootIdx === -1) {
			return { depth: 0, overlapArea: 0, deadSpace: 0, nodeCount: 0 };
		}

		let maxDepth = 0;
		let totalOverlap = 0;
		let totalDeadSpace = 0;
		let nodeCount = 0;

		const traverse = (nodeIdx: number, depth: number) => {
			nodeCount++;
			maxDepth = Math.max(maxDepth, depth);

			const isLeaf = this.nodeTypes[nodeIdx] === 1;
			const children = this.nodeChildren[nodeIdx];
			const childCount = children.length;

			if (!isLeaf) {
				// Internal node - measure overlap
				for (let i = 0; i < childCount; i++) {
					const childIdxI = children[i];
					const [ix1, iy1, ix2, iy2] = this.getNodeBounds(childIdxI);

					for (let j = i + 1; j < childCount; j++) {
						const childIdxJ = children[j];
						const [jx1, jy1, jx2, jy2] = this.getNodeBounds(childIdxJ);

						const x1 = Math.max(ix1, jx1);
						const y1 = Math.max(iy1, jy1);
						const x2 = Math.min(ix2, jx2);
						const y2 = Math.min(iy2, jy2);

						if (x1 <= x2 && y1 <= y2) {
							totalOverlap += (x2 - x1 + 1) * (y2 - y1 + 1);
						}
					}

					traverse(childIdxI, depth + 1);
				}
			} else {
				// Leaf node - measure dead space
				const [nx1, ny1, nx2, ny2] = this.getNodeBounds(nodeIdx);
				const nodeBBoxArea = (nx2 - nx1 + 1) * (ny2 - ny1 + 1);

				let totalEntryArea = 0;
				for (let i = 0; i < childCount; i++) {
					const entryIdx = children[i];
					const [ex1, ey1, ex2, ey2] = this.getEntryBounds(entryIdx);
					totalEntryArea += (ex2 - ex1 + 1) * (ey2 - ey1 + 1);
				}

				totalDeadSpace += Math.max(0, nodeBBoxArea - totalEntryArea);
			}
		};

		traverse(this.rootIdx, 1);

		return { depth: maxDepth, overlapArea: totalOverlap, deadSpace: totalDeadSpace, nodeCount };
	}

	// Node operations
	private createNode(type: number): number {
		const idx = this.nodeCount++;
		this.ensureNodeCapacity(this.nodeCount);

		this.nodeTypes[idx] = type;
		this.nodeChildren[idx] = [];
		this.setNodeBounds(idx, [0, 0, 0, 0]);

		return idx;
	}

	private setNodeBounds(nodeIdx: number, bounds: readonly [number, number, number, number]): void {
		const idx = nodeIdx * COORDS;
		this.nodeBounds[idx] = bounds[0];
		this.nodeBounds[idx + 1] = bounds[1];
		this.nodeBounds[idx + 2] = bounds[2];
		this.nodeBounds[idx + 3] = bounds[3];
	}

	private getNodeBounds(nodeIdx: number): readonly [number, number, number, number] {
		const idx = nodeIdx * COORDS;
		return [
			this.nodeBounds[idx],
			this.nodeBounds[idx + 1],
			this.nodeBounds[idx + 2],
			this.nodeBounds[idx + 3],
		];
	}

	private updateBounds(nodeIdx: number): void {
		const isLeaf = this.nodeTypes[nodeIdx] === 1;
		const children = this.nodeChildren[nodeIdx];

		if (children.length === 0) return;

		let [xmin, ymin, xmax, ymax] = isLeaf ? this.getEntryBounds(children[0]) : this.getNodeBounds(children[0]);

		for (let i = 1; i < children.length; i++) {
			const bounds = isLeaf ? this.getEntryBounds(children[i]) : this.getNodeBounds(children[i]);
			if (bounds[0] < xmin) xmin = bounds[0];
			if (bounds[1] < ymin) ymin = bounds[1];
			if (bounds[2] > xmax) xmax = bounds[2];
			if (bounds[3] > ymax) ymax = bounds[3];
		}

		this.setNodeBounds(nodeIdx, [xmin, ymin, xmax, ymax]);
	}

	// Entry operations
	private addEntry(bounds: readonly [number, number, number, number], value: T): number {
		const idx = this.entryCount++;
		this.ensureEntryCapacity(this.entryCount);

		const coordIdx = idx * COORDS;
		this.entryBounds[coordIdx] = bounds[0];
		this.entryBounds[coordIdx + 1] = bounds[1];
		this.entryBounds[coordIdx + 2] = bounds[2];
		this.entryBounds[coordIdx + 3] = bounds[3];
		this.entryValues[idx] = value;
		this.entryActive[idx] = 1;

		return idx;
	}

	private getEntryBounds(entryIdx: number): readonly [number, number, number, number] {
		const idx = entryIdx * COORDS;
		return [
			this.entryBounds[idx],
			this.entryBounds[idx + 1],
			this.entryBounds[idx + 2],
			this.entryBounds[idx + 3],
		];
	}

	// Tree operations
	private insertIntoNode(nodeIdx: number, entryIdx: number): number {
		const isLeaf = this.nodeTypes[nodeIdx] === 1;

		if (isLeaf) {
			// Add entry to leaf
			this.nodeChildren[nodeIdx].push(entryIdx);
			this.updateBounds(nodeIdx);

			// Split if over capacity
			if (this.nodeChildren[nodeIdx].length > MAX_ENTRIES) {
				return this.splitNode(nodeIdx);
			}
			return -1;
		}

		// Internal node - choose best child
		const children = this.nodeChildren[nodeIdx];
		const entryBounds = this.getEntryBounds(entryIdx);
		let bestChildIdx = children[0];
		let minExpansion = Infinity;

		for (const childIdx of children) {
			const childBounds = this.getNodeBounds(childIdx);
			const expansion = this.calcExpansion(childBounds, entryBounds);

			if (expansion < minExpansion) {
				minExpansion = expansion;
				bestChildIdx = childIdx;
			}
		}

		const splitIdx = this.insertIntoNode(bestChildIdx, entryIdx);

		if (splitIdx !== -1) {
			// Child split - add new sibling
			this.nodeChildren[nodeIdx].push(splitIdx);
			this.updateBounds(nodeIdx);

			if (this.nodeChildren[nodeIdx].length > MAX_ENTRIES) {
				return this.splitNode(nodeIdx);
			}
		} else {
			this.updateBounds(nodeIdx);
		}

		return -1;
	}

	private splitNode(nodeIdx: number): number {
		const isLeaf = this.nodeTypes[nodeIdx] === 1;
		const children = this.nodeChildren[nodeIdx];
		const mid = children.length >> 1;

		// Create sibling node
		const siblingIdx = this.createNode(isLeaf ? 1 : 0);

		// Move half of children to sibling
		this.nodeChildren[siblingIdx] = children.splice(mid);

		// Update bounding boxes
		this.updateBounds(nodeIdx);
		this.updateBounds(siblingIdx);

		return siblingIdx;
	}

	private searchEntries(nodeIdx: number, queryBounds: readonly [number, number, number, number]): number[] {
		if (nodeIdx === -1) return [];

		const nodeBounds = this.getNodeBounds(nodeIdx);
		if (!this.hits(nodeBounds, queryBounds)) return [];

		const isLeaf = this.nodeTypes[nodeIdx] === 1;
		const children = this.nodeChildren[nodeIdx];

		if (isLeaf) {
			// Return matching entries
			const results: number[] = [];
			for (const entryIdx of children) {
				if (this.entryActive[entryIdx] && this.hits(this.getEntryBounds(entryIdx), queryBounds)) {
					results.push(entryIdx);
				}
			}
			return results;
		}

		// Internal node - search children
		const results: number[] = [];
		for (const childIdx of children) {
			results.push(...this.searchEntries(childIdx, queryBounds));
		}
		return results;
	}

	// Geometry helpers (inlined for performance)
	private hits(
		a: readonly [number, number, number, number],
		b: readonly [number, number, number, number],
	): boolean {
		return !(a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1]);
	}

	private cut(
		a: readonly [number, number, number, number],
		b: readonly [number, number, number, number],
	): Array<readonly [number, number, number, number]> {
		const [ax1, ay1, ax2, ay2] = a;
		const [bx1, by1, bx2, by2] = b;
		const fragments: Array<readonly [number, number, number, number]> = [];

		if (ay1 < by1) fragments.push([ax1, ay1, ax2, by1 - 1]);
		if (ay2 > by2) fragments.push([ax1, by2 + 1, ax2, ay2]);

		const yMin = ay1 > by1 ? ay1 : by1;
		const yMax = ay2 < by2 ? ay2 : by2;

		if (yMin <= yMax) {
			if (ax1 < bx1) fragments.push([ax1, yMin, bx1 - 1, yMax]);
			if (ax2 > bx2) fragments.push([bx2 + 1, yMin, ax2, yMax]);
		}

		return fragments;
	}

	private calcExpansion(
		current: readonly [number, number, number, number],
		newBounds: readonly [number, number, number, number],
	): number {
		const [x1, y1, x2, y2] = current;
		const [nx1, ny1, nx2, ny2] = newBounds;

		const expandedArea = (Math.max(x2, nx2) - Math.min(x1, nx1) + 1) *
			(Math.max(y2, ny2) - Math.min(y1, ny1) + 1);
		const currentArea = (x2 - x1 + 1) * (y2 - y1 + 1);

		return expandedArea - currentArea;
	}

	// Conversion helpers
	private toRect(g: GridRange): readonly [number, number, number, number] {
		return [
			g.startColumnIndex ?? 0,
			g.startRowIndex ?? 0,
			(g.endColumnIndex ?? Infinity) === Infinity ? POS_INF : (g.endColumnIndex ?? Infinity) - 1,
			(g.endRowIndex ?? Infinity) === Infinity ? POS_INF : (g.endRowIndex ?? Infinity) - 1,
		];
	}

	private toGridRange(bounds: readonly [number, number, number, number]): GridRange {
		return {
			startRowIndex: bounds[1] === NEG_INF ? undefined : bounds[1],
			endRowIndex: bounds[3] === POS_INF ? undefined : bounds[3] + 1,
			startColumnIndex: bounds[0] === NEG_INF ? undefined : bounds[0],
			endColumnIndex: bounds[2] === POS_INF ? undefined : bounds[2] + 1,
		};
	}

	// Capacity management
	private ensureNodeCapacity(needed: number): void {
		if (needed <= this.nodeCapacity) return;

		const newCap = Math.max(needed, Math.floor(this.nodeCapacity * 1.5));

		const newTypes = new Uint8Array(newCap);
		const newBounds = new Int32Array(newCap * COORDS);
		const newChildren = new Array(newCap);

		newTypes.set(this.nodeTypes);
		newBounds.set(this.nodeBounds);
		for (let i = 0; i < this.nodeCount; i++) newChildren[i] = this.nodeChildren[i];

		this.nodeTypes = newTypes;
		this.nodeBounds = newBounds;
		this.nodeChildren = newChildren;
		this.nodeCapacity = newCap;
	}

	private ensureEntryCapacity(needed: number): void {
		if (needed <= this.entryCapacity) return;

		const newCap = Math.max(needed, Math.floor(this.entryCapacity * 1.5));

		const newBounds = new Int32Array(newCap * COORDS);
		const newValues = new Array<T>(newCap);
		const newActive = new Uint8Array(newCap);

		newBounds.set(this.entryBounds);
		for (let i = 0; i < this.entryCount; i++) newValues[i] = this.entryValues[i];
		newActive.set(this.entryActive);

		this.entryBounds = newBounds;
		this.entryValues = newValues;
		this.entryActive = newActive;
		this.entryCapacity = newCap;
	}
}
