/**
 * Rectangle utilities and canonical forms.
 *
 * Provides sentinel values (ALL, ZERO) and operations for rectangle construction,
 * comparison, and canonicalization. Canonicalization enables fast identity checks
 * by ensuring equivalent rectangles share the same reference.
 *
 * **Canonical forms**: Equivalence classes under structural equality are represented
 * by unique sentinel objects, enabling O(1) identity comparison instead of O(k)
 * coordinate comparison (where k=4 for 2D rectangles).
 */

import type { Rectangle } from './types.ts';

/**
 * Universal rectangle covering entire coordinate space: (-∞, +∞) × (-∞, +∞)
 */
export const ALL: Rectangle = [-Infinity, -Infinity, Infinity, Infinity];

/**
 * Zero rectangle (degenerate case): single point at origin (0, 0)
 */
export const ZERO: Rectangle = [0, 0, 0, 0];

/**
 * Structural equality: two rectangles are equal iff all coordinates match.
 *
 * Fast path: identity check (===) before coordinate comparison.
 * Complexity: O(1) if identical reference, O(k) otherwise (k=4).
 */
export function isEqual(a: Rectangle, b: Rectangle): boolean {
	return a === b || (a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3]);
}

/** Check if rectangle is structurally equal to ZERO. */
export function isZero(a: Rectangle): boolean {
	return isEqual(a, ZERO);
}

/** Check if rectangle is structurally equal to ALL. */
export function isAll(a: Rectangle): boolean {
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
export function canonicalized(a: Rectangle): Rectangle {
	return isEqual(a, ZERO) ? ZERO : isEqual(a, ALL) ? ALL : a;
}

/**
 * Validate and canonicalize rectangle (public API entry point).
 *
 * 1. Validates coordinates (throws if xmin > xmax or ymin > ymax)
 * 2. Canonicalizes to sentinel references (ZERO, ALL)
 *
 * Use this for all user-facing APIs (insert, etc.).
 * For internal operations on known-valid rectangles, use `canonicalized()`.
 *
 * @throws Error if rectangle coordinates are invalid
 */
export function validated(a: Rectangle): Rectangle {
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
	return canonicalized(a);
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
export function rect(xmin = -Infinity, ymin = -Infinity, xmax = Infinity, ymax = Infinity): Rectangle {
	return validated([xmin, ymin, xmax, ymax]);
}
