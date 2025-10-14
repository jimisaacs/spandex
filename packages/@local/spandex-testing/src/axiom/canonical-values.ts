/** Canonical test values: fragment counts from validated implementations */

/**
 * Expected fragment counts for standard scenarios.
 * Derived from Morton and RStarTree (verified correct). Use as oracle.
 */
export const CANONICAL_FRAGMENT_COUNTS = {
	/** Large overlapping pattern (1250 insertions) - primary correctness test */
	LARGE_OVERLAPPING: 1375,
	/** Small overlapping pattern (50 insertions) */
	SMALL_OVERLAPPING: 63,
	/** Diagonal pattern (20 insertions with some overlaps) */
	DIAGONAL: 39,
} as const;
