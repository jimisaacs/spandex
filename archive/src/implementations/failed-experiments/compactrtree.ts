/// <reference types="@types/google-apps-script" />

/**
 * ARCHIVED: 2025-10-07
 * Category: failed-experiments
 * Reason: Educational only - 14x slower than RTreeImpl due to quadratic split overhead
 *
 * Performance data (write-heavy, n=1250): 45.3ms vs RTreeImpl 3.2ms (14x slower)
 * Benchmark stats: Slowest in 9/35 scenarios, fastest in only 1/35 scenarios
 *
 * Educational value: Demonstrates "compact code != fast code" principle
 * Lesson: Functional style with .flatMap/.filter causes significant overhead in
 * performance-critical spatial indexing. Production requires imperative style + TypedArrays.
 *
 * This implementation remains runnable for historical comparison but is not
 * included in the main benchmark suite.
 */

import type { SpatialIndex } from '../../../../src/conformance/testsuite.ts';

/**
 * CompactRTreeImpl: Minimal R-tree implementation
 *
 * ⚠️ Research finding: ~14x slower than RTreeImpl
 * - Quadratic split overhead compounds with fragmentation
 * - Verbose splitting logic is not cache-friendly
 * - Educational value only - not for production use
 *
 * Performance (write-heavy, n=1250): 45.4ms (vs 3.1ms for RTreeImpl)
 *
 * Kept for:
 * - Educational reference (compact OOP style)
 * - Demonstrating "compact ≠ fast" principle
 * - Research comparison baseline
 *
 * Recommendation: Use RTreeImpl or ArrayBufferRTreeImpl instead
 */

type GridRange = GoogleAppsScript.Sheets.Schema.GridRange;
type Rect = readonly [xmin: number, ymin: number, xmax: number, ymax: number];
type Entry<T> = { b: Rect; v: T }; // bounds, value
type Node<T> = { leaf: boolean; e: Entry<T>[]; c: Node<T>[]; bb: Rect | null }; // entries, children, boundingBox

const hits = ([ax1, ay1, ax2, ay2]: Rect, [bx1, by1, bx2, by2]: Rect): boolean =>
	!(ax2 < bx1 || bx2 < ax1 || ay2 < by1 || by2 < ay1);

const cut = ([ax1, ay1, ax2, ay2]: Rect, [bx1, by1, bx2, by2]: Rect): Rect[] => {
	const f: Rect[] = [];
	if (ay1 < by1) f.push([ax1, ay1, ax2, by1 - 1] as const);
	if (ay2 > by2) f.push([ax1, by2 + 1, ax2, ay2] as const);
	if (ax1 < bx1) f.push([ax1, Math.max(ay1, by1), bx1 - 1, Math.min(ay2, by2)] as const);
	if (ax2 > bx2) f.push([bx2 + 1, Math.max(ay1, by1), ax2, Math.min(ay2, by2)] as const);
	return f.filter(([xmin, ymin, xmax, ymax]) => xmin <= xmax && ymin <= ymax);
};

const bbox = (rects: Rect[]): Rect | null => {
	if (rects.length === 0) return null;
	let [xmin, ymin, xmax, ymax] = rects[0];
	for (let i = 1; i < rects.length; i++) {
		const [x1, y1, x2, y2] = rects[i];
		if (x1 < xmin) xmin = x1;
		if (y1 < ymin) ymin = y1;
		if (x2 > xmax) xmax = x2;
		if (y2 > ymax) ymax = y2;
	}
	return [xmin, ymin, xmax, ymax];
};

const mkNode = <T>(leaf: boolean): Node<T> => ({ leaf, e: [], c: [], bb: null });

const updateBB = <T>(n: Node<T>): void => {
	n.bb = n.leaf ? bbox(n.e.map((e) => e.b)) : bbox(n.c.map((c) => c.bb!).filter((b) => b));
};

const searchNode = <T>(n: Node<T>, bounds: Rect): Entry<T>[] => {
	if (!n.bb || !hits(n.bb, bounds)) return [];
	if (n.leaf) return n.e.filter((e) => hits(e.b, bounds));
	return n.c.flatMap((c) => searchNode(c, bounds));
};

const allEntries = <T>(n: Node<T>): Entry<T>[] => n.leaf ? n.e : n.c.flatMap(allEntries);

const removeEntry = <T>(n: Node<T>, entry: Entry<T>): void => {
	if (n.leaf) {
		const idx = n.e.indexOf(entry);
		if (idx >= 0) n.e.splice(idx, 1);
	} else {
		n.c.forEach((c) => removeEntry(c, entry));
	}
	updateBB(n);
};

const splitNode = <T>(n: Node<T>): Node<T> => {
	const mid = n.e.length >> 1;
	const newNode = mkNode<T>(true);
	newNode.e = n.e.splice(mid);
	updateBB(n);
	updateBB(newNode);
	return newNode;
};

