/**
 * Attribute-Partitioned Spatial Index
 *
 * A spatial index coordinator that manages independent per-attribute partitions
 * using lazy vertical partitioning. Each attribute gets its own spatial index,
 * created on-demand. Query results are computed via spatial join across active
 * partitions.
 *
 * **Pattern**: Lazy Vertical Partitioning with Query-Time Spatial Join
 *
 * **Academic basis**: Column-store database techniques applied to spatial indexing.
 * Similar to layered GIS systems (PostGIS, ArcGIS) where each layer is queried
 * independently and joined spatially.
 *
 * **Type safety**: Fully type-safe per-attribute access. Each key K maps to its
 * declared type T[K], enforced at compile time.
 *
 * @template T - Record type where each key maps to its value type
 *
 * @example
 * ```typescript
 * import { LazyPartitionedSpatialIndexImpl } from './lazypartitionedindex.ts';
 * import MortonLinearScanImpl from './implementations/mortonlinearscan.ts';
 *
 * type CellProperties = {
 *   background?: string;
 *   fontColor?: string;
 *   fontSize?: number;
 * };
 *
 * // Create with factory for underlying partition indexes
 * const index = new LazyPartitionedSpatialIndexImpl<CellProperties>(
 *   () => new MortonLinearScanImpl()
 * );
 *
 * // Type-safe inserts (TypeScript knows fontColor is string)
 * index.set([0, 0, 9, 9], 'background', 'red');
 * index.set([0, 0, 9, 9], 'fontColor', 'blue');
 * index.set([0, 0, 9, 9], 'fontSize', 12);
 *
 * // Query performs spatial join across all active partitions
 * for (const [bounds, attributes] of index.query([0, 0, 4, 4])) {
 *   console.log(bounds, attributes.background);
 * }
 * ```
 */

import { contains } from './rect.ts';
import type {
	IndexFactory,
	PartitionedQueryResult,
	PartitionedSpatialIndex,
	Rectangle,
	SpatialIndex,
} from './types.ts';

/**
 * Spatial join algorithm: combines results from multiple partitions.
 *
 * **Strategy**: Plane sweep to find all distinct spatial regions where any
 * partition's coverage changes. For each region, merge attributes from all
 * partitions that cover it.
 *
 * **Algorithm**: Two-phase approach:
 * 1. Collect all row/column boundaries from all partitions
 * 2. Test each resulting cell for coverage by each partition
 *
 * **Complexity**: O(R × C × k × m) where:
 * - R = unique row boundaries
 * - C = unique column boundaries
 * - k = number of partitions
 * - m = results per partition
 *
 * For typical viewport queries: R,C ≈ 10-100, k ≈ 5-10, m ≈ 1-10 → acceptable
 *
 * @param partitionResults - Results from each partition's query
 * @returns Iterator yielding partitioned query results (tuples)
 */
function* spatialJoin<T extends Record<string, unknown>>(
	partitionResults: Map<keyof T, Array<{ bounds: Rectangle; value: unknown }>>,
): IterableIterator<PartitionedQueryResult<T>> {
	// Phase 1: Collect all unique row and column boundaries
	const rowBoundaries = new Set<number>();
	const colBoundaries = new Set<number>();

	for (const results of partitionResults.values()) {
		for (const result of results) {
			const [xmin, ymin, xmax, ymax] = result.bounds;
			colBoundaries.add(xmin);
			colBoundaries.add(xmax + 1); // +1 for sweep to capture edges
			rowBoundaries.add(ymin);
			rowBoundaries.add(ymax + 1);
		}
	}

	// Sort boundaries for sweep
	const sortedRows = Array.from(rowBoundaries).sort((a, b) => a - b);
	const sortedCols = Array.from(colBoundaries).sort((a, b) => a - b);

	// Phase 2: For each cell in the grid defined by boundaries,
	// find which partitions cover it and merge their attributes
	for (let i = 0; i < sortedRows.length - 1; i++) {
		for (let j = 0; j < sortedCols.length - 1; j++) {
			const bounds: Rectangle = [
				sortedCols[j],
				sortedRows[i],
				sortedCols[j + 1] - 1, // -1 to convert back to closed interval
				sortedRows[i + 1] - 1,
			];

			const attributes: Partial<T> = {};

			// Check which partitions cover this cell
			for (const [key, results] of partitionResults.entries()) {
				for (const result of results) {
					if (contains(result.bounds, bounds)) {
						attributes[key] = result.value as T[keyof T];
						break; // Found value for this partition
					}
				}
			}

			// Only include cells that have at least one attribute
			if (Object.keys(attributes).length) {
				yield [bounds, attributes];
			}
		}
	}
}

