/**
 * @module
 *
 * RStarTreeImpl: R-tree with R* split algorithm (Beckmann et al., 1990)
 *
 * Hierarchical spatial index using R* split (minimizes perimeter sum, then overlap).
 * Implements classic Guttman insertion with Beckmann split heuristic.
 *
 * **Algorithm**:
 * - Insert: Minimum area enlargement (Guttman, 1984)
 * - Split: R* algorithm - minimize perimeter sum, then minimize overlap (Beckmann et al., 1990)
 * - Note: Does NOT implement forced reinsertion (R* innovation for static data)
 *
 * **Complexity**:
 * - Insert: O(k log n) where k = overlaps. Best O(log n), worst O(n log n)
 * - Query: O(log n) typical, O(√n) worst case
 * - Split: O(m² log m), m=10 → ~400 ops, amortized O(1)
 *
 * **Coordinate system**: Assumes integer coordinates representing discrete cells.
 * - Area uses inclusive bounds: area([x1,y1,x2,y2]) = (x2-x1+1) * (y2-y1+1)
 * - Example: Rectangle [0,0,0,0] has area 1 (single cell)
 *
 * **Use cases**: Large datasets (n ≥ 100), mixed workloads, frequent updates.
 *
 * **References**:
 * - Beckmann, N. et al. (1990) "The R*-tree: An Efficient and Robust Access Method"
 * - Guttman, A. (1984) "R-trees: A Dynamic Index Structure for Spatial Searching"
 * - See docs/analyses/r-star-analysis.md for performance validation
 */

import { computeExtent } from '../extent.ts';
import * as r from '../r.ts';
import type { ExtentResult, QueryResult, Rectangle, SpatialIndex } from '../types.ts';

const MIN_ENTRIES = 4; // Minimum entries per node (40% fill factor)
const MAX_ENTRIES = 10; // Maximum entries per node (before split)

interface Node {
	isLeaf: boolean;
	bounds: Readonly<Rectangle>;
	children: number[]; // node or entry indices
}

interface Entry<T> {
	bounds: Readonly<Rectangle>;
	value: T;
	active: boolean;
}

function hits(
	ax1: number,
	ay1: number,
	ax2: number,
	ay2: number,
	bx1: number,
	by1: number,
	bx2: number,
	by2: number,
): boolean {
	return !(ax2 < bx1 || bx2 < ax1 || ay2 < by1 || by2 < ay1);
}

function subtract(
	ax1: number,
	ay1: number,
	ax2: number,
	ay2: number,
	bx1: number,
	by1: number,
	bx2: number,
	by2: number,
): Array<Readonly<Rectangle>> {
	const fragments: Array<Readonly<Rectangle>> = [];
	if (ay1 < by1) fragments.push(r.canonical([ax1, ay1, ax2, by1 - 1]));
	if (ay2 > by2) fragments.push(r.canonical([ax1, by2 + 1, ax2, ay2]));
	const yMin = ay1 > by1 ? ay1 : by1;
	const yMax = ay2 < by2 ? ay2 : by2;
	if (yMin <= yMax) {
		if (ax1 < bx1) fragments.push(r.canonical([ax1, yMin, bx1 - 1, yMax]));
		if (ax2 > bx2) fragments.push(r.canonical([bx2 + 1, yMin, ax2, yMax]));
	}
	return fragments;
}

function area(x1: number, y1: number, x2: number, y2: number): number {
	if (x1 === r.negInf || x2 === r.posInf || y1 === r.negInf || y2 === r.posInf) return r.posInf;
	return (x2 - x1 + 1) * (y2 - y1 + 1);
}

function expansion(
	bx1: number,
	by1: number,
	bx2: number,
	by2: number,
	rx1: number,
	ry1: number,
	rx2: number,
	ry2: number,
): number {
	const newArea = area(
		bx1 < rx1 ? bx1 : rx1,
		by1 < ry1 ? by1 : ry1,
		bx2 > rx2 ? bx2 : rx2,
		by2 > ry2 ? by2 : ry2,
	);
	const oldArea = area(bx1, by1, bx2, by2);
	return newArea - oldArea;
}

/**
 * R* Tree Index with additional introspection methods.
 *
 * Extends `SpatialIndex<T>` with size tracking and tree quality metrics.
 */
export interface RStarTreeIndex<T> extends SpatialIndex<T> {
	/** Count of stored rectangles (O(1)) */
	size(): number;
	/** Get R-tree quality metrics for analysis */
	getTreeQualityMetrics(): { depth: number; overlapArea: number; deadSpace: number; nodeCount: number };
}

