/**
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
export const ALL: Readonly<Rectangle> = [negInf, negInf, posInf, posInf];

/**
 * Zero rectangle (degenerate case): single point at origin (0, 0)
 */
export const ZERO: Readonly<Rectangle> = [0, 0, 0, 0];

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
export const NO_EDGES: Readonly<EdgeFlags> = [false, false, false, false];
/** All edges are infinite (rectangle covers entire space) */
export const ALL_EDGES: Readonly<EdgeFlags> = [true, true, true, true];

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