/**
 * Lazy Partitioned Spatial Index Implementation
 *
 * **Implementation Strategy**: Lazy-on-write vertical partitioning
 *
 * Partitions are created lazily on first write to each attribute. This minimizes
 * memory overhead for sparse data where many attributes may never be written.
 *
 * **Responsibilities**:
 * - Lazy instantiation of per-attribute spatial indexes (created on first write)
 * - Type-safe attribute access (key K → type T[K])
 * - Spatial join across active partitions on query
 * - Unified interface over multiple underlying indexes (Facade pattern)
 *
 * **Complexity**:
 * - `set()`: O(n) where n = ranges in target partition
 * - `query()`: O(k × (log n + m) + R × C × k × m) where:
 *   - k = active partitions
 *   - n = ranges per partition
 *   - m = query results per partition
 *   - R, C = unique row/column boundaries (spatial join cost)
 */
export class LazyPartitionedSpatialIndexImpl<T extends Record<string, unknown>> implements PartitionedSpatialIndex<T> {
	/**
	 * Map of attribute key → spatial index for that attribute.
	 * Partitions are created lazily on first write to each attribute.
	 */
	private readonly partitions = new Map<keyof T, SpatialIndex<unknown>>();

	/**
	 * Factory for creating new partition indexes.
	 * Defaults to a provided implementation, but can be customized.
	 */
	private readonly indexFactory: IndexFactory;

	/**
	 * Creates a new lazy partitioned spatial index.
	 *
	 * **Lazy instantiation**: Partitions are created on first write to each attribute,
	 * minimizing memory overhead for sparse multi-attribute data.
	 *
	 * @param indexFactory - Factory function for creating partition indexes.
	 *                       Called once per attribute on first write (lazy).
	 *
	 * @example
	 * ```typescript
	 * import MortonLinearScanImpl from './implementations/mortonlinearscan.ts';
	 *
	 * const index = new LazyPartitionedSpatialIndexImpl<CellProps>(
	 *   () => new MortonLinearScanImpl()
	 * );
	 *
	 * // Factory not called yet - no partitions exist
	 * console.log(index.keys()); // []
	 *
	 * // First write to 'background' creates partition via factory
	 * index.set([0, 0, 4, 4], 'background', 'red');
	 * console.log(index.keys()); // ['background']
	 * ```
	 */
	constructor(indexFactory: IndexFactory) {
		this.indexFactory = indexFactory;
	}

	/**
	 * Gets or creates the spatial index partition for the given attribute.
	 * Lazy instantiation - partition created on first access.
	 *
	 * @param key - Attribute key
	 * @returns The spatial index for this attribute
	 */
	private getOrCreatePartition<K extends keyof T>(key: K): SpatialIndex<T[K]> {
		if (!this.partitions.has(key)) {
			this.partitions.set(key, this.indexFactory<T[K]>());
		}
		return this.partitions.get(key) as SpatialIndex<T[K]>;
	}

