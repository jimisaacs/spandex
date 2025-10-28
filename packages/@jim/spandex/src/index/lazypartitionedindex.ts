/**
 * Attribute-Partitioned Spatial Index
 *
 * Manages independent spatial indexes per attribute. Lazy creation, spatial join on query.
 *
 * **Pattern**: Vertical partitioning (column-store) + spatial join
 * **Type safety**: Each key K → type T[K], enforced at compile time
 * **Academic basis**: Column stores (Stonebraker et al., 2005) + layered GIS (PostGIS)
 *
 * @template T - Record type where each key maps to its value type
 *
 * @example
 * ```typescript
 * import createLazyPartitionedIndex from './lazypartitionedindex.ts';
 * import createMortonLinearScanIndex from './mortonlinearscan.ts';
 *
 * type CellProperties = {
 *   background?: string;
 *   fontColor?: string;
 *   fontSize?: number;
 * };
 *
 * // Create with factory for underlying partition indexes
 * const index = createLazyPartitionedIndex<CellProperties>(
 *   createMortonLinearScanIndex
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

import { computeExtent } from '../extent.ts';
import * as r from '../r.ts';
import type {
	ExtentResult,
	PartitionedQueryResult,
	PartitionedSpatialIndex,
	Rectangle,
	SpatialIndex,
} from '../types.ts';

/**
 * Spatial join: plane sweep across partition boundaries.
 *
 * **Algorithm**:
 * 1. Collect boundaries from all partitions → grid cells
 * 2. For each cell, merge attributes from overlapping partitions
 *
 * **Complexity**: O(R × C × k × m)
 * - R, C = unique row/column boundaries
 * - k = partitions, m = results per partition
 * - Typical: R,C ≈ 10-100, k ≈ 5-10, m ≈ 1-10 → acceptable
 *
 * @param partitionResults - Results from each partition's query
 * @returns Iterator yielding partitioned query results (tuples)
 */
function* spatialJoin<T extends Record<string, unknown>>(
	partitionResults: Map<keyof T, Array<{ bounds: Readonly<Rectangle>; value: unknown }>>,
	queryBounds: Readonly<Rectangle>,
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
	const [qXmin, qYmin, qXmax, qYmax] = queryBounds;

	for (let i = 0; i < sortedRows.length - 1; i++) {
		for (let j = 0; j < sortedCols.length - 1; j++) {
			const bounds: Readonly<Rectangle> = [
				sortedCols[j]!,
				sortedRows[i]!,
				sortedCols[j + 1]! - 1, // -1 to convert back to closed interval
				sortedRows[i + 1]! - 1,
			];
			// Skip cells outside query bounds
			const [xmin, ymin, xmax, ymax] = bounds;
			if (xmin > qXmax || ymin > qYmax || xmax < qXmin || ymax < qYmin) {
				continue;
			}

			const attributes: Partial<T> = {};

			// Check which partitions cover this cell
			for (const [key, results] of partitionResults.entries()) {
				for (const result of results) {
					if (r.contains(result.bounds, bounds)) {
						attributes[key] = result.value as T[keyof T];
						break;
					}
				}
			}

			if (Object.keys(attributes).length) {
				yield [bounds, attributes];
			}
		}
	}
}

