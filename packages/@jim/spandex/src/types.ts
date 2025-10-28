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
 * **Semantics**: Closed intervals `[min, max]` — both endpoints included
 * **Example**: `[0, 0, 4, 4]` = x:[0,4], y:[0,4] (inclusive)
 * **Format**: Tuple for cache efficiency and TypedArray compatibility
 */
export type Rectangle = [xmin: number, ymin: number, xmax: number, ymax: number];

/**
 * EdgeFlags: infinite-bound indicators aligned to Rectangle index order.
 *
 * [xmin, ymin, xmax, ymax] — `true` means that edge is unbounded (extends to ±∞)
 * e.g. `[true, false, false, true]` → unbounded on left (xmin) and bottom (ymax) edges.
 *
 * Used when representing or normalizing a Rectangle with one or more infinite bounds.
 */
export type EdgeFlags = [xmin: boolean, ymin: boolean, xmax: boolean, ymax: boolean];

/**
 * Query result from spatial index.
 *
 * @example
 * ```typescript
 * for (const [bounds, value] of index.query(range)) {
 *   console.log(bounds, value);
 * }
 * ```
 */
export type QueryResult<Value> = readonly [bounds: Readonly<Rectangle>, value: Value];

/**
 * Extent result: finite MBR plus metadata about infinite edges.
 *
 * **Semantics**:
 * - `mbr`: Minimum bounding rectangle of all finite coordinate portions
 * - `edges`: Which edges conceptually extend to ±∞
 * - `empty`: True if no rectangles have been absorbed
 */
export interface ExtentResult {
	/** Minimum bounding rectangle of all finite coordinate portions */
	readonly mbr: Readonly<Rectangle>;
	/** Which edges conceptually extend to ±∞ */
	readonly edges: Readonly<EdgeFlags>;
	/** True if no rectangles have been absorbed */
	readonly empty: boolean;
}

/**
 * SpatialIndex: Core interface for 2D spatial indexing with last-writer-wins semantics.
 *
 * **Operations**: insert (LWW), query (intersection), extent (MBR)
 * **Guarantees**: Disjoint partition, ≤4n fragments after n insertions (worst case)
 * **Query**: Returns iterator for memory-efficient streaming and early termination
 */
export interface SpatialIndex<T, Bounds = Readonly<Rectangle>> {
	/** Insert value at bounds (last-writer-wins on overlap) */
	insert(bounds: Bounds, value: T): void;
	/** Query ranges intersecting bounds, or all ranges if bounds undefined */
	query(bounds?: Bounds): IterableIterator<QueryResult<T>>;
	/** Get extent result (finite MBR + infinity edges + empty flag) */
	extent(): ExtentResult;
}

/**
 * Partitioned query result from spatial index.
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
 * Each attribute gets its own spatial index partition.
 *
 * **Pattern**: Vertical partitioning with spatial join on query
 *
 * @template T - Record type mapping attribute keys to their value types
 */
export interface PartitionedSpatialIndex<Value extends Record<string, unknown>, Bounds = Readonly<Rectangle>>
	extends SpatialIndex<Partial<Value>, Bounds> {
	/**
	 * Insert a value for a specific attribute across a spatial range.
	 *
	 * Last-writer-wins semantics apply within each partition independently.
	 *
	 * @param bounds - Spatial bounds
	 * @param key - Attribute key (type-safe, must be keyof T)
	 * @param value - Value to insert (type-safe, must be T[K])
	 */
	set<K extends keyof Value>(bounds: Bounds, key: K, value: Value[K]): void;
}

/**
 * Either SpatialIndex or PartitionedSpatialIndex depending on whether T is a record.
 *
 * @template T - Value type (if record type, becomes partitioned index)
 */
export type SingleOrPartitionedSpatialIndex<T, Bounds = Readonly<Rectangle>> = T extends Record<string, unknown>
	? PartitionedSpatialIndex<T, Bounds>
	: SpatialIndex<T, Bounds>;

/**
 * Extract value type from Index's query method.
 * Handles both SpatialIndex<T> and PartitionedSpatialIndex<T> correctly.
 */
export type QueryValue<T> = T extends { query(bounds?: unknown): IterableIterator<QueryResult<infer V>> } ? V : never;