class RStarTreeImpl<T> implements RStarTreeIndex<T> {
	private nodes: Node[] = [];
	private entries: Entry<T>[] = [];
	private rootIdx = -1;
	private isAll = false;
	private _size = 0; // Cached count of active entries
	private extentCached: ExtentResult | null = null;

	/**
	 * MEMORY GROWTH NOTE:
	 * Dead entries (active=false) accumulate in the entries array over time.
	 * This causes linear memory growth with overlapping updates.
	 *
	 * Typical memory usage: ~50 bytes per entry (active + dead)
	 * After 10k overlapping updates: ~250-500KB for dead entries
	 *
	 * For long-running applications with frequent overlaps, consider:
	 * 1. Periodically rebuild the index from scratch (copy active entries to new instance)
	 * 2. Monitor memory usage and trigger rebuild at threshold
	 * 3. Use a different index structure for update-heavy workloads
	 */

	insert(bounds: Readonly<Rectangle>, value: T): void {
		bounds = r.validated(bounds);

		this.extentCached = null;

		// Global range (infinite bounds) - fast path
		if (r.isAll(bounds)) {
			this.entries = [{ bounds: r.ALL, value, active: true }];
			this.nodes = [];
			this.isAll = true;
			this.rootIdx = -1;
			this._size = 1;
			return;
		}

		const [nx1, ny1, nx2, ny2] = bounds;

		if (this.isAll) {
			this.entries = [];
			this._size = 0;
		}
		this.isAll = false;

		if (this.rootIdx === -1) {
			this.rootIdx = this.createNode(true);
		}

		let root = this.rootIdx;

		const overlapping = this.searchEntries(root, nx1, ny1, nx2, ny2);

		// Must generate fragments BEFORE marking inactive (need entry.value)
		const fragments: Array<[Readonly<Rectangle>, T]> = [[bounds, value]];

		for (const idx of overlapping) {
			const entry = this.entries[idx]!;
			const [ex1, ey1, ex2, ey2] = entry.bounds;

			for (const frag of subtract(ex1, ey1, ex2, ey2, nx1, ny1, nx2, ny2)) {
				fragments.push([frag, entry.value]);
			}
		}

		for (const entryIdx of overlapping) {
			this.entries[entryIdx]!.active = false;
			this._size--;
		}

		for (const [rect, v] of fragments) {
			const entryIdx = this.addEntry(rect, v);
			const splitNodeIdx = this.insertIntoNode(root, entryIdx);

			if (splitNodeIdx !== -1) {
				const newRootIdx = this.createNode(false);
				this.nodes[newRootIdx]!.children = [root, splitNodeIdx];
				this.updateBounds(newRootIdx);
				this.rootIdx = newRootIdx;
				root = newRootIdx;
			}
		}
	}

	*query(bounds: Readonly<Rectangle> = r.ALL): IterableIterator<QueryResult<T>> {
		bounds = r.validated(bounds);

		if (this.isAll) {
			yield [r.ALL, this.entries[0]!.value];
			return;
		}

		const root = this.rootIdx;
		if (root === -1) return;

		const [qx1, qy1, qx2, qy2] = bounds;
		const entryIndices = this.searchEntries(root, qx1, qy1, qx2, qy2);

		for (const idx of entryIndices) {
			const entry = this.entries[idx]!;
			yield [entry.bounds, entry.value];
		}
	}

	extent(): ExtentResult {
		return this.extentCached ??= computeExtent(this.query());
	}

	size(): number {
		return this._size;
	}

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

			const node = this.nodes[nodeIdx]!;
			const { isLeaf, children } = node;

