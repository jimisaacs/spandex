/**
 * @module
 *
 * R*-tree (Beckmann, Kriegel, Schneider & Seeger, 1990). Best for n ≥ 100.
 *
 * All of the paper's heuristics are here, and they are what separates an R*-tree
 * from Guttman's original. A tree carrying only some of them is an R-tree with
 * better splits, so the name would overstate it:
 *
 * - **ChooseSubtree** descends by least overlap enlargement where the children
 *   are leaves, by least area enlargement above that.
 * - **ChooseSplitAxis** picks the axis with the smaller summed perimeter over
 *   every candidate distribution, across both edge orderings.
 * - **ChooseSplitIndex** picks the distribution with the least group overlap,
 *   ties to smaller area. Both of the winning axis's orderings stay candidates.
 * - **Forced reinsertion** pulls the 30% of an overflowing node's children
 *   farthest from its center and reinserts them from the root, once per level per
 *   inserted rectangle. Any later overflow at that level splits.
 *
 * **Coordinates**: closed integer intervals, so area counts cells and
 * `[0, 0, 0, 0]` has area 1. Areas are doubles, so past a span of about 10⁹ the
 * area tie-break loses precision and falls through to the next one. Unbounded
 * edges are in the domain; the note above `finiteSpan` says how they rank.
 *
 * **Complexity**: insert is O(log n) per descent, O(log² n) when reinsertion
 * fires. An insert overlapping k stored rectangles places k fragments too, each
 * with its own descent and budget, so O(k log² n) worst case. Query is
 * O(log n + m), degrading toward O(n) as node boxes overlap. Split is O(M²) at
 * M = 10, amortized O(1) per insert.
 *
 * **References**: Beckmann et al. (1990), "The R*-tree: An Efficient and Robust
 * Access Method for Points and Rectangles"; Guttman (1984), "R-trees: A Dynamic
 * Index Structure for Spatial Searching". See docs/analyses/r-star-analysis.md
 * for the split comparison that selected this family.
 */

import { computeExtent } from '../extent.ts';
import { hits, subtractInto } from '../decompose.ts';
import * as r from '../r.ts';
import type { ExtentResult, QueryResult, Rectangle, SpatialIndex } from '../types.ts';

/** Maximum children per node. The paper's M. */
const MAX_ENTRIES = 10;

/**
 * Minimum children per node. The paper's m, at the 40% of M it measured best.
 * `MAX_ENTRIES + 1 >= 2 * MIN_ENTRIES` must hold or no split distribution is
 * legal; `structuralViolations` reports the consequence if it stops holding.
 */
const MIN_ENTRIES = 4;

/**
 * Children removed and reinserted on a level's first overflow, 30% of M.
 * `MAX_ENTRIES + 1 - REINSERT_COUNT >= MIN_ENTRIES` must hold, or reinsertion
 * leaves the drained node underfull.
 */
const REINSERT_COUNT = 3;

/**
 * Rectangle coordinate each sorting slot orders by: x-lower, x-upper, y-lower,
 * y-upper. Slot `s` therefore belongs to axis `s >> 1`.
 */
const SORT_COORD = [0, 2, 1, 3] as const;

interface Node {
	/**
	 * Distance to the leaves: 0 for a leaf, one more than its children above that.
	 * Every leaf at level 0 is what makes the tree balanced, and reinsertion needs
	 * the number to put a removed subtree back at the level it came from.
	 */
	level: number;
	/**
	 * The node's bounding box, owned and rewritten in place. `updateBounds` runs
	 * once per level per descent, so re-minting an array there cost roughly
	 * depth-times-fragments arrays per insert. Nothing aliases it.
	 */
	bounds: Rectangle;
	/** Entry indices when this is a leaf, child node indices otherwise. */
	children: number[];
}

interface Entry<T> {
	bounds: Readonly<Rectangle>;
	value: T;
	active: boolean;
}

/**
 * Every measure below is a pair: how many axes are unbounded, then a magnitude
 * over the axes still finite. Comparisons are lexicographic, count first.
 *
 * One saturating number cannot rank unbounded rectangles. If area returns +∞ for
 * any unbounded box, two such boxes compare equal however differently they are
 * shaped, and a heuristic whose candidates all compare equal takes the first one
 * every time. Whole rows and columns are ordinary input here, so that produced
 * trees whose siblings all spanned the full extent.
 *
 * Nothing in the pair is ever infinite, so no subtraction yields NaN. On
 * all-finite data the count is zero everywhere and only the magnitude decides,
 * which is the comparison the paper defines.
 */

/** Cell count of a closed interval, and 0 when either end is unbounded. */
function finiteSpan(lo: number, hi: number): number {
	return lo === r.negInf || hi === r.posInf ? 0 : hi - lo + 1;
}

/** How many of a rectangle's two axes run to an unbounded end, so cannot prune. */
function unboundedAxes(x1: number, y1: number, x2: number, y2: number): number {
	return (x1 === r.negInf || x2 === r.posInf ? 1 : 0) +
		(y1 === r.negInf || y2 === r.posInf ? 1 : 0);
}

/**
 * Area over the bounded axes. An unbounded axis contributes 1, so it drops out
 * of the product instead of erasing it.
 */
function finiteArea(x1: number, y1: number, x2: number, y2: number): number {
	const w = finiteSpan(x1, x2);
	const h = finiteSpan(y1, y2);
	return (w === 0 ? 1 : w) * (h === 0 ? 1 : h);
}