interface LazyPartitionedIndex<T extends Record<string, unknown>> extends PartitionedSpatialIndex<T> {
	/**
	 * Get all active partition keys (attributes that have been written to).
	 *
	 * @returns Iterable iterator of attribute keys that have partitions
	 */
	keys(): IterableIterator<keyof T>;
	/**
	 * Get the number of ranges stored in a specific partition.
	 *
	 * @param key - Attribute key
	 * @returns Number of ranges in that partition, or 0 if partition doesn't exist
	 */
	sizeOf(key: keyof T): number;
	/**
	 * True if no partitions exist or all partitions are empty.
	 */
	readonly isEmpty: boolean;
	/**
	 * Remove all partitions and reset to empty state.
	 */
	clear(): void;
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
class LazyPartitionedIndexImpl<T extends Record<string, unknown>> implements LazyPartitionedIndex<T> {
	// Extent cache for the index
	private extentCached: ExtentResult | null = null;
	/** Attribute → spatial index. Created lazily on first write. */
	private readonly partitions = new Map<keyof T, SpatialIndex<unknown>>();
	/** Factory function for creating partition indexes. */
	private readonly indexFactory: <T>() => SpatialIndex<T>;

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
	 * import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
	 * import createLazyPartitionedIndex from '@jim/spandex/index/lazypartitionedindex';
	 *
	 * const index = createLazyPartitionedIndex<CellProps>(
	 *   createMortonLinearScanIndex
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
	constructor(indexFactory: <T>() => SpatialIndex<T>) {
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
	set<K extends keyof T>(bounds: Readonly<Rectangle>, key: K, value: T[K]): void {
		const partition = this.getOrCreatePartition(key);
		partition.insert(bounds, value);
		this.extentCached = null;
	}

	/**
	 * Insert a value for all attributes across a spatial range.
	 *
	 * @param bounds - Spatial bounds
	 * @param value - Value to insert (type-safe, must be Partial<T>)
	 */
	insert(bounds: Readonly<Rectangle>, value: Partial<T>): void {
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
	*query(bounds: Readonly<Rectangle> = r.ALL): IterableIterator<PartitionedQueryResult<T>> {
		const partitionResults = new Map<keyof T, Array<{ bounds: Readonly<Rectangle>; value: unknown }>>();

		for (const [key, partition] of this.partitions.entries()) {
			const results = Array.from(partition.query(bounds)).map(([bounds, value]) => ({ bounds, value }));
			if (results.length) {
				partitionResults.set(key, results);
			}
		}
		if (!partitionResults.size) {
			return;
		}
		yield* spatialJoin(partitionResults, bounds);
	}

	extent(): ExtentResult {
		return this.extentCached ??= computeExtent(this.query());
	}

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

	keys(): MapIterator<keyof T> {
		return this.partitions.keys();
	}

	sizeOf(key: keyof T): number {
		const partition = this.partitions.get(key);
		return partition ? Array.from(partition.query()).length : 0;
	}

	clear(): void {
		this.partitions.clear();
	}
}

/**
 * Create a lazy partitioned spatial index for managing per-attribute ranges.
 *
 * **Use case**: Spreadsheet cell properties (background, font, borders, etc.)
 * where each property has independent spatial coverage.
 *
 * **Pattern**: Vertical partitioning - each attribute gets its own spatial index,
 * automatically created on first use. Query performs spatial join across partitions.
 *
 * @param indexFactory - Factory function to create underlying spatial indices for each partition
 * @returns New partitioned spatial index instance
 *
 * @example
 * ```typescript
 * import createLazyPartitionedIndex from '@jim/spandex/index/lazypartitionedindex';
 * import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
 * import * as r from '@jim/spandex/r';
 *
 * type CellProps = {
 *   background?: string;
 *   fontColor?: string;
 *   fontSize?: number;
 * };
 *
 * const index = createLazyPartitionedIndex<CellProps>(createMortonLinearScanIndex);
 *
 * // Set individual attributes across ranges
 * index.set(r.make(0, 0, 10, 10), 'background', 'red');
 * index.set(r.make(5, 5, 15, 15), 'fontColor', 'blue');
 *
 * // Query returns merged attributes per cell
 * for (const [bounds, props] of index.query(r.make(7, 7, 8, 8))) {
 *   console.log(bounds, props); // { background: 'red', fontColor: 'blue' }
 * }
 * ```
 */
export default function createLazyPartitionedIndex<T extends Record<string, unknown>>(
	indexFactory: <T>() => SpatialIndex<T>,
): LazyPartitionedIndex<T> {
	return new LazyPartitionedIndexImpl<T>(indexFactory);
}
