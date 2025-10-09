/**
 * Core spatial indexing types
 *
 * Academic standard from R-tree and spatial database literature (Guttman 1984, Beckmann et al. 1990).
 * No dependencies on external APIs (Google Sheets, etc.).
 */

/**
 * Rectangle: 2D spatial bounds as [xmin, ymin, xmax, ymax] with closed intervals.
 *
 * **Standard**: R-tree literature (Guttman 1984, Beckmann et al. 1990)
 * **Semantics**: Closed intervals `[min, max]` - both endpoints included
 * **Example**: `[0, 0, 4, 4]` = x:[0,4], y:[0,4] (inclusive)
 * **Format**: Tuple for cache efficiency and TypedArray compatibility
 */
export type Rectangle = readonly [xmin: number, ymin: number, xmax: number, ymax: number];

/**
 * Query result from spatial index (tuple like Map.Entry)
 *
 * @example
 * ```typescript
 * for (const [bounds, value] of index.query(range)) {
 *   console.log(bounds, value);
 * }
 * ```
 */
export type QueryResult<T> = readonly [bounds: Rectangle, value: T];

/**
 * SpatialIndex: Core interface for 2D spatial indexing with last-writer-wins semantics.
 *
 * **Operations**: insert (LWW), query (intersection or all ranges)
 * **Guarantees**: Disjoint partition (no overlapping ranges), O(n) fragment bound
 * **Performance**: Query returns iterator for memory efficiency and early-exit support
 */
export interface SpatialIndex<T> {
	/** Insert value at bounds (last-writer-wins on overlap) */
	insert(bounds: Rectangle, value: T): void;
	/** Query ranges intersecting bounds, or all ranges if bounds undefined. Returns iterator for streaming results. */
	query(bounds?: Rectangle): IterableIterator<QueryResult<T>>;
	/** Check if empty */
	readonly isEmpty: boolean;
}