/**
 * Perimeter over the bounded axes, the paper's margin. Spans are inclusive, and
 * the constant that adds cancels out of every comparison because each axis sums
 * the same number of boxes.
 */
function finiteMargin(x1: number, y1: number, x2: number, y2: number): number {
	return 2 * (finiteSpan(x1, x2) + finiteSpan(y1, y2));
}

/** How many axes of the region two rectangles share are unbounded; 0 when disjoint. */
function sharedAxes(
	ax1: number,
	ay1: number,
	ax2: number,
	ay2: number,
	bx1: number,
	by1: number,
	bx2: number,
	by2: number,
): number {
	const xlo = ax1 > bx1 ? ax1 : bx1;
	const xhi = ax2 < bx2 ? ax2 : bx2;
	if (xlo > xhi) return 0;
	const ylo = ay1 > by1 ? ay1 : by1;
	const yhi = ay2 < by2 ? ay2 : by2;
	if (ylo > yhi) return 0;
	return unboundedAxes(xlo, ylo, xhi, yhi);
}

/**
 * Cells two rectangles share over the bounded axes, and 0 when disjoint. A shared
 * region spans at least one cell, so a disjoint pair still orders below any
 * overlapping one.
 */
function sharedArea(
	ax1: number,
	ay1: number,
	ax2: number,
	ay2: number,
	bx1: number,
	by1: number,
	bx2: number,
	by2: number,
): number {
	const xlo = ax1 > bx1 ? ax1 : bx1;
	const xhi = ax2 < bx2 ? ax2 : bx2;
	if (xlo > xhi) return 0;
	const ylo = ay1 > by1 ? ay1 : by1;
	const yhi = ay2 < by2 ? ay2 : by2;
	if (ylo > yhi) return 0;
	return finiteArea(xlo, ylo, xhi, yhi);
}

/** Lexicographic order on a measure pair, unbounded axis count first. */
function pairLess(aAxes: number, aMagnitude: number, bAxes: number, bMagnitude: number): boolean {
	return aAxes < bAxes || (aAxes === bAxes && aMagnitude < bMagnitude);
}

/**
 * Center of a closed interval, anchored on the finite end when one end is
 * unbounded and on the origin when both are.
 *
 * Reinsertion ranks children by distance from their parent's center, so the
 * value has to be finite for every rectangle in the domain.
 */
function center(lo: number, hi: number): number {
	if (lo === r.negInf) return hi === r.posInf ? 0 : hi;
	return hi === r.posInf ? lo : (lo + hi) / 2;
}

/**
 * R*-tree index with additional introspection methods.
 *
 * Extends `SpatialIndex<T>` with size tracking, tree quality metrics, and a
 * structural self-check.
 */
export interface RStarTreeIndex<T> extends SpatialIndex<T> {
	/** Count of stored rectangles (O(1)) */
	size(): number;
	/** Get R-tree quality metrics for analysis */
	getTreeQualityMetrics(): { depth: number; overlapArea: number; deadSpace: number; nodeCount: number };
	/**
	 * Ways the tree departs from the R-tree invariants, one sentence each, and
	 * empty when it is well formed: every leaf at the same depth, every non-root
	 * node within its child bounds, every node's box exactly its children's
	 * union, every rectangle reachable by exactly one path.
	 *
	 * Walks the whole tree, so it is a diagnostic, not a hot-path call.
	 */
	structuralViolations(): string[];
}

class RStarTreeImpl<T> implements RStarTreeIndex<T> {
	private nodes: Node[] = [];
	private entries: Entry<T>[] = [];
	private rootIdx = -1;
	private _size = 0; // Cached count of active entries
	private deadCount = 0; // Tombstoned entries awaiting compaction
	private extentCached: ExtentResult | null = null;
	/** Bumped by every mutation, so an open query iterator can tell it went stale. */
	private version = 0;

	/** Reused by `insert`; consumed before the call returns. */
	private readonly fragScratch: Array<Readonly<Rectangle>> = [];
	/** Reused by `insert` to hold the entries an incoming rectangle overlaps. */
	private readonly overlapScratch: number[] = [];
	/** Root-to-host node path of the descent in progress. */
	private readonly path: number[] = [];
	/**
	 * Reinsertions queued by the placement in progress, as (payload, host level)
	 * pairs. Drained by `place`.
	 */
	private readonly reinsertQueue: number[] = [];
	/** Levels that have already had their one reinsertion for the current placement. */
	private readonly overflowed: boolean[] = [];
	/** The four candidate child orderings a split scores, reused across splits. */
	private readonly orders: [number[], number[], number[], number[]] = [[], [], [], []];
	/**
	 * Sort keys parallel to the ordering being built, shared by the split
	 * orderings and by reinsertion. Neither runs while the other is ordering.
	 */
	private readonly orderKeys: number[] = [];
	/** Children of the node being drained, ordered by distance from its center. */
	private readonly reinsertOrder: number[] = [];
	/** Bounding box of each ordering's prefix, `prefix[i]` covering children 0 through i. */
	private readonly prefix: [number[], number[], number[], number[]] = [[], [], [], []];
	/** Bounding box of each ordering's suffix, `suffix[i]` covering children i onward. */
	private readonly suffix: [number[], number[], number[], number[]] = [[], [], [], []];