const chooseChild = <T>(n: Node<T>, bounds: Rect): Node<T> => {
	let best = n.c[0];
	let minExpansion = Infinity;
	for (const child of n.c) {
		if (!child.bb) continue;
		const [x1, y1, x2, y2] = child.bb;
		const [bx1, by1, bx2, by2] = bounds;
		const expandedArea = (Math.max(x2, bx2) - Math.min(x1, bx1) + 1) * (Math.max(y2, by2) - Math.min(y1, by1) + 1);
		const currentArea = (x2 - x1 + 1) * (y2 - y1 + 1);
		const expansion = expandedArea - currentArea;
		if (expansion < minExpansion) {
			minExpansion = expansion;
			best = child;
		}
	}
	return best;
};

const insertNode = <T>(n: Node<T>, entry: Entry<T>, max: number): Node<T> | null => {
	if (n.leaf) {
		n.e.push(entry);
		updateBB(n);
		return n.e.length > max ? splitNode(n) : null;
	}
	const child = chooseChild(n, entry.b);
	const split = insertNode(child, entry, max);
	if (split) {
		n.c.push(split);
		updateBB(n);
		return n.c.length > max ? splitInternalNode(n) : null;
	}
	updateBB(n);
	return null;
};

const splitInternalNode = <T>(n: Node<T>): Node<T> => {
	const mid = n.c.length >> 1;
	const newNode = mkNode<T>(false);
	newNode.c = n.c.splice(mid);
	updateBB(n);
	updateBB(newNode);
	return newNode;
};

const toGridRange = ([xmin, ymin, xmax, ymax]: Rect): GridRange => ({
	startRowIndex: ymin === -Infinity ? undefined : ymin,
	endRowIndex: ymax === Infinity ? undefined : ymax + 1,
	startColumnIndex: xmin === -Infinity ? undefined : xmin,
	endColumnIndex: xmax === Infinity ? undefined : xmax + 1,
});

const toRect = (g: GridRange): Rect => [
	g.startColumnIndex ?? 0,
	g.startRowIndex ?? 0,
	(g.endColumnIndex ?? Infinity) === Infinity ? Infinity : (g.endColumnIndex ?? Infinity) - 1,
	(g.endRowIndex ?? Infinity) === Infinity ? Infinity : (g.endRowIndex ?? Infinity) - 1,
];

export default class CompactRTreeImpl<T> implements SpatialIndex<T> {
	private state: { type: 'empty' } | { type: 'global'; value: T } | { type: 'spatial'; root: Node<T> } = {
		type: 'empty',
	};
	private max = 10;

	insert(gridRange: GridRange, value: T): void {
		if (
			!gridRange.startRowIndex && !gridRange.endRowIndex && !gridRange.startColumnIndex &&
			!gridRange.endColumnIndex
		) {
			this.state = { type: 'global', value };
			return;
		}

		const bounds = toRect(gridRange);
		const [xmin, ymin, xmax, ymax] = bounds;
		if (xmin > xmax || ymin > ymax) throw new Error('Invalid GridRange');

		if (this.state.type === 'empty') {
			const root = mkNode<T>(true);
			root.e.push({ b: bounds, v: value });
			updateBB(root);
			this.state = { type: 'spatial', root };
			return;
		}

		if (this.state.type === 'global') {
			const root = mkNode<T>(true);
			root.e.push({ b: bounds, v: value });
			updateBB(root);
			this.state = { type: 'spatial', root };
			return;
		}

		const { root } = this.state;
		const overlapping = searchNode(root, bounds);

		overlapping.forEach((e) => removeEntry(root, e));

		const fragments: Entry<T>[] = [{ b: bounds, v: value }];
		for (const existing of overlapping) {
			for (const diffBounds of cut(existing.b, bounds)) {
				fragments.push({ b: diffBounds, v: existing.v });
			}
		}

		for (const fragment of fragments) {
			const split = insertNode(root, fragment, this.max);
			if (split) {
				const newRoot = mkNode<T>(false);
				newRoot.c = [root, split];
				updateBB(newRoot);
				this.state = { type: 'spatial', root: newRoot };
			}
		}
	}

	getAllRanges(): Array<{ gridRange: GridRange; value: T }> {
		if (this.state.type === 'empty') return [];
		if (this.state.type === 'global') {
			return [{ gridRange: {}, value: this.state.value }];
		}
		return allEntries(this.state.root).map((e) => ({ gridRange: toGridRange(e.b), value: e.v }));
	}

	query(gridRange: GridRange): Array<{ gridRange: GridRange; value: T }> {
		if (this.state.type === 'empty') return [];
		if (this.state.type === 'global') {
			return [{ gridRange: {}, value: this.state.value }];
		}
		const bounds = toRect(gridRange);
		return searchNode(this.state.root, bounds).map((e) => ({ gridRange: toGridRange(e.b), value: e.v }));
	}

	get isEmpty(): boolean {
		return this.state.type === 'empty';
	}
}
