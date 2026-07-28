/**
 * @module
 *
 * Rectangle utilities: construction, validation, canonical forms
 *
 * Canonicalization maps structurally equal rectangles to sentinel references (ZERO, ALL).
 * Enables O(1) identity comparison (===) instead of O(k) coordinate comparison.
 */

import type { EdgeFlags, Rectangle } from './types.ts';

// Re-export types that are used in public API
export type { EdgeFlags, Rectangle } from './types.ts';

/** Positive infinity constant for coordinate bounds */
export const posInf: number = Number.POSITIVE_INFINITY;
/** Negative infinity constant for coordinate bounds */
export const negInf: number = Number.NEGATIVE_INFINITY;
/** Test if value is finite (not ±∞ or NaN) */
export const isFin: (value: number) => boolean = Number.isFinite;

/**
 * Universal rectangle covering entire coordinate space: (-∞, +∞) × (-∞, +∞)
 */
export const ALL: Readonly<Rectangle> = Object.freeze([negInf, negInf, posInf, posInf]);

/**
 * Zero rectangle (degenerate case): single point at origin (0, 0)
 */
export const ZERO: Readonly<Rectangle> = Object.freeze([0, 0, 0, 0]);

/**
 * Structural equality: two rectangles are equal iff all coordinates match.
 *
 * Fast path: identity check (===) before coordinate comparison.
 * Complexity: O(1) if identical reference, O(k) otherwise (k=4).
 */
export function isEqual(a: Readonly<Rectangle | EdgeFlags>, b: Readonly<Rectangle | EdgeFlags>): boolean {
	return a === b || (a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3]);
}

/**
 * Test if rectangle is equivalent to ALL (universal rectangle covering entire space).
 *
 * @param a Rectangle to test
 * @returns True if rectangle equals ALL ([-∞, -∞, +∞, +∞])
 */
export function isAll(a: Readonly<Rectangle>): boolean {
	return isEqual(a, ALL);
}

/**
 * Canonicalize rectangle to sentinel reference when structurally equivalent.
 *
 * Maps equivalence classes to canonical representatives:
 * - [0, 0, 0, 0] → ZERO
 * - [-∞, -∞, +∞, +∞] → ALL
 * - otherwise → identity
 *
 * Enables fast equality checks via reference identity (===).
 *
 * **INTERNAL USE**: Does NOT validate coordinates (for performance).
 * Use `validated()` for user-facing APIs.
 */
export function canonical(a: Readonly<Rectangle>): Readonly<Rectangle> {
	return isEqual(a, ZERO) ? ZERO : isEqual(a, ALL) ? ALL : a;
}

/**
 * Validate and canonicalize rectangle (public API entry point).
 *
 * 1. Validates coordinates (throws if xmin > xmax or ymin > ymax)
 * 2. Canonicalizes to sentinel references (ZERO, ALL)
 *
 * **Usage**: User-facing APIs (insert, query args)
 * **Internal**: Use `canonical()` for known-valid rectangles
 *
 * @throws Error if rectangle coordinates are invalid
 */
