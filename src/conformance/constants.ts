/**
 * Canonical values for conformance testing
 */

/**
 * Canonical fragment counts for conformance testing.
 *
 * These values are derived from correct implementations (Morton, RStarTree)
 * and serve as regression tests. All implementations must produce these
 * exact fragment counts for the corresponding test scenarios.
 */
export const CANONICAL_FRAGMENT_COUNTS = {
	/** Large overlapping pattern (1250 insertions) - primary correctness test */
	LARGE_OVERLAPPING: 1375,
	/** Small overlapping pattern (50 insertions) */
	SMALL_OVERLAPPING: 63,
	/** Diagonal pattern (20 insertions with some overlaps) */
	DIAGONAL: 39,
} as const;