	insert(bounds: Readonly<Rectangle>, value: T): void {
		bounds = r.validated(bounds);

		this.extentCached = null;
		this.version++;

		// The universal rectangle covers every existing entry, so each of them
		// subtracts to nothing. Reset the tree, then fall through: ALL is stored
		// as an ordinary entry so a later overlapping insert decomposes it the
		// same way it decomposes anything else.
		if (r.isAll(bounds)) {
			this.entries = [];
			this.nodes = [];
			this.rootIdx = -1;
			this._size = 0;
			// deadCount counts inactive rows in `entries`; the array just went
			// away, so leaving it set would charge the next insert for
			// tombstones that no longer exist and trigger a needless rebuild.
			this.deadCount = 0;
		}

		const [nx1, ny1, nx2, ny2] = bounds;

		if (this.rootIdx === -1) this.rootIdx = this.createNode(0);

		const overlapping = this.overlapScratch;
		overlapping.length = 0;
		this.searchEntries(this.rootIdx, nx1, ny1, nx2, ny2, overlapping);

		// The scan above is a snapshot and entry indices only grow, so fragments
		// can be placed while walking it without buffering them first.
		for (const entryIdx of overlapping) {
			this.entries[entryIdx]!.active = false;
			this._size--;
			this.deadCount++;
		}

		this.place(r.owned(bounds), value);

		const frags = this.fragScratch;
		for (const idx of overlapping) {
			const entry = this.entries[idx]!;
			const [ex1, ey1, ex2, ey2] = entry.bounds;
			frags.length = 0;
			subtractInto(ex1, ey1, ex2, ey2, nx1, ny1, nx2, ny2, frags);
			for (let i = 0; i < frags.length; i++) {
				this.place(frags[i]!, entry.value);
			}
		}

		overlapping.length = 0;
		this.compactIfNeeded();
	}

	*query(bounds: Readonly<Rectangle> = r.ALL): IterableIterator<QueryResult<T>> {
		bounds = r.validated(bounds);

		const root = this.rootIdx;
		if (root === -1) return;

		const [qx1, qy1, qx2, qy2] = bounds;
		const stamp = this.version;

		// Descends as the caller pulls. Collecting every hit up front made a
		// caller that wanted one result pay for the whole search.
		const stack = [root];
		while (stack.length) {
			this.assertFresh(stamp);
			const node = this.nodes[stack.pop()!]!;
			const [nx1, ny1, nx2, ny2] = node.bounds;

			// Spatial pruning: skip a subtree that cannot hold an answer
			if (!hits(nx1, ny1, nx2, ny2, qx1, qy1, qx2, qy2)) continue;

			const { level, children } = node;
			if (level > 0) {
				// Pushed in reverse so the pop order is the same depth-first
				// order the recursive scan on the insert side produces, which
				// keeps results in the order callers already see.
				for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]!);
				continue;
			}