export function validated(a: Readonly<Rectangle>): Readonly<Rectangle> {
	const [xmin, ymin, xmax, ymax] = a;
	// Coordinates address discrete cells, and decomposition relies on that: a
	// fragment abutting B starts at `bx1 - 1`, which only lands adjacent to B
	// when coordinates are whole. A fractional bound makes that arithmetic
	// produce an inverted or gap-leaving fragment, so it is refused here rather
	// than stored as a rectangle this function would itself reject.
	// The domain is the integers plus the two infinities. Testing for that
	// directly also refuses NaN, which no ordering comparison can catch: every
	// comparison against NaN is false, so an inverted-bounds check passes it and
	// so does the disjointness axiom. A NaN rectangle reaches decomposition,
	// where the full-cover test and all four fragment guards are equally false,
	// and the overlapping rectangle is dropped without being covered.
	for (const c of a) {
		if (!Number.isInteger(c) && c !== negInf && c !== posInf) {
			throw new Error(
				`Invalid rectangle: coordinate ${c} is not an integer. ` +
					`Coordinates address discrete cells; use ±Infinity for unbounded edges.`,
			);
		}
	}
	// An unbounded edge has to open outward. `xmin` at +∞ or `xmax` at -∞ passes
	// the ordering check when both ends share an infinity, but names no cell at
	// all, and every consumer then drops it silently.
	if (xmin === posInf || xmax === negInf || ymin === posInf || ymax === negInf) {
		throw new Error(
			`Invalid rectangle: an unbounded edge must open outward. ` +
				`Use -Infinity only for xmin/ymin and +Infinity only for xmax/ymax.`,
		);
	}
	if (xmin > xmax) {
		throw new Error(
			`Invalid rectangle: xmin (${xmin}) > xmax (${xmax}). ` +
				`Coordinates must satisfy xmin ≤ xmax.`,
		);
	}
	if (ymin > ymax) {
		throw new Error(
			`Invalid rectangle: ymin (${ymin}) > ymax (${ymax}). ` +
				`Coordinates must satisfy ymin ≤ ymax.`,
		);
	}
	return canonical(a);
}

/**
 * Return a rectangle the index can retain safely.
 *
 * `validated()` and `canonical()` hand back the caller's own array when it is
 * not a sentinel, so storing that result would let the caller keep a live
 * reference into the index and mutate stored bounds afterwards. That breaks
 * disjointness from outside, where no invariant check can see it coming.
 *
 * Sentinels are already frozen and shared, so they are returned as-is; every
 * other rectangle is copied once and frozen. This is the one copy on the
 * retention path, and `query` does not pay it.
 */
export function owned(a: Readonly<Rectangle>): Readonly<Rectangle> {
	const c = canonical(a);
	if (c === ZERO || c === ALL) return c;
	return Object.freeze([c[0], c[1], c[2], c[3]]) as Readonly<Rectangle>;
}

/**
 * Construct rectangle from coordinates with default unbounded values.
 *
 * Undefined coordinates default to infinite bounds:
 * - xmin, ymin → -∞ (unbounded minimum)
 * - xmax, ymax → +∞ (unbounded maximum)
 *
 * @returns Validated and canonical rectangle (sentinel reference if equivalent to ZERO/ALL)
 */
export function make(xmin = negInf, ymin = negInf, xmax = posInf, ymax = posInf): Readonly<Rectangle> {
	return validated([xmin, ymin, xmax, ymax]);
}

/**
 * Test if rectangle `a` fully contains rectangle `b`.
 *
 * @param a Container rectangle
 * @param b Contained rectangle
 * @returns True if `a` spatially contains `b` (all bounds of `b` within `a`)
 */
export function contains(a: Readonly<Rectangle>, b: Readonly<Rectangle>): boolean {
	const [ax, ay, ax2, ay2] = a;
	const [bx, by, bx2, by2] = b;
	return ax <= bx && ay <= by && ax2 >= bx2 && ay2 >= by2;
}

/** No edges are infinite (all bounds are finite) */
export const NO_EDGES: Readonly<EdgeFlags> = Object.freeze([false, false, false, false]);
/** All edges are infinite (rectangle covers entire space) */
export const ALL_EDGES: Readonly<EdgeFlags> = Object.freeze([true, true, true, true]);

/**
 * Canonicalize EdgeFlags to sentinel reference when structurally equivalent.
 *
 * Maps equivalence classes to canonical representatives:
 * - [false, false, false, false] → NO_EDGES
 * - [true, true, true, true] → ALL_EDGES
 * - otherwise → identity
 *
 * Enables fast equality checks via reference identity (===).
 *
 * @param a EdgeFlags to canonicalize
 * @returns Canonical EdgeFlags reference
 */
export function canonicalEdges(a: Readonly<EdgeFlags>): Readonly<EdgeFlags> {
	return isEqual(a, NO_EDGES) ? NO_EDGES : isEqual(a, ALL_EDGES) ? ALL_EDGES : a;
}