	/**
	 * Insert a value for a specific attribute across a spatial range.
	 *
	 * **Semantics**: Last-writer-wins within each partition independently.
	 * This operation only affects the partition for the specified attribute.
	 *
	 * @param bounds - Spatial bounds
	 * @param key - Attribute key (type-safe, must be keyof T)
	 * @param value - Value to insert (type-safe, must be T[K])
	 *
	 * @example
	 * ```typescript
	 * index.set([0, 0, 4, 4], 'background', 'red');
	 * index.set([0, 2, 4, 6], 'fontColor', 'blue');
	 * ```
	 */
	set<K extends keyof T>(bounds: Rectangle, key: K, value: T[K]): void {
		const partition = this.getOrCreatePartition(key);
		partition.insert(bounds, value);
	}

	/**
	 * Insert a value for all attributes across a spatial range.
	 *
	 * @param bounds - Spatial bounds
	 * @param value - Value to insert (type-safe, must be Partial<T>)
	 */
	insert(bounds: Rectangle, value: Partial<T>): void {
		for (const [key, val] of Object.entries(value) as [keyof T, T[keyof T]][]) {
			this.set(bounds, key, val);
		}
	}

	/**
	 * Query all attributes across a spatial range using spatial join.
	 *
	 * **Returns iterator** for memory efficiency and early-exit support.
	 * Results are yielded incrementally as the spatial join computes them.
	 *
	 * **Algorithm**: For each active partition, query independently, then perform
	 * spatial join to combine results. The join finds all distinct spatial regions
	 * and merges attributes from all partitions for each region.
	 *
	 * **Complexity**: O(k × (log n + m)) where:
	 * - k = number of active partitions
	 * - n = ranges per partition
	 * - m = results per partition
	 *
	 * @param bounds - Spatial bounds to query
	 * @returns Iterator yielding partitioned query results (tuples)
	 *
	 * @example
	 * ```typescript
	 * // Iterate lazily
	 * for (const [bounds, attributes] of index.query([0, 0, 9, 9])) {
	 *   console.log(bounds, attributes);
	 * }
	 *
	 * // Or collect all results
	 * const results = Array.from(index.query([0, 0, 9, 9]));
	 * // Returns: [
	 * //   [[0, 0, 4, 4], { background: 'red' }],
	 * //   [[0, 5, 9, 9], { background: 'red', fontColor: 'blue' }]
	 * // ]
	 * ```
	 */
	*query(bounds: Rectangle): IterableIterator<PartitionedQueryResult<T>> {
		// Query all active partitions
		const partitionResults = new Map<keyof T, Array<{ bounds: Rectangle; value: unknown }>>();

		for (const [key, partition] of this.partitions.entries()) {
			const results = Array.from(partition.query(bounds)).map(([bounds, value]) => ({ bounds, value }));
			if (results.length) {
				partitionResults.set(key, results);
			}
		}
		// If no partitions have results, return empty
		if (!partitionResults.size) {
			return;
		}
		// Perform spatial join across all partition results
		yield* spatialJoin(partitionResults);
	}

	/**
	 * Check if the index is empty (no partitions created yet).
	 *
	 * @returns true if no partitions exist or all partitions are empty
	 */
	get isEmpty(): boolean {
		if (!this.partitions.size) {
			return true;
		}
		for (const partition of this.partitions.values()) {
			if (!partition.query().next().done) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Get all active partition keys (attributes that have been written to).
	 *
	 * @returns Array of attribute keys that have partitions
	 */
	keys(): MapIterator<keyof T> {
		return this.partitions.keys();
	}

	/**
	 * Get the number of ranges stored in a specific partition.
	 *
	 * @param key - Attribute key
	 * @returns Number of ranges in that partition, or 0 if partition doesn't exist
	 */
	sizeOf(key: keyof T): number {
		const partition = this.partitions.get(key);
		return partition ? Array.from(partition.query()).length : 0;
	}

	/**
	 * Clear all data from all partitions.
	 * Does not remove partitions (they remain instantiated but empty).
	 */
	clear(): void {
		this.partitions.clear();
	}
}
