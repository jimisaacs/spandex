/**
 * @module
 *
 * Rectangle decomposition kernel.
 *
 * This is the geometry that defines the library: inserting a rectangle that
 * overlaps a stored one replaces the stored rectangle with the parts of it the
 * new one does not cover. Every implementation shares this module, because the
 * at-most-four-fragments bound and the canonical fragment counts rest on it and
 * a second copy is how two implementations quietly stop agreeing.
 *
 * **Coordinate domain**: closed integer intervals. Both endpoints are included,
 * and the ±1 arithmetic below is what makes fragments abut without overlapping.
 * `r.validated()` rejects non-integers at the public boundary, so this module
 * never sees them.
 *
 * **Allocation**: the functions take and return scalars. Callers already hold
 * destructured coordinates on the hot path, so a tuple-taking signature would
 * force them to rebuild arrays purely to make the call. `subtractInto` appends
 * into a caller-owned array so a caller can reuse one scratch buffer across
 * inserts instead of allocating a fresh list per overlap.
 *
 * **Ownership**: fragments are frozen before they leave. Implementations store
 * them directly and hand them back out of `query`, so an unfrozen fragment lets
 * a consumer grow one stored rectangle over its neighbours from outside. Same
 * hazard `r.owned` closes for a caller's array, same answer.
 */

import * as r from './r.ts';
import type { Rectangle } from './types.ts';

/**
 * Canonicalize a fragment this module just built and freeze it in place. `r.owned`
 * copies first because its argument belongs to the caller; these arrays are ours,
 * so freezing in place is enough.
 */
function sealed(a: Rectangle): Readonly<Rectangle> {
	const c = r.canonical(a);
	return c === a ? Object.freeze(a) : c;
}

/**
 * True when rectangles A and B share at least one cell.
 *
 * Closed intervals, so touching edges count as intersecting: [0,0,1,1] and
 * [1,1,2,2] both contain the cell (1,1).
 */
export function hits(
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

/**
 * Append the parts of A that B does not cover to `out`, and return how many
 * were appended.
 *
 * At most four fragments are produced: a strip above B, a strip below it, and
 * up to two beside it. The side strips are clipped to the shared row range so
 * they cannot overlap the strips above and below, which is what keeps the
 * output disjoint.
 *
 * A fully covered A produces nothing, which is the common case when a large
 * rectangle is overwritten.
 */
export function subtractInto(
	ax1: number,
	ay1: number,
	ax2: number,
	ay2: number,
	bx1: number,
	by1: number,
	bx2: number,
	by2: number,
	out: Array<Readonly<Rectangle>>,
): number {
	// B covers A entirely: nothing survives.
	if (bx1 <= ax1 && bx2 >= ax2 && by1 <= ay1 && by2 >= ay2) return 0;

	const before = out.length;

	// Strip above B.
	if (ay1 < by1) out.push(sealed([ax1, ay1, ax2, by1 - 1]));
	// Strip below B.
	if (ay2 > by2) out.push(sealed([ax1, by2 + 1, ax2, ay2]));

	// Side strips, clipped to the rows A and B share.
	const yMin = ay1 > by1 ? ay1 : by1;
	const yMax = ay2 < by2 ? ay2 : by2;
	if (yMin <= yMax) {
		if (ax1 < bx1) out.push(sealed([ax1, yMin, bx1 - 1, yMax]));
		if (ax2 > bx2) out.push(sealed([bx2 + 1, yMin, ax2, yMax]));
	}

	return out.length - before;
}
