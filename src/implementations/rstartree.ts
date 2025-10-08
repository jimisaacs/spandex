/// <reference types="@types/google-apps-script" />

/**
 * RStarTreeImpl: Canonical R*-tree implementation (Beckmann et al., 1990)
 *
 * Hierarchical spatial index using R* split algorithm (minimizes overlap + perimeter).
 * Fastest construction, workload-dependent query performance (see docs/r-star-analysis.md).
 *
 * Algorithm: O(log n) insert/query, O(m log m) split where m=10 max entries per node
 * - Choose axis by minimizing perimeter sum
 * - Choose split by minimizing overlap area
 * - Better tree quality than quadratic split, faster construction than midpoint
 *
 * Optimizations: TypedArrays for coordinates, inline geometric operations, memory pooling
 *
 * Use cases: Large datasets (n ≥ 100), mixed workloads, production systems
 *
 * References:
 * - Beckmann, N. et al. (1990) "The R*-tree: An Efficient and Robust Access Method"
 * - Guttman, A. (1984) "R-trees: A Dynamic Index Structure for Spatial Searching"
 * - See docs/r-star-analysis.md for performance validation
 */

import type { SpatialIndex } from '../conformance/testsuite.ts';

type GridRange = GoogleAppsScript.Sheets.Schema.GridRange;

const COORDS = 4; // [xmin, ymin, xmax, ymax]
const MIN_ENTRIES = 4; // Minimum entries per node (40% fill factor)
const MAX_ENTRIES = 10; // Maximum entries per node (before split)
const NEG_INF = -2147483648;
const POS_INF = 2147483647;

// Performance-critical: Inline AABB intersection test
const hits = (
	ax1: number,
	ay1: number,
	ax2: number,
	ay2: number,
	bx1: number,
	by1: number,
	bx2: number,
	by2: number,
): boolean => !(ax2 < bx1 || bx2 < ax1 || ay2 < by1 || by2 < ay1);

// Geometric subtraction: A \ B → ≤4 disjoint fragments
const subtract = (
	ax1: number,
	ay1: number,
	ax2: number,
	ay2: number,
	bx1: number,
	by1: number,
	bx2: number,
	by2: number,
): Array<readonly [number, number, number, number]> => {
	const fragments: Array<readonly [number, number, number, number]> = [];
	// Top strip
	if (ay1 < by1) fragments.push([ax1, ay1, ax2, by1 - 1]);
	// Bottom strip
	if (ay2 > by2) fragments.push([ax1, by2 + 1, ax2, ay2]);
	// Overlapping Y range for side strips
	const yMin = ay1 > by1 ? ay1 : by1;
	const yMax = ay2 < by2 ? ay2 : by2;
	if (yMin <= yMax) {
		// Left strip
		if (ax1 < bx1) fragments.push([ax1, yMin, bx1 - 1, yMax]);
		// Right strip
		if (ax2 > bx2) fragments.push([bx2 + 1, yMin, ax2, yMax]);
	}
	return fragments;
};

// Area of bounding box (for split heuristics)
const area = (x1: number, y1: number, x2: number, y2: number): number => {
	if (x1 === NEG_INF || x2 === POS_INF || y1 === NEG_INF || y2 === POS_INF) return Infinity;
	return (x2 - x1 + 1) * (y2 - y1 + 1);
};

// Expansion needed to include rect in bbox
const expansion = (
	bx1: number,
	by1: number,
	bx2: number,
	by2: number,
	rx1: number,
	ry1: number,
	rx2: number,
	ry2: number,
): number => {
	const newArea = area(
		bx1 < rx1 ? bx1 : rx1,
		by1 < ry1 ? by1 : ry1,
		bx2 > rx2 ? bx2 : rx2,
		by2 > ry2 ? by2 : ry2,
	);
	const oldArea = area(bx1, by1, bx2, by2);
	return newArea - oldArea;
};

export default class RStarTreeImpl<T> implements SpatialIndex<T> {
	// Node storage: TypedArrays for performance
	private nodeTypes: Uint8Array; // 0=internal, 1=leaf
	private nodeBounds: Int32Array; // [x1,y1,x2,y2] per node
	private nodeChildren: Array<number[]>; // Child indices (node or entry)
	private nodeCount = 0;
	private nodeCapacity: number;

