/**
 * Core spatial indexing types
 *
 * Academic standard from R-tree literature (Guttman 1984, Beckmann et al. 1990).
 * Zero external API dependencies.
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
 * **Guarantees**: Disjoint partition, ≤4n fragments after n insertions (worst case)
 * **Performance**: Query returns iterator for memory efficiency and early-exit support
 */
export interface SpatialIndex<T> {
	/** Insert value at bounds (last-writer-wins on overlap) */
	insert(bounds: Rectangle, value: T): void;
	/** Query ranges intersecting bounds, or all ranges if bounds undefined. Returns iterator for streaming results. */
	query(bounds?: Rectangle): IterableIterator<QueryResult<T>>;
}

/**
 * Factory function for creating spatial index instances.
 * Allows caller to specify which underlying index implementation to use.
 */
export type IndexFactory = <V>() => SpatialIndex<V>;

/**
 * Partitioned query result from spatial index (tuple with labeled elements).
 *
 * Consistent with `QueryResult<T>` but returns `Partial<T>` since each
 * partition may only have some attributes defined.
 *
 * @example
 * ```typescript
 * for (const [bounds, attributes] of index.query(rect)) {
 *   console.log(bounds, attributes.background);
 * }
 * ```
 */
export type PartitionedQueryResult<T extends Record<string, unknown>> = QueryResult<Partial<T>>;

/**
 * Partitioned Spatial Index Interface
 *
 * Manages independent per-attribute spatial partitions with type-safe access.
 * Each attribute gets its own spatial index partition, enabling efficient
 * storage and querying of sparse, multi-attribute spatial data.
 *
 * **Pattern**: Vertical partitioning with spatial join on query
 *
 * **Use cases**:
 * - Spreadsheet cell properties (each property = partition)
 * - GIS layered data (each layer = partition)
 * - Multi-attribute spatial databases
 *
 * @template T - Record type mapping attribute keys to their value types
 */
export interface PartitionedSpatialIndex<T extends Record<string, unknown>> extends SpatialIndex<Partial<T>> {
	/**
	 * Insert a value for a specific attribute across a spatial range.
	 *
	 * **Semantics**: Last-writer-wins within each partition independently.
	 *
	 * @param bounds - Spatial bounds
	 * @param key - Attribute key (type-safe, must be keyof T)
	 * @param value - Value to insert (type-safe, must be T[K])
	 */
	set<K extends keyof T>(bounds: Rectangle, key: K, value: T[K]): void;
}