			if (!isLeaf) {
				// Internal node - measure overlap between sibling subtrees
				for (let i = 0; i < children.length; i++) {
					const childI = this.nodes[children[i]!]!;
					const [ix1, iy1, ix2, iy2] = childI.bounds;

					for (let j = i + 1; j < children.length; j++) {
						const childJ = this.nodes[children[j]!]!;
						const [jx1, jy1, jx2, jy2] = childJ.bounds;

						// Calculate intersection area
						const x1 = Math.max(ix1, jx1);
						const y1 = Math.max(iy1, jy1);
						const x2 = Math.min(ix2, jx2);
						const y2 = Math.min(iy2, jy2);

						if (x1 <= x2 && y1 <= y2) {
							totalOverlap += area(x1, y1, x2, y2);
						}
					}

					// Recurse into child subtree
					traverse(children[i]!, depth + 1);
				}
			} else {
				// Leaf node - measure dead space
				const [nx1, ny1, nx2, ny2] = node.bounds;
				const nodeBBoxArea = area(nx1, ny1, nx2, ny2);

				if (nodeBBoxArea !== r.posInf) {
					// Sum area of all entries in this leaf
					let totalEntryArea = 0;
					for (const entryIdx of children) {
						const entry = this.entries[entryIdx]!;
						const [ex1, ey1, ex2, ey2] = entry.bounds;
						const entryArea = area(ex1, ey1, ex2, ey2);
						if (entryArea !== r.posInf) {
							totalEntryArea += entryArea;
						}
					}

					// Dead space = bbox area - covered area
					// Note: Approximate - doesn't account for entry overlaps
					totalDeadSpace += Math.max(0, nodeBBoxArea - totalEntryArea);
				}
			}
		};

		traverse(this.rootIdx, 1);

		return {
			depth: maxDepth,
			overlapArea: totalOverlap,
			deadSpace: totalDeadSpace,
			nodeCount,
		};
	}

	//#region Node Operations

	private createNode(isLeaf: boolean): number {
		const idx = this.nodes.length;
		this.nodes.push({
			isLeaf,
			bounds: [0, 0, 0, 0],
			children: [],
		});
		return idx;
	}

	private updateBounds(nodeIdx: number): void {
		const node = this.nodes[nodeIdx]!;
		const { isLeaf, children } = node;

		if (!children.length) return;

		let xmin: number, ymin: number, xmax: number, ymax: number;

		if (isLeaf) {
			// Leaf: compute bbox from entry coordinates
			const [fx1, fy1, fx2, fy2] = this.entries[children[0]!]!.bounds;
			xmin = fx1;
			ymin = fy1;
			xmax = fx2;
			ymax = fy2;

			for (let i = 1; i < children.length; i++) {
				const [cx1, cy1, cx2, cy2] = this.entries[children[i]!]!.bounds;
				if (cx1 < xmin) xmin = cx1;
				if (cy1 < ymin) ymin = cy1;
				if (cx2 > xmax) xmax = cx2;
				if (cy2 > ymax) ymax = cy2;
			}
		} else {
			// Internal: compute bbox from child node bounds
			const [fx1, fy1, fx2, fy2] = this.nodes[children[0]!]!.bounds;
			xmin = fx1;
			ymin = fy1;
			xmax = fx2;
			ymax = fy2;

			for (let i = 1; i < children.length; i++) {
				const [cx1, cy1, cx2, cy2] = this.nodes[children[i]!]!.bounds;
				if (cx1 < xmin) xmin = cx1;
				if (cy1 < ymin) ymin = cy1;
				if (cx2 > xmax) xmax = cx2;
				if (cy2 > ymax) ymax = cy2;
			}
		}

		node.bounds = [xmin, ymin, xmax, ymax];
	}
	//#endregion Node Operations

	//#region Entry Operations

	private addEntry(bounds: Readonly<Rectangle>, value: T): number {
		const idx = this.entries.length;
		this.entries.push({ bounds, value, active: true });
		this._size++;
		return idx;
	}
	//#endregion Entry Operations

	//#region Tree Traversal

	private insertIntoNode(nodeIdx: number, entryIdx: number): number {
		const node = this.nodes[nodeIdx]!;

		if (node.isLeaf) {
			node.children.push(entryIdx);
			this.updateBounds(nodeIdx);

			if (node.children.length > MAX_ENTRIES) {
				return this.splitNode(nodeIdx);
			}
			return -1;
		}

		// Internal node: choose subtree with minimum expansion
		const { children } = node;
		const [ex1, ey1, ex2, ey2] = this.entries[entryIdx]!.bounds;

		let bestChildIdx = children[0];
		let minExpansion = r.posInf;
		let minArea = r.posInf;

		for (const childIdx of children) {
			const [cx1, cy1, cx2, cy2] = this.nodes[childIdx]!.bounds;

			const exp = expansion(cx1, cy1, cx2, cy2, ex1, ey1, ex2, ey2);
			const a = area(cx1, cy1, cx2, cy2);

			// Tie-break by smallest area (Guttman heuristic)
			if (exp < minExpansion || (exp === minExpansion && a < minArea)) {
				minExpansion = exp;
				minArea = a;
				bestChildIdx = childIdx;
			}
		}

		const splitIdx = this.insertIntoNode(bestChildIdx!, entryIdx);

		if (splitIdx !== -1) {
			// Child split - add sibling
			node.children.push(splitIdx);
			this.updateBounds(nodeIdx);

			if (node.children.length > MAX_ENTRIES) {
				return this.splitNode(nodeIdx);
			}
		} else {
			this.updateBounds(nodeIdx);
		}

		return -1;
	}

	private splitNode(nodeIdx: number): number {
		const node = this.nodes[nodeIdx]!;
		const { isLeaf, children } = node;

		// Helper to get bounds for a child index
		const getBounds = (idx: number): Readonly<Rectangle> =>
			isLeaf ? this.entries[idx]!.bounds : this.nodes[idx]!.bounds;

		// R* split algorithm (Beckmann et al., 1990)
		// Phase 1: ChooseSplitAxis - test both X and Y, pick one minimizing perimeter sum (margin)

		let bestAxis = 0; // 0=X, 1=Y
		let minPerimeterSum = r.posInf;

		// Test both axes
		for (let axis = 0; axis < 2; axis++) {
			// Sort children by lower bound along this axis
			const sorted = children.slice().sort((a, b) => {
				return getBounds(a)[axis]! - getBounds(b)[axis]!;
			});

			// Try all distributions with MIN_ENTRIES ≤ k ≤ MAX_ENTRIES
			for (let k = MIN_ENTRIES; k <= children.length - MIN_ENTRIES; k++) {
				const group1 = sorted.slice(0, k);
				const group2 = sorted.slice(k);

				// Compute bounding boxes
				let g1x1 = r.posInf, g1y1 = r.posInf, g1x2 = r.negInf, g1y2 = r.negInf;
				for (const idx of group1) {
					const [x1, y1, x2, y2] = getBounds(idx);
					if (x1 < g1x1) g1x1 = x1;
					if (y1 < g1y1) g1y1 = y1;
					if (x2 > g1x2) g1x2 = x2;
					if (y2 > g1y2) g1y2 = y2;
				}

				let g2x1 = r.posInf, g2y1 = r.posInf, g2x2 = r.negInf, g2y2 = r.negInf;
				for (const idx of group2) {
					const [x1, y1, x2, y2] = getBounds(idx);
					if (x1 < g2x1) g2x1 = x1;
					if (y1 < g2y1) g2y1 = y1;
					if (x2 > g2x2) g2x2 = x2;
					if (y2 > g2y2) g2y2 = y2;
				}

				// Perimeter sum (margin metric from R* paper)
				const perim1 = 2 * ((g1x2 - g1x1) + (g1y2 - g1y1));
				const perim2 = 2 * ((g2x2 - g2x1) + (g2y2 - g2y1));
				const perimeterSum = perim1 + perim2;

				if (perimeterSum < minPerimeterSum) {
					minPerimeterSum = perimeterSum;
					bestAxis = axis;
				}
			}
		}

		// Phase 2: ChooseSplitIndex - along best axis, find split point minimizing overlap
		const sorted = children.slice().sort((a, b) => {
			return getBounds(a)[bestAxis]! - getBounds(b)[bestAxis]!;
		});

		let bestSplit = MIN_ENTRIES;
		let minOverlap = r.posInf;

		// Optimization: Incremental bbox computation reduces cost from O(m²) to O(m·k)
		// where k = number of valid splits (~7 for m=11) → ~77 ops instead of ~121
		// Pre-compute group1 bbox for MIN_ENTRIES
		let g1x1 = r.posInf, g1y1 = r.posInf, g1x2 = r.negInf, g1y2 = r.negInf;
		for (let i = 0; i < MIN_ENTRIES; i++) {
			const [x1, y1, x2, y2] = getBounds(sorted[i]!);
			if (x1 < g1x1) g1x1 = x1;
			if (y1 < g1y1) g1y1 = y1;
			if (x2 > g1x2) g1x2 = x2;
			if (y2 > g1y2) g1y2 = y2;
		}

		// Pre-compute group2 bbox for MIN_ENTRIES
		let g2x1 = r.posInf, g2y1 = r.posInf, g2x2 = r.negInf, g2y2 = r.negInf;
		for (let i = MIN_ENTRIES; i < children.length; i++) {
			const [x1, y1, x2, y2] = getBounds(sorted[i]!);
			if (x1 < g2x1) g2x1 = x1;
			if (y1 < g2y1) g2y1 = y1;
			if (x2 > g2x2) g2x2 = x2;
			if (y2 > g2y2) g2y2 = y2;
		}

		// Evaluate initial split
		let overlapX = Math.max(0, Math.min(g1x2, g2x2) - Math.max(g1x1, g2x1) + 1);
		let overlapY = Math.max(0, Math.min(g1y2, g2y2) - Math.max(g1y1, g2y1) + 1);
		minOverlap = overlapX * overlapY;
		bestSplit = MIN_ENTRIES;

		// Incrementally move entries from group2 to group1
		for (let k = MIN_ENTRIES + 1; k <= children.length - MIN_ENTRIES; k++) {
			const movingIdx = sorted[k - 1]; // Entry being moved from group2 to group1
			const [x1, y1, x2, y2] = getBounds(movingIdx!);

			// Update group1 bbox (expand - always grows or stays same)
			if (x1 < g1x1) g1x1 = x1;
			if (y1 < g1y1) g1y1 = y1;
			if (x2 > g1x2) g1x2 = x2;
			if (y2 > g1y2) g1y2 = y2;

			// Update group2 bbox (must recompute - may shrink)
			// Could optimize with dual-pass or shrink detection, but adds complexity for m=10
			g2x1 = r.posInf;
			g2y1 = r.posInf;
			g2x2 = r.negInf;
			g2y2 = r.negInf;
			for (let i = k; i < children.length; i++) {
				const [bx1, by1, bx2, by2] = getBounds(sorted[i]!);
				if (bx1 < g2x1) g2x1 = bx1;
				if (by1 < g2y1) g2y1 = by1;
				if (bx2 > g2x2) g2x2 = bx2;
				if (by2 > g2y2) g2y2 = by2;
			}

			overlapX = Math.max(0, Math.min(g1x2, g2x2) - Math.max(g1x1, g2x1) + 1);
			overlapY = Math.max(0, Math.min(g1y2, g2y2) - Math.max(g1y1, g2y1) + 1);
			const overlap = overlapX * overlapY;

			if (overlap < minOverlap) {
				minOverlap = overlap;
				bestSplit = k;
			}
		}

		const siblingIdx = this.createNode(isLeaf);

		node.children = sorted.slice(0, bestSplit);
		this.nodes[siblingIdx]!.children = sorted.slice(bestSplit);

		this.updateBounds(nodeIdx);
		this.updateBounds(siblingIdx);

		return siblingIdx;
	}

	private searchEntries(
		nodeIdx: number,
		qx1: number,
		qy1: number,
		qx2: number,
		qy2: number,
		results: number[] = [],
	): number[] {
		if (nodeIdx === -1) return results;

		const node = this.nodes[nodeIdx]!;
		const [nx1, ny1, nx2, ny2] = node.bounds;

		// Spatial pruning: early exit if no overlap
		if (!hits(nx1, ny1, nx2, ny2, qx1, qy1, qx2, qy2)) return results;

		const { isLeaf, children } = node;

		if (isLeaf) {
			// Leaf: accumulate matching entries
			for (const entryIdx of children) {
				const entry = this.entries[entryIdx]!;
				if (!entry.active) continue;

				const [ex1, ey1, ex2, ey2] = entry.bounds;

				if (hits(ex1, ey1, ex2, ey2, qx1, qy1, qx2, qy2)) {
					results.push(entryIdx);
				}
			}
			return results;
		}

		// Internal: recurse into children (accumulator pattern)
		for (const childIdx of children) {
			this.searchEntries(childIdx, qx1, qy1, qx2, qy2, results);
		}
		return results;
	}
	//#endregion Tree Traversal
}

/**
 * Create an R* tree spatial index with optimized split algorithm.
 *
 * **Best for**: n ≥ 100 ranges (large datasets)
 * **Complexity**: O(log n) insert/query
 * **Performance**: ~10µs insert @ n=1000, ~2µs query
 *
 * Uses R*-tree split heuristics (Beckmann et al. 1990) for better tree quality:
 * - Minimize overlap between sibling nodes
 * - Minimize area expansion
 * - Prefer axis with most spread
 *
 * @returns New spatial index instance
 *
 * @example
 * ```typescript
 * import createRStarTreeIndex from '@jim/spandex';
 * import * as r from '@jim/spandex/r';
 *
 * const index = createRStarTreeIndex<string>();
 *
 * // Insert many ranges efficiently
 * for (let i = 0; i < 1000; i++) {
 *   index.insert(r.make(i, i, i+10, i+10), `range_${i}`);
 * }
 *
 * // Fast query with O(log n) complexity
 * for (const [bounds, value] of index.query(r.make(500, 500, 510, 510))) {
 *   console.log(bounds, value);
 * }
 * ```
 */
export default function createRStarTreeIndex<T>(): RStarTreeIndex<T> {
	return new RStarTreeImpl<T>();
}