	// Entry storage: TypedArrays for coordinates
	private entryBounds: Int32Array; // [x1,y1,x2,y2] per entry
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
		// Global range (infinite bounds)
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

		const [nx1, ny1, nx2, ny2] = this.toRect(gridRange);
		if (nx1 > nx2 || ny1 > ny2) throw new Error('Invalid GridRange');

		this.globalValue = undefined;

		// Initialize tree if empty
		if (this.rootIdx === -1) {
			this.rootIdx = this.createNode(1); // Leaf
		}

		// Find and remove overlapping entries
		const overlapping = this.searchEntries(this.rootIdx, nx1, ny1, nx2, ny2);

		for (const entryIdx of overlapping) {
			this.entryActive[entryIdx] = 0;
		}

		// Generate fragments (new entry + decomposed overlaps)
		const fragments: Array<[number, number, number, number, T]> = [[nx1, ny1, nx2, ny2, value]];

		for (const idx of overlapping) {
			const base = idx * COORDS;
			const ex1 = this.entryBounds[base];
			const ey1 = this.entryBounds[base + 1];
			const ex2 = this.entryBounds[base + 2];
			const ey2 = this.entryBounds[base + 3];
			const ev = this.entryValues[idx];

			for (const [fx1, fy1, fx2, fy2] of subtract(ex1, ey1, ex2, ey2, nx1, ny1, nx2, ny2)) {
				fragments.push([fx1, fy1, fx2, fy2, ev]);
			}
		}