			for (let i = 0; i < children.length; i++) {
				this.assertFresh(stamp);
				const entry = this.entries[children[i]!]!;
				if (!entry.active) continue;

				const [ex1, ey1, ex2, ey2] = entry.bounds;
				if (hits(ex1, ey1, ex2, ey2, qx1, qy1, qx2, qy2)) yield [entry.bounds, entry.value];
			}
		}
	}

	/**
	 * Refuse to keep walking a tree that changed under an open iterator.
	 *
	 * An insert renumbers node and entry positions, so continuing would read one
	 * generation's positions against another and yield rectangles that were never
	 * stored together. Silent, so it fails loudly here. One comparison per node.
	 */
	private assertFresh(stamp: number): void {
		if (this.version !== stamp) {
			throw new Error('Query iterator invalidated: the index was modified while this query was being iterated.');
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
			const { level, children } = node;

			if (level > 0) {
				// Internal node - measure overlap between sibling subtrees
				for (let i = 0; i < children.length; i++) {
					const childI = this.nodes[children[i]!]!;
					const [ix1, iy1, ix2, iy2] = childI.bounds;

					for (let j = i + 1; j < children.length; j++) {
						const childJ = this.nodes[children[j]!]!;
						const [jx1, jy1, jx2, jy2] = childJ.bounds;

						// Over the bounded axes, so an unbounded overlap counts its
						// finite footprint. Discarding it left this metric blind to
						// the very trees it should flag.
						totalOverlap += sharedArea(ix1, iy1, ix2, iy2, jx1, jy1, jx2, jy2);
					}

					// Recurse into child subtree
					traverse(children[i]!, depth + 1);
				}
			} else {
				// Leaf node - measure dead space over the bounded axes
				const [nx1, ny1, nx2, ny2] = node.bounds;
				const nodeBBoxArea = finiteArea(nx1, ny1, nx2, ny2);

				// Sum the area the leaf's live entries cover. A tombstoned entry
				// still inflates the box and covers nothing, so its area belongs
				// in the dead space rather than against it.
				let totalEntryArea = 0;
				for (const entryIdx of children) {
					const entry = this.entries[entryIdx]!;
					if (!entry.active) continue;
					const [ex1, ey1, ex2, ey2] = entry.bounds;
					totalEntryArea += finiteArea(ex1, ey1, ex2, ey2);
				}

				// Dead space = bbox area - covered area
				// Note: Approximate - doesn't account for entry overlaps
				totalDeadSpace += Math.max(0, nodeBBoxArea - totalEntryArea);
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

	structuralViolations(): string[] {
		const problems: string[] = [];

		if (this.rootIdx === -1) {
			if (this._size !== 0) problems.push(`the tree has no root but reports ${this._size} rectangles`);
			return problems;
		}

		const seen = new Set<number>();
		let live = 0;
		let dead = 0;

		const visit = (nodeIdx: number, expectedLevel: number, isRoot: boolean): void => {
			const node = this.nodes[nodeIdx];
			if (!node) {
				problems.push(`node ${nodeIdx} is referenced as a child but does not exist`);
				return;
			}
			if (node.level !== expectedLevel) {
				problems.push(
					`node ${nodeIdx} sits at level ${node.level} where its parent puts it at ${expectedLevel}, ` +
						`so the leaves are not all at the same depth`,
				);
			}

			const children = node.children;
			const count = children.length;
			if (count > MAX_ENTRIES) {
				problems.push(`node ${nodeIdx} holds ${count} children, above the maximum of ${MAX_ENTRIES}`);
			}
			if (isRoot) {
				if (node.level > 0 && count < 2) {
					problems.push(
						`the root is internal but holds ${count} children, and an internal root needs at least 2`,
					);
				}
			} else if (count < MIN_ENTRIES) {
				problems.push(`node ${nodeIdx} holds ${count} children, below the minimum of ${MIN_ENTRIES}`);
			}
			if (count === 0) return;

			let ux1 = r.posInf, uy1 = r.posInf, ux2 = r.negInf, uy2 = r.negInf;
			for (const childIdx of children) {
				if (node.level === 0) {
					const entry = this.entries[childIdx];
					if (!entry) {
						problems.push(`leaf ${nodeIdx} references entry ${childIdx}, which does not exist`);
						continue;
					}
					if (seen.has(childIdx)) {
						problems.push(`entry ${childIdx} is reachable from more than one leaf`);
					} else {
						seen.add(childIdx);
						if (entry.active) live++;
						else dead++;
					}
					const [x1, y1, x2, y2] = entry.bounds;
					if (x1 < ux1) ux1 = x1;
					if (y1 < uy1) uy1 = y1;
					if (x2 > ux2) ux2 = x2;
					if (y2 > uy2) uy2 = y2;
				} else {
					const child = this.nodes[childIdx];
					if (child) {
						const [x1, y1, x2, y2] = child.bounds;
						if (x1 < ux1) ux1 = x1;
						if (y1 < uy1) uy1 = y1;
						if (x2 > ux2) ux2 = x2;
						if (y2 > uy2) uy2 = y2;
					}
					visit(childIdx, node.level - 1, false);
				}
			}

			const [bx1, by1, bx2, by2] = node.bounds;
			if (bx1 !== ux1 || by1 !== uy1 || bx2 !== ux2 || by2 !== uy2) {
				problems.push(
					`node ${nodeIdx} claims bounds [${bx1}, ${by1}, ${bx2}, ${by2}] but its children cover ` +
						`[${ux1}, ${uy1}, ${ux2}, ${uy2}]`,
				);
			}
		};

		visit(this.rootIdx, this.nodes[this.rootIdx]!.level, true);

		if (live !== this._size) {
			problems.push(`the tree reports ${this._size} rectangles but ${live} live entries are reachable`);
		}
		if (dead !== this.deadCount) {
			problems.push(`the tree reports ${this.deadCount} tombstones but ${dead} are reachable`);
		}
		if (seen.size !== this.entries.length) {
			problems.push(
				`${this.entries.length - seen.size} of ${this.entries.length} entries are unreachable from the root`,
			);
		}

		return problems;
	}

	//#region Node Operations

	/**
	 * Rebuild from the live entries once tombstones outnumber them.
	 *
	 * An overwritten entry is tombstoned rather than removed, so its index stays
	 * in its leaf and its bounds keep inflating that leaf's box. Left alone, a
	 * workload that repeatedly rewrites the same region grows the tree without
	 * bound and defeats pruning: cost tracks every insert the index has ever
	 * seen rather than what it currently holds, which breaks the O(log n) query
	 * this structure exists to provide.
	 *
	 * Rebuilding when `deadCount > _size` bounds dead entries at half the tree.
	 * The rebuild is O(n log n) and needs more than n tombstones to trigger, and
	 * each tombstone came from an insert that already paid a descent, so the cost
	 * is covered and stays O(log n) per insert. The amortization is per tombstone,
	 * not per insert: one insert can tombstone the whole store.
	 */
	private compactIfNeeded(): void {
		if (this.deadCount <= this._size) return;

		const live: Array<Entry<T>> = [];
		for (const entry of this.entries) {
			if (entry.active) live.push(entry);
		}

		// Survivors are adopted, not re-inserted: `place` would mint a second
		// `Entry` per survivor and drop the first.
		this.entries = live;
		this.nodes = [];
		this.rootIdx = -1;
		this._size = live.length;
		this.deadCount = 0;

		if (live.length === 0) return;

		this.rootIdx = this.createNode(0);
		for (let i = 0; i < live.length; i++) {
			this.placePayload(i);
		}
	}

	private createNode(level: number): number {
		const idx = this.nodes.length;
		this.nodes.push({
			level,
			bounds: [0, 0, 0, 0],
			children: [],
		});
		return idx;
	}

	/** Bounds of a child held by a node at `parentLevel`. */
	private childBounds(parentLevel: number, childIdx: number): Readonly<Rectangle> {
		return parentLevel === 0 ? this.entries[childIdx]!.bounds : this.nodes[childIdx]!.bounds;
	}

	private updateBounds(nodeIdx: number): void {
		const node = this.nodes[nodeIdx]!;
		const { level, children } = node;

		if (!children.length) return;

		let xmin: number, ymin: number, xmax: number, ymax: number;

		if (level === 0) {
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

		const b = node.bounds;
		b[0] = xmin;
		b[1] = ymin;
		b[2] = xmax;
		b[3] = ymax;
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

	//#region Insertion

	/**
	 * Store one rectangle, running the R* overflow treatment along the way.
	 *
	 * The paper gives each inserted rectangle a budget of one reinsertion per
	 * level, and that budget is what stops reinsertion from cycling: the second
	 * overflow at a level splits. So the budget resets per `place`, which means a
	 * decomposition's fragments each get their own.
	 */
	private place(rect: Readonly<Rectangle>, value: T): void {
		this.placePayload(this.addEntry(rect, value));
	}

	/** Store an entry that already exists, which is what a rebuild has. */
	private placePayload(entryIdx: number): void {
		if (this.rootIdx === -1) this.rootIdx = this.createNode(0);

		this.overflowed.length = 0;
		const queue = this.reinsertQueue;
		queue.length = 0;

		this.insertPayload(entryIdx, 0);

		// Reinsertion descends from the root, so running it inside the adjust pass
		// would disturb the path that pass is walking. Queueing preserves both the
		// invariants and the chosen order. The queue grows as reinsertions trigger
		// further ones, so `queue.length` is re-read each turn.
		for (let i = 0; i < queue.length; i += 2) {
			this.insertPayload(queue[i]!, queue[i + 1]!);
		}
		queue.length = 0;
	}

	/**
	 * Insert one payload into a node at `hostLevel` and adjust the path back up.
	 *
	 * A payload hosted at level 0 is an entry index; above that it is a node one
	 * level below its host. Reinsertion relies on that, since a subtree pulled
	 * from a level-L node goes back in at level L, keeping the leaves level.
	 */
	private insertPayload(payloadIdx: number, hostLevel: number): void {
		const [px1, py1, px2, py2] = hostLevel === 0
			? this.entries[payloadIdx]!.bounds
			: this.nodes[payloadIdx]!.bounds;

		// ChooseSubtree. The path is recorded so the adjust pass below can walk
		// back up without recursion, and so reinsertion can restart from the
		// root without unwinding a call stack.
		const path = this.path;
		path.length = 0;
		let nodeIdx = this.rootIdx;
		for (;;) {
			path.push(nodeIdx);
			const node = this.nodes[nodeIdx]!;
			if (node.level <= hostLevel) break;
			nodeIdx = node.level === 1
				? this.chooseByOverlap(node.children, px1, py1, px2, py2)
				: this.chooseByEnlargement(node.children, px1, py1, px2, py2);
		}

		this.nodes[nodeIdx]!.children.push(payloadIdx);

		// AdjustTree: tighten each ancestor and treat overflow bottom-up. A
		// split hands its new sibling to the parent through `carried`.
		let carried = -1;
		for (let d = path.length - 1; d >= 0; d--) {
			const idx = path[d]!;
			const node = this.nodes[idx]!;
			if (carried !== -1) {
				node.children.push(carried);
				carried = -1;
			}
			if (node.children.length <= MAX_ENTRIES) {
				this.updateBounds(idx);
				continue;
			}

			// OverflowTreatment: reinsert on a level's first overflow during
			// this placement, and split on any later one. The root never
			// reinserts, because there is nowhere above it to reinsert from.
			if (d > 0 && !this.overflowed[node.level]) {
				this.overflowed[node.level] = true;
				// Reinsertion ranks children by distance from this node's center,
				// so the box must be current. The split branch retightens both
				// halves itself, so tightening first would be a wasted pass.
				this.updateBounds(idx);
				this.reinsertFrom(idx);
			} else {
				carried = this.splitNode(idx);
			}
		}

		if (carried !== -1) {
			const oldRoot = this.rootIdx;
			const newRoot = this.createNode(this.nodes[oldRoot]!.level + 1);
			const rootChildren = this.nodes[newRoot]!.children;
			rootChildren.push(oldRoot, carried);
			this.rootIdx = newRoot;
			this.updateBounds(newRoot);
		}
	}

	/**
	 * ChooseSubtree where the children are leaves: least overlap enlargement,
	 * then least area enlargement, then least area.
	 *
	 * Overlap enlargement is what the paper adds over Guttman here: it keeps
	 * sibling leaves from growing into each other, which is what a query has to
	 * look inside. It costs a pass over every sibling pair, so the paper confines
	 * it to this one level, and so does this.
	 */
	private chooseByOverlap(children: number[], px1: number, py1: number, px2: number, py2: number): number {
		let best = children[0]!;
		let bestOverlapAxes = r.posInf, bestOverlapArea = r.posInf;
		let bestGrowthAxes = r.posInf, bestGrowthArea = r.posInf;
		let bestAxes = r.posInf, bestArea = r.posInf;

		for (let i = 0; i < children.length; i++) {
			const candidate = children[i]!;
			const [cx1, cy1, cx2, cy2] = this.nodes[candidate]!.bounds;
			const ex1 = cx1 < px1 ? cx1 : px1;
			const ey1 = cy1 < py1 ? cy1 : py1;
			const ex2 = cx2 > px2 ? cx2 : px2;
			const ey2 = cy2 > py2 ? cy2 : py2;

			// Summed increase in this child's overlap with each sibling. Enlarging
			// only grows a shared region, so the running pair rises monotonically:
			// once past the best pair the candidate cannot win. That turns the
			// quadratic scan into a small multiple of the child count.
			let deltaAxes = 0, deltaArea = 0;
			let j = 0;
			for (; j < children.length; j++) {
				if (j === i) continue;
				const [sx1, sy1, sx2, sy2] = this.nodes[children[j]!]!.bounds;
				deltaAxes += sharedAxes(ex1, ey1, ex2, ey2, sx1, sy1, sx2, sy2) -
					sharedAxes(cx1, cy1, cx2, cy2, sx1, sy1, sx2, sy2);
				deltaArea += sharedArea(ex1, ey1, ex2, ey2, sx1, sy1, sx2, sy2) -
					sharedArea(cx1, cy1, cx2, cy2, sx1, sy1, sx2, sy2);
				if (pairLess(bestOverlapAxes, bestOverlapArea, deltaAxes, deltaArea)) break;
			}
			if (j < children.length) continue;

			const axes = unboundedAxes(cx1, cy1, cx2, cy2);
			const area = finiteArea(cx1, cy1, cx2, cy2);
			const growthAxes = unboundedAxes(ex1, ey1, ex2, ey2) - axes;
			const growthArea = finiteArea(ex1, ey1, ex2, ey2) - area;

			if (
				pairLess(deltaAxes, deltaArea, bestOverlapAxes, bestOverlapArea) ||
				(deltaAxes === bestOverlapAxes && deltaArea === bestOverlapArea &&
					(pairLess(growthAxes, growthArea, bestGrowthAxes, bestGrowthArea) ||
						(growthAxes === bestGrowthAxes && growthArea === bestGrowthArea &&
							pairLess(axes, area, bestAxes, bestArea))))
			) {
				best = candidate;
				bestOverlapAxes = deltaAxes;
				bestOverlapArea = deltaArea;
				bestGrowthAxes = growthAxes;
				bestGrowthArea = growthArea;
				bestAxes = axes;
				bestArea = area;
			}
		}

		return best;
	}

	/** ChooseSubtree above the leaf level: least area enlargement, then least area. */
	private chooseByEnlargement(children: number[], px1: number, py1: number, px2: number, py2: number): number {
		let best = children[0]!;
		let bestGrowthAxes = r.posInf, bestGrowthArea = r.posInf;
		let bestAxes = r.posInf, bestArea = r.posInf;

		for (let i = 0; i < children.length; i++) {
			const candidate = children[i]!;
			const [cx1, cy1, cx2, cy2] = this.nodes[candidate]!.bounds;
			const ex1 = cx1 < px1 ? cx1 : px1;
			const ey1 = cy1 < py1 ? cy1 : py1;
			const ex2 = cx2 > px2 ? cx2 : px2;
			const ey2 = cy2 > py2 ? cy2 : py2;

			const axes = unboundedAxes(cx1, cy1, cx2, cy2);
			const area = finiteArea(cx1, cy1, cx2, cy2);
			const growthAxes = unboundedAxes(ex1, ey1, ex2, ey2) - axes;
			const growthArea = finiteArea(ex1, ey1, ex2, ey2) - area;

			if (
				pairLess(growthAxes, growthArea, bestGrowthAxes, bestGrowthArea) ||
				(growthAxes === bestGrowthAxes && growthArea === bestGrowthArea &&
					pairLess(axes, area, bestAxes, bestArea))
			) {
				best = candidate;
				bestGrowthAxes = growthAxes;
				bestGrowthArea = growthArea;
				bestAxes = axes;
				bestArea = area;
			}
		}

		return best;
	}

	/**
	 * Forced reinsertion, the R* heuristic that lets a built tree improve as it
	 * grows.
	 *
	 * The children farthest from the node's center are the ones stretching its
	 * box, so those are offered to the tree again from the root. They usually
	 * land elsewhere, and the drained node keeps a tighter box than a split would
	 * have produced. Reinserting the closest of the removed set first is the
	 * variant the paper measured best.
	 */
	private reinsertFrom(nodeIdx: number): void {
		const node = this.nodes[nodeIdx]!;
		const level = node.level;
		const children = node.children;
		const m = children.length;

		const [bx1, by1, bx2, by2] = node.bounds;
		const cx = center(bx1, bx2);
		const cy = center(by1, by2);

		// Decreasing distance from the node's center. Insertion sort, because m is
		// at most MAX_ENTRIES + 1 and a comparator closure allocates per overflow.
		const order = this.reinsertOrder;
		const keys = this.orderKeys;
		order.length = m;
		keys.length = m;
		for (let i = 0; i < m; i++) {
			const childIdx = children[i]!;
			const [x1, y1, x2, y2] = this.childBounds(level, childIdx);
			const dx = center(x1, x2) - cx;
			const dy = center(y1, y2) - cy;
			order[i] = childIdx;
			keys[i] = dx * dx + dy * dy;
		}
		for (let i = 1; i < m; i++) {
			const key = keys[i]!;
			const val = order[i]!;
			let j = i - 1;
			while (j >= 0 && (keys[j]! < key || (keys[j]! === key && order[j]! > val))) {
				keys[j + 1] = keys[j]!;
				order[j + 1] = order[j]!;
				j--;
			}
			keys[j + 1] = key;
			order[j + 1] = val;
		}

		// Keep the closest, in place. `order` is a scratch buffer distinct from the
		// child list, and its first REINSERT_COUNT entries stay readable below.
		const kept = m - REINSERT_COUNT;
		for (let i = 0; i < kept; i++) children[i] = order[i + REINSERT_COUNT]!;
		children.length = kept;
		this.updateBounds(nodeIdx);

		const queue = this.reinsertQueue;
		for (let i = REINSERT_COUNT - 1; i >= 0; i--) {
			queue.push(order[i]!, level);
		}
	}
	//#endregion Insertion

	//#region Splitting

	/**
	 * Order the children into sorting slot `s` by that slot's rectangle edge.
	 *
	 * Insertion sort over at most `MAX_ENTRIES + 1` children, avoiding the
	 * comparator closure `Array.prototype.sort` would need. Equal edges keep the
	 * lower index first, so a split does not depend on append order.
	 */
	private orderBy(children: number[], parentLevel: number, s: number): number[] {
		const order = this.orders[s]!;
		const keys = this.orderKeys;
		const coord = SORT_COORD[s]!;
		const m = children.length;

		order.length = m;
		keys.length = m;
		for (let i = 0; i < m; i++) {
			const childIdx = children[i]!;
			order[i] = childIdx;
			keys[i] = this.childBounds(parentLevel, childIdx)[coord]!;
		}

		for (let i = 1; i < m; i++) {
			const key = keys[i]!;
			const val = order[i]!;
			let j = i - 1;
			while (j >= 0 && (keys[j]! > key || (keys[j]! === key && order[j]! > val))) {
				keys[j + 1] = keys[j]!;
				order[j + 1] = order[j]!;
				j--;
			}
			keys[j + 1] = key;
			order[j + 1] = val;
		}

		return order;
	}

	/**
	 * Fill the prefix and suffix bounding boxes for one ordering. One forward and
	 * one backward pass give both group boxes for every split point in O(1) each,
	 * instead of rescanning both groups per split point.
	 */
	private fillGroupBoxes(order: number[], parentLevel: number, m: number): void {
		const [px1, py1, px2, py2] = this.prefix;
		const [sx1, sy1, sx2, sy2] = this.suffix;
		px1.length =
			py1.length =
			px2.length =
			py2.length =
				m;
		sx1.length =
			sy1.length =
			sx2.length =
			sy2.length =
				m;

		let ax1 = r.posInf, ay1 = r.posInf, ax2 = r.negInf, ay2 = r.negInf;
		for (let i = 0; i < m; i++) {
			const [x1, y1, x2, y2] = this.childBounds(parentLevel, order[i]!);
			if (x1 < ax1) ax1 = x1;
			if (y1 < ay1) ay1 = y1;
			if (x2 > ax2) ax2 = x2;
			if (y2 > ay2) ay2 = y2;
			px1[i] = ax1;
			py1[i] = ay1;
			px2[i] = ax2;
			py2[i] = ay2;
		}

		let bx1 = r.posInf, by1 = r.posInf, bx2 = r.negInf, by2 = r.negInf;
		for (let i = m - 1; i >= 0; i--) {
			const [x1, y1, x2, y2] = this.childBounds(parentLevel, order[i]!);
			if (x1 < bx1) bx1 = x1;
			if (y1 < by1) by1 = y1;
			if (x2 > bx2) bx2 = x2;
			if (y2 > by2) by2 = y2;
			sx1[i] = bx1;
			sy1[i] = by1;
			sx2[i] = bx2;
			sy2[i] = by2;
		}
	}

	/**
	 * Split an overflowing node in two and return the new sibling.
	 *
	 * ChooseSplitAxis scores each axis by the summed perimeter of every candidate
	 * distribution across both of that axis's orderings; ChooseSplitIndex then
	 * takes the distribution with the least group overlap.
	 *
	 * Both stages are scored in one pass over the four orderings. Each axis keeps
	 * its own best distribution and the winning axis's is adopted, which reaches
	 * the same one a second pass would: same visit order, ties still to the first
	 * seen. Rescoring the winner would rebuild group boxes just discarded.
	 */
	private splitNode(nodeIdx: number): number {
		const node = this.nodes[nodeIdx]!;
		const level = node.level;
		const children = node.children;
		const m = children.length;
		const [px1, py1, px2, py2] = this.prefix;
		const [sx1, sy1, sx2, sy2] = this.suffix;

		let bestAxisAxes = r.posInf;
		let bestAxisMargin = r.posInf;
		let bestSlot = 0;
		let bestSplit = MIN_ENTRIES;

		// Whether any child is unbounded at all, read off the union of all of
		// them as soon as the first ordering is accumulated. A group box is
		// unbounded only if one of its children is, so on all-finite data this
		// answers the question once for the whole split instead of counting
		// axes on every candidate distribution and getting zero every time.
		let anyUnbounded = true;

		for (let axis = 0; axis < 2; axis++) {
			let axesSum = 0;
			let marginSum = 0;
			let axisSlot = axis * 2;
			let axisSplit = MIN_ENTRIES;
			let axisOverlapAxes = r.posInf;
			let axisOverlapArea = r.posInf;
			let axisAxes = r.posInf;
			let axisArea = r.posInf;

			for (let edge = 0; edge < 2; edge++) {
				const slot = axis * 2 + edge;
				this.fillGroupBoxes(this.orderBy(children, level, slot), level, m);

				// The last prefix box covers every child, whatever the ordering.
				if (slot === 0) {
					anyUnbounded = unboundedAxes(px1[m - 1]!, py1[m - 1]!, px2[m - 1]!, py2[m - 1]!) !== 0;
				}

				for (let k = MIN_ENTRIES; k <= m - MIN_ENTRIES; k++) {
					const g1x1 = px1[k - 1]!, g1y1 = py1[k - 1]!, g1x2 = px2[k - 1]!, g1y2 = py2[k - 1]!;
					const g2x1 = sx1[k]!, g2y1 = sy1[k]!, g2x2 = sx2[k]!, g2y2 = sy2[k]!;

					// ChooseSplitAxis accumulates this distribution's contribution
					// to the axis score.
					if (anyUnbounded) {
						axesSum += unboundedAxes(g1x1, g1y1, g1x2, g1y2) + unboundedAxes(g2x1, g2y1, g2x2, g2y2);
					}
					marginSum += finiteMargin(g1x1, g1y1, g1x2, g1y2) + finiteMargin(g2x1, g2y1, g2x2, g2y2);

					// ChooseSplitIndex ranks the distribution itself.
					const overlapAxes = anyUnbounded ? sharedAxes(g1x1, g1y1, g1x2, g1y2, g2x1, g2y1, g2x2, g2y2) : 0;
					const overlapArea = sharedArea(g1x1, g1y1, g1x2, g1y2, g2x1, g2y1, g2x2, g2y2);
					const groupAxes = anyUnbounded
						? unboundedAxes(g1x1, g1y1, g1x2, g1y2) + unboundedAxes(g2x1, g2y1, g2x2, g2y2)
						: 0;
					const groupArea = finiteArea(g1x1, g1y1, g1x2, g1y2) + finiteArea(g2x1, g2y1, g2x2, g2y2);

					if (
						pairLess(overlapAxes, overlapArea, axisOverlapAxes, axisOverlapArea) ||
						(overlapAxes === axisOverlapAxes && overlapArea === axisOverlapArea &&
							pairLess(groupAxes, groupArea, axisAxes, axisArea))
					) {
						axisSlot = slot;
						axisSplit = k;
						axisOverlapAxes = overlapAxes;
						axisOverlapArea = overlapArea;
						axisAxes = groupAxes;
						axisArea = groupArea;
					}
				}
			}

			if (pairLess(axesSum, marginSum, bestAxisAxes, bestAxisMargin)) {
				bestAxisAxes = axesSum;
				bestAxisMargin = marginSum;
				bestSlot = axisSlot;
				bestSplit = axisSplit;
			}
		}

		// Written in place: the winning ordering is a scratch buffer, so it is a
		// different array from the node's child list and the sibling's.
		const winner = this.orders[bestSlot]!;
		const siblingIdx = this.createNode(level);
		const sibling = this.nodes[siblingIdx]!.children;
		for (let i = bestSplit; i < m; i++) sibling.push(winner[i]!);
		for (let i = 0; i < bestSplit; i++) children[i] = winner[i]!;
		children.length = bestSplit;

		this.updateBounds(nodeIdx);
		this.updateBounds(siblingIdx);

		return siblingIdx;
	}
	//#endregion Splitting

	//#region Tree Traversal

	/**
	 * Collect the live entries an incoming rectangle overlaps, into `results`.
	 *
	 * Unlike `query` this must finish before anything is read: `insert` tombstones
	 * what it finds and places fragments, renumbering what a lazy walk would be
	 * standing on. The eager snapshot is what makes that safe.
	 */
	private searchEntries(
		nodeIdx: number,
		qx1: number,
		qy1: number,
		qx2: number,
		qy2: number,
		results: number[],
	): void {
		const node = this.nodes[nodeIdx]!;
		const [nx1, ny1, nx2, ny2] = node.bounds;

		// Spatial pruning: skip a subtree that cannot hold an overlap
		if (!hits(nx1, ny1, nx2, ny2, qx1, qy1, qx2, qy2)) return;

		const { level, children } = node;

		if (level === 0) {
			for (const entryIdx of children) {
				const entry = this.entries[entryIdx]!;
				if (!entry.active) continue;

				const [ex1, ey1, ex2, ey2] = entry.bounds;

				if (hits(ex1, ey1, ex2, ey2, qx1, qy1, qx2, qy2)) {
					results.push(entryIdx);
				}
			}
			return;
		}

		for (const childIdx of children) {
			this.searchEntries(childIdx, qx1, qy1, qx2, qy2, results);
		}
	}
	//#endregion Tree Traversal
}

/**
 * Create an R*-tree spatial index.
 *
 * **Best for**: n ≥ 100 ranges (large datasets)
 * **Complexity**: O(log n) insert/query
 *
 * Implements the R* heuristics from Beckmann and colleagues (1990): descend by
 * least overlap enlargement above the leaves, split on the axis with the
 * smallest summed perimeter and at the distribution with the least group
 * overlap, and reinsert a node's outermost children once per level rather than
 * splitting on the first overflow. See BENCHMARKS.md for current measurements.
 *
 * @returns New spatial index instance
 *
 * @example
 * ```typescript
 * import createRStarTreeIndex from '@jim/spandex/index/rstartree';
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