		// Insert all fragments into tree
		for (const [x1, y1, x2, y2, v] of fragments) {
			const entryIdx = this.addEntry(x1, y1, x2, y2, v);
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
				const base = i * COORDS;
				results.push({
					gridRange: this.toGridRange(
						this.entryBounds[base],
						this.entryBounds[base + 1],
						this.entryBounds[base + 2],
						this.entryBounds[base + 3],
					),
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

		const [qx1, qy1, qx2, qy2] = this.toRect(gridRange);
		const entryIndices = this.searchEntries(this.rootIdx, qx1, qy1, qx2, qy2);

		const results: Array<{ gridRange: GridRange; value: T }> = [];
		for (const idx of entryIndices) {
			const base = idx * COORDS;
			results.push({
				gridRange: this.toGridRange(
					this.entryBounds[base],
					this.entryBounds[base + 1],
					this.entryBounds[base + 2],
					this.entryBounds[base + 3],
				),
				value: this.entryValues[idx],
			});
		}
		return results;
	}

	get isEmpty(): boolean {
		return this.globalValue === undefined && this.rootIdx === -1;
	}

	get size(): number {
		// Count active entries
		let count = 0;
		for (let i = 0; i < this.entryCount; i++) {
			if (this.entryActive[i]) count++;
		}
		return count;
	}

	/**
	 * Tree Quality Metrics (Research/Diagnostic)
	 *
	 * Measures R-tree structural quality:
	 * - depth: Tree height (shallow = faster queries)
	 * - overlapArea: Total overlap between sibling nodes (low = better query selectivity)
	 * - deadSpace: Wasted bounding box area not covering actual entries
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
				// Internal node - measure overlap between sibling subtrees
				for (let i = 0; i < childCount; i++) {
					const childIdxI = children[i];
					const iBase = childIdxI * COORDS;
					const ix1 = this.nodeBounds[iBase];
					const iy1 = this.nodeBounds[iBase + 1];
					const ix2 = this.nodeBounds[iBase + 2];
					const iy2 = this.nodeBounds[iBase + 3];

					for (let j = i + 1; j < childCount; j++) {
						const childIdxJ = children[j];
						const jBase = childIdxJ * COORDS;
						const jx1 = this.nodeBounds[jBase];
						const jy1 = this.nodeBounds[jBase + 1];
						const jx2 = this.nodeBounds[jBase + 2];
						const jy2 = this.nodeBounds[jBase + 3];

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
					traverse(childIdxI, depth + 1);
				}
			} else {
				// Leaf node - measure dead space
				const nodeBase = nodeIdx * COORDS;
				const nodeBBoxArea = area(
					this.nodeBounds[nodeBase],
					this.nodeBounds[nodeBase + 1],
					this.nodeBounds[nodeBase + 2],
					this.nodeBounds[nodeBase + 3],
				);

				if (nodeBBoxArea !== Infinity) {
					// Sum area of all entries in this leaf
					let totalEntryArea = 0;
					for (let i = 0; i < childCount; i++) {
						const entryIdx = children[i];
						const entryBase = entryIdx * COORDS;
						const entryArea = area(
							this.entryBounds[entryBase],
							this.entryBounds[entryBase + 1],
							this.entryBounds[entryBase + 2],
							this.entryBounds[entryBase + 3],
						);
						if (entryArea !== Infinity) {
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

	// ===== NODE OPERATIONS =====

	private createNode(type: number): number {
		const idx = this.nodeCount++;
		this.ensureNodeCapacity(this.nodeCount);

		this.nodeTypes[idx] = type;
		this.nodeChildren[idx] = [];
		// Initialize with invalid bounds
		const base = idx * COORDS;
		this.nodeBounds[base] = 0;
		this.nodeBounds[base + 1] = 0;
		this.nodeBounds[base + 2] = 0;
		this.nodeBounds[base + 3] = 0;

		return idx;
	}

	private updateBounds(nodeIdx: number): void {
		const isLeaf = this.nodeTypes[nodeIdx] === 1;
		const children = this.nodeChildren[nodeIdx];

		if (children.length === 0) return;

		const base = nodeIdx * COORDS;
		let xmin: number, ymin: number, xmax: number, ymax: number;

		if (isLeaf) {
			// Leaf: compute bbox from entry coordinates
			const firstBase = children[0] * COORDS;
			xmin = this.entryBounds[firstBase];
			ymin = this.entryBounds[firstBase + 1];
			xmax = this.entryBounds[firstBase + 2];
			ymax = this.entryBounds[firstBase + 3];

			for (let i = 1; i < children.length; i++) {
				const childBase = children[i] * COORDS;
				const cx1 = this.entryBounds[childBase];
				const cy1 = this.entryBounds[childBase + 1];
				const cx2 = this.entryBounds[childBase + 2];
				const cy2 = this.entryBounds[childBase + 3];
				if (cx1 < xmin) xmin = cx1;
				if (cy1 < ymin) ymin = cy1;
				if (cx2 > xmax) xmax = cx2;
				if (cy2 > ymax) ymax = cy2;
			}
		} else {
			// Internal: compute bbox from child node bounds
			const firstBase = children[0] * COORDS;
			xmin = this.nodeBounds[firstBase];
			ymin = this.nodeBounds[firstBase + 1];
			xmax = this.nodeBounds[firstBase + 2];
			ymax = this.nodeBounds[firstBase + 3];

			for (let i = 1; i < children.length; i++) {
				const childBase = children[i] * COORDS;
				const cx1 = this.nodeBounds[childBase];
				const cy1 = this.nodeBounds[childBase + 1];
				const cx2 = this.nodeBounds[childBase + 2];
				const cy2 = this.nodeBounds[childBase + 3];
				if (cx1 < xmin) xmin = cx1;
				if (cy1 < ymin) ymin = cy1;
				if (cx2 > xmax) xmax = cx2;
				if (cy2 > ymax) ymax = cy2;
			}
		}

		this.nodeBounds[base] = xmin;
		this.nodeBounds[base + 1] = ymin;
		this.nodeBounds[base + 2] = xmax;
		this.nodeBounds[base + 3] = ymax;
	}

	// ===== ENTRY OPERATIONS =====

	private addEntry(x1: number, y1: number, x2: number, y2: number, value: T): number {
		const idx = this.entryCount++;
		this.ensureEntryCapacity(this.entryCount);

		const base = idx * COORDS;
		this.entryBounds[base] = x1;
		this.entryBounds[base + 1] = y1;
		this.entryBounds[base + 2] = x2;
		this.entryBounds[base + 3] = y2;
		this.entryValues[idx] = value;
		this.entryActive[idx] = 1;

		return idx;
	}

	// ===== TREE TRAVERSAL =====

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

		// Internal node: choose subtree with minimum expansion
		const children = this.nodeChildren[nodeIdx];
		const entryBase = entryIdx * COORDS;
		const ex1 = this.entryBounds[entryBase];
		const ey1 = this.entryBounds[entryBase + 1];
		const ex2 = this.entryBounds[entryBase + 2];
		const ey2 = this.entryBounds[entryBase + 3];

		let bestChildIdx = children[0];
		let minExpansion = Infinity;
		let minArea = Infinity;

		for (const childIdx of children) {
			const childBase = childIdx * COORDS;
			const cx1 = this.nodeBounds[childBase];
			const cy1 = this.nodeBounds[childBase + 1];
			const cx2 = this.nodeBounds[childBase + 2];
			const cy2 = this.nodeBounds[childBase + 3];

			const exp = expansion(cx1, cy1, cx2, cy2, ex1, ey1, ex2, ey2);
			const a = area(cx1, cy1, cx2, cy2);

			// Tie-break by smallest area (Guttman heuristic)
			if (exp < minExpansion || (exp === minExpansion && a < minArea)) {
				minExpansion = exp;
				minArea = a;
				bestChildIdx = childIdx;
			}
		}

		const splitIdx = this.insertIntoNode(bestChildIdx, entryIdx);

		if (splitIdx !== -1) {
			// Child split - add sibling
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
		const bounds = isLeaf ? this.entryBounds : this.nodeBounds;

		// R* split algorithm (Beckmann et al., 1990)
		// Choose split axis: test both X and Y, pick the one minimizing perimeter sum

		let bestAxis = 0; // 0=X, 1=Y
		let bestDistribution: number[] = [];
		let minPerimeterSum = Infinity;

		// Test both axes
		for (let axis = 0; axis < 2; axis++) {
			// Sort children by lower bound along this axis
			const sorted = children.slice().sort((a, b) => {
				const aBase = a * COORDS;
				const bBase = b * COORDS;
				return bounds[aBase + axis] - bounds[bBase + axis];
			});

			// Try all distributions with MIN_ENTRIES ≤ k ≤ MAX_ENTRIES
			for (let k = MIN_ENTRIES; k <= children.length - MIN_ENTRIES; k++) {
				const group1 = sorted.slice(0, k);
				const group2 = sorted.slice(k);

				// Compute bounding boxes
				let g1x1 = Infinity, g1y1 = Infinity, g1x2 = -Infinity, g1y2 = -Infinity;
				for (const idx of group1) {
					const base = idx * COORDS;
					const x1 = bounds[base];
					const y1 = bounds[base + 1];
					const x2 = bounds[base + 2];
					const y2 = bounds[base + 3];
					if (x1 < g1x1) g1x1 = x1;
					if (y1 < g1y1) g1y1 = y1;
					if (x2 > g1x2) g1x2 = x2;
					if (y2 > g1y2) g1y2 = y2;
				}

				let g2x1 = Infinity, g2y1 = Infinity, g2x2 = -Infinity, g2y2 = -Infinity;
				for (const idx of group2) {
					const base = idx * COORDS;
					const x1 = bounds[base];
					const y1 = bounds[base + 1];
					const x2 = bounds[base + 2];
					const y2 = bounds[base + 3];
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
					bestDistribution = sorted;
				}
			}
		}

		// Final split: use best axis, minimize overlap
		const sorted = children.slice().sort((a, b) => {
			const aBase = a * COORDS;
			const bBase = b * COORDS;
			return bounds[aBase + bestAxis] - bounds[bBase + bestAxis];
		});

		let bestSplit = MIN_ENTRIES;
		let minOverlap = Infinity;

		// Optimization: Incremental bbox computation (O(m) instead of O(m²))
		// Pre-compute group1 bbox for MIN_ENTRIES
		let g1x1 = Infinity, g1y1 = Infinity, g1x2 = -Infinity, g1y2 = -Infinity;
		for (let i = 0; i < MIN_ENTRIES; i++) {
			const base = sorted[i] * COORDS;
			const x1 = bounds[base];
			const y1 = bounds[base + 1];
			const x2 = bounds[base + 2];
			const y2 = bounds[base + 3];
			if (x1 < g1x1) g1x1 = x1;
			if (y1 < g1y1) g1y1 = y1;
			if (x2 > g1x2) g1x2 = x2;
			if (y2 > g1y2) g1y2 = y2;
		}

		// Pre-compute group2 bbox for MIN_ENTRIES
		let g2x1 = Infinity, g2y1 = Infinity, g2x2 = -Infinity, g2y2 = -Infinity;
		for (let i = MIN_ENTRIES; i < children.length; i++) {
			const base = sorted[i] * COORDS;
			const x1 = bounds[base];
			const y1 = bounds[base + 1];
			const x2 = bounds[base + 2];
			const y2 = bounds[base + 3];
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
			const base = movingIdx * COORDS;
			const x1 = bounds[base];
			const y1 = bounds[base + 1];
			const x2 = bounds[base + 2];
			const y2 = bounds[base + 3];

			// Update group1 bbox (expand)
			if (x1 < g1x1) g1x1 = x1;
			if (y1 < g1y1) g1y1 = y1;
			if (x2 > g1x2) g1x2 = x2;
			if (y2 > g1y2) g1y2 = y2;

			// Update group2 bbox (recompute only if necessary - rare case)
			// For simplicity, recompute group2 each time (still better than O(m²) for all splits)
			g2x1 = Infinity;
			g2y1 = Infinity;
			g2x2 = -Infinity;
			g2y2 = -Infinity;
			for (let i = k; i < children.length; i++) {
				const b = sorted[i] * COORDS;
				const bx1 = bounds[b];
				const by1 = bounds[b + 1];
				const bx2 = bounds[b + 2];
				const by2 = bounds[b + 3];
				if (bx1 < g2x1) g2x1 = bx1;
				if (by1 < g2y1) g2y1 = by1;
				if (bx2 > g2x2) g2x2 = bx2;
				if (by2 > g2y2) g2y2 = by2;
			}

			// Compute overlap
			overlapX = Math.max(0, Math.min(g1x2, g2x2) - Math.max(g1x1, g2x1) + 1);
			overlapY = Math.max(0, Math.min(g1y2, g2y2) - Math.max(g1y1, g2y1) + 1);
			const overlap = overlapX * overlapY;

			if (overlap < minOverlap) {
				minOverlap = overlap;
				bestSplit = k;
			}
		}

		// Create sibling node
		const siblingIdx = this.createNode(isLeaf ? 1 : 0);

		// Assign children using best split
		this.nodeChildren[nodeIdx] = sorted.slice(0, bestSplit);
		this.nodeChildren[siblingIdx] = sorted.slice(bestSplit);

		// Update bounding boxes
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

		const nodeBase = nodeIdx * COORDS;
		const nx1 = this.nodeBounds[nodeBase];
		const ny1 = this.nodeBounds[nodeBase + 1];
		const nx2 = this.nodeBounds[nodeBase + 2];
		const ny2 = this.nodeBounds[nodeBase + 3];

		// Spatial pruning: early exit if no overlap
		if (!hits(nx1, ny1, nx2, ny2, qx1, qy1, qx2, qy2)) return results;

		const isLeaf = this.nodeTypes[nodeIdx] === 1;
		const children = this.nodeChildren[nodeIdx];

		if (isLeaf) {
			// Leaf: accumulate matching entries
			for (const entryIdx of children) {
				if (!this.entryActive[entryIdx]) continue;

				const entryBase = entryIdx * COORDS;
				const ex1 = this.entryBounds[entryBase];
				const ey1 = this.entryBounds[entryBase + 1];
				const ex2 = this.entryBounds[entryBase + 2];
				const ey2 = this.entryBounds[entryBase + 3];

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

	// ===== CONVERSION HELPERS =====

	private toRect(g: GridRange): readonly [number, number, number, number] {
		return [
			g.startColumnIndex ?? 0,
			g.startRowIndex ?? 0,
			(g.endColumnIndex ?? Infinity) === Infinity ? POS_INF : (g.endColumnIndex ?? Infinity) - 1,
			(g.endRowIndex ?? Infinity) === Infinity ? POS_INF : (g.endRowIndex ?? Infinity) - 1,
		];
	}

	private toGridRange(x1: number, y1: number, x2: number, y2: number): GridRange {
		return {
			startRowIndex: y1 === NEG_INF ? undefined : y1,
			endRowIndex: y2 === POS_INF ? undefined : y2 + 1,
			startColumnIndex: x1 === NEG_INF ? undefined : x1,
			endColumnIndex: x2 === POS_INF ? undefined : x2 + 1,
		};
	}

	// ===== CAPACITY MANAGEMENT =====

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
