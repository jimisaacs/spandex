/**
 * @module
 *
 * One spatial index per attribute, created on first write, joined on query.
 *
 * This is vertical partitioning, the column-store shape, with a spatial join over
 * the partitions. Each key K carries its own value type T[K], checked at compile
 * time. Query results are grid cells cut at partition boundaries rather than the
 * rectangles that went in, so cell counts differ from a plain index.
 *
 * See the factory at the bottom of this file for usage.
 */

import { computeExtent } from '../extent.ts';
import * as r from '../r.ts';
import type {
	ExtentResult,
	PartitionedQueryResult,
	PartitionedSpatialIndex,
	QueryResult,
	Rectangle,
	SpatialIndex,
} from '../types.ts';

/**
 * Spatial join: plane sweep across partition boundaries.
 *
 * **Algorithm**:
 * 1. Collect boundaries from all partitions → grid cells
 * 2. Convert partition results into row-band start events
 * 3. Fill and emit one active row band at a time
 *
 * **Complexity**: O(km log km + A + G)
 * - R, C = unique row/column boundaries
 * - k = partitions, m = results per partition
 * - A = covered grid-cell assignments across all partition results
 * - G = swept grid cells
 *
 * @param partitionResults - Results from each partition's query
 * @returns Iterator yielding partitioned query results (tuples)
 */
/** Numeric sort order, hoisted so the join does not mint a comparator per query. */
function ascending(a: number, b: number): number {
	return a - b;
}

/** Below this, the old direct scan is smaller work than building sweep state. */
const SMALL_JOIN_RESULT_COUNT = 16;

/** Index of the last band whose start is <= `value`, clamped to 0. */
function lastBandAtOrBefore(sorted: number[], value: number): number {
	let lo = 0, hi = sorted.length - 1, best = 0;
	while (lo <= hi) {
		const mid = (lo + hi) >> 1;
		if (sorted[mid]! <= value) best = mid, lo = mid + 1;
		else hi = mid - 1;
	}
	return best;
}

/** Exclusive upper band index: the first band starting past `value`. */
function firstBandAfter(sorted: number[], value: number): number {
	let lo = 0, hi = sorted.length - 1, best = sorted.length - 1;
	while (lo <= hi) {
		const mid = (lo + hi) >> 1;
		if (sorted[mid]! > value) best = mid, hi = mid - 1;
		else lo = mid + 1;
	}
	return best;
}

interface PartitionSnapshot<T extends Record<string, unknown>> {
	key: keyof T;
	results: Array<QueryResult<unknown>>;
}

interface Coverage<T extends Record<string, unknown>> {
	key: keyof T;
	value: unknown;
	colStart: number;
	colEnd: number;
	rowEnd: number;
}

/**
 * Plane sweep across partition boundaries: collect every distinct row and column
 * boundary, then merge the attributes covering each cell of the grid they define.
 *
 * The old join visited every cell and then searched every partition result for
 * a covering rectangle. This one indexes each result to the grid bands it covers
 * once, then emits the filled cells in row-major boundary order.
 */
function* spatialJoin<T extends Record<string, unknown>>(
	partitionResults: Array<PartitionSnapshot<T>>,
	queryBounds: Readonly<Rectangle>,
): IterableIterator<PartitionedQueryResult<T>> {
	// Phase 1: Collect all unique row and column boundaries
	const rowBoundaries = new Set<number>();
	const colBoundaries = new Set<number>();
	let resultCount = 0;

	for (let i = 0; i < partitionResults.length; i++) {
		const results = partitionResults[i]!.results;
		for (let j = 0; j < results.length; j++) {
			const result = results[j]!;
			const [xmin, ymin, xmax, ymax] = result[0];
			colBoundaries.add(xmin);
			colBoundaries.add(xmax + 1); // +1 for sweep to capture edges
			rowBoundaries.add(ymin);
			rowBoundaries.add(ymax + 1);
			resultCount++;
		}
	}

	// Sort boundaries for sweep
	const sortedRows = Array.from(rowBoundaries).sort(ascending);
	const sortedCols = Array.from(colBoundaries).sort(ascending);

	// Phase 2: For each cell in the grid defined by boundaries,
	// find which partitions cover it and merge their attributes
	const [qXmin, qYmin, qXmax, qYmax] = queryBounds;

	// Restrict the sweep to the bands the query actually touches. The boundary
	// lists are sorted, so the first and last relevant band are found by binary
	// search; without this a one-cell query still walks every band in the index.
	const rowStart = lastBandAtOrBefore(sortedRows, qYmin);
	const rowEnd = firstBandAfter(sortedRows, qYmax);
	const colStart = lastBandAtOrBefore(sortedCols, qXmin);
	const colEnd = firstBandAfter(sortedCols, qXmax);

	const rowCount = rowEnd - rowStart;
	const colCount = colEnd - colStart;
	if (rowCount <= 0 || colCount <= 0) return;

	if (resultCount <= SMALL_JOIN_RESULT_COUNT) {
		for (let i = rowStart; i < rowEnd; i++) {
			const cellYmin = sortedRows[i]!;
			const cellYmax = sortedRows[i + 1]! - 1;
			if (cellYmin > qYmax || cellYmax < qYmin) continue;

			for (let j = colStart; j < colEnd; j++) {
				const cellXmin = sortedCols[j]!;
				const cellXmax = sortedCols[j + 1]! - 1;
				if (cellXmin > qXmax || cellXmax < qXmin) continue;

				let attributes: Partial<T> | null = null;
				for (let p = 0; p < partitionResults.length; p++) {
					const { key, results } = partitionResults[p]!;
					for (let n = 0; n < results.length; n++) {
						const result = results[n]!;
						const [rx1, ry1, rx2, ry2] = result[0];
						if (r.covers(rx1, ry1, rx2, ry2, cellXmin, cellYmin, cellXmax, cellYmax)) {
							if (attributes === null) attributes = {};
							attributes[key] = result[1] as T[keyof T];
							break;
						}
					}
				}

				if (attributes) yield [[cellXmin, cellYmin, cellXmax, cellYmax], attributes];
			}
		}
		return;
	}

	// Phase 2: Create start events for the row bands each result covers. This
	// keeps memory proportional to results plus one row, not the whole grid.
	const startEvents: Array<Array<Coverage<T>> | undefined> = new Array(rowCount);

	for (let i = 0; i < partitionResults.length; i++) {
		const { key, results } = partitionResults[i]!;
		for (let j = 0; j < results.length; j++) {
			const result = results[j]!;
			const [xmin, ymin, xmax, ymax] = result[0];

			let localRowStart = lastBandAtOrBefore(sortedRows, ymin) - rowStart;
			let localRowEnd = firstBandAfter(sortedRows, ymax) - rowStart;
			let localColStart = lastBandAtOrBefore(sortedCols, xmin) - colStart;
			let localColEnd = firstBandAfter(sortedCols, xmax) - colStart;

			if (localRowStart < 0) localRowStart = 0;
			if (localColStart < 0) localColStart = 0;
			if (localRowEnd > rowCount) localRowEnd = rowCount;
			if (localColEnd > colCount) localColEnd = colCount;
			if (localRowStart >= localRowEnd || localColStart >= localColEnd) continue;

			const events = startEvents[localRowStart] ??= [];
			events.push({
				key,
				value: result[1],
				colStart: localColStart,
				colEnd: localColEnd,
				rowEnd: localRowEnd,
			});
		}
	}

	// Phase 3: Sweep row bands, filling and emitting one row at a time.
	const active: Array<Coverage<T>> = [];
	const rowAttributes: Array<Partial<T> | undefined> = new Array(colCount);

	for (let row = 0; row < rowCount; row++) {
		let activeWrite = 0;
		for (let i = 0; i < active.length; i++) {
			const coverage = active[i]!;
			if (coverage.rowEnd > row) active[activeWrite++] = coverage;
		}
		active.length = activeWrite;

		const starting = startEvents[row];
		if (starting) {
			for (let i = 0; i < starting.length; i++) active.push(starting[i]!);
		}

		for (let i = 0; i < active.length; i++) {
			const coverage = active[i]!;
			for (let col = coverage.colStart; col < coverage.colEnd; col++) {
				let attributes = rowAttributes[col];
				if (attributes === undefined) rowAttributes[col] = attributes = {};
				attributes[coverage.key] = coverage.value as T[keyof T];
			}
		}

		const sourceRow = rowStart + row;
		const cellYmin = sortedRows[sourceRow]!;
		const cellYmax = sortedRows[sourceRow + 1]! - 1;

		for (let col = 0; col < colCount; col++) {
			const attributes = rowAttributes[col];
			if (attributes === undefined) continue;

			rowAttributes[col] = undefined;
			const sourceCol = colStart + col;
			yield [[sortedCols[sourceCol]!, cellYmin, sortedCols[sourceCol + 1]! - 1, cellYmax], attributes];
		}
	}
}

/** `PartitionedSpatialIndex<T>` plus partition management. */
export interface LazyPartitionedIndex<T extends Record<string, unknown>> extends PartitionedSpatialIndex<T> {
	/** Attributes that have been written to. */
	keys(): IterableIterator<keyof T>;
	/** Ranges stored under one attribute, or 0 if it has no partition. */
	sizeOf(key: keyof T): number;
	/** True when no partition exists, or every one is empty. */
	readonly isEmpty: boolean;
	/** Remove every partition. */
	clear(): void;
}

/**
 * Partitions are created on first write to an attribute, so sparse data with many
 * never-written attributes costs nothing for them.
 *
 * `set` is O(n) in the target partition. `query` is
 * O(k × (log n + m) + R × C × k × m), where the join term dominates.
 */
class LazyPartitionedIndexImpl<T extends Record<string, unknown>> implements LazyPartitionedIndex<T> {
	// Extent cache for the index
	private extentCached: ExtentResult | null = null;
	/** Bumped by every mutation, so an open query iterator can tell it went stale. */
	private version = 0;
	/** Attribute → spatial index. Created lazily on first write. */
	private readonly partitions = new Map<keyof T, SpatialIndex<unknown>>();
	/** Factory function for creating partition indexes. */
	private readonly indexFactory: <T>() => SpatialIndex<T>;

	/**
	 * @param indexFactory - Called once per attribute, on that attribute's first
	 *                       write.
	 */
	constructor(indexFactory: <T>() => SpatialIndex<T>) {
		this.indexFactory = indexFactory;
	}

	/** The partition for this attribute, created on first use. */
	private getOrCreatePartition<K extends keyof T>(key: K): SpatialIndex<T[K]> {
		// One lookup on the common path. `has` then `set` then `get` cost three.
		let partition = this.partitions.get(key);
		if (!partition) {
			partition = this.indexFactory<T[K]>();
			this.partitions.set(key, partition);
		}
		return partition as SpatialIndex<T[K]>;
	}

	/**
	 * Insert a value for one attribute. Last-writer-wins applies within that
	 * attribute's partition only, so the others are untouched.
	 */
	set<K extends keyof T>(bounds: Readonly<Rectangle>, key: K, value: T[K]): void {
		// Validated before the partition exists. Creating it first meant a rejected
		// write left the key behind, so `keys()` reported an attribute as written
		// while `isEmpty` said the index was empty.
		bounds = r.validated(bounds);
		const partition = this.getOrCreatePartition(key);
		partition.insert(bounds, value);
		this.extentCached = null;
		this.version++;
	}

	/** Insert a value for every attribute the record carries. */
	insert(bounds: Readonly<Rectangle>, value: Partial<T>): void {
		// Walked by key rather than through `Object.entries`, which allocates an
		// array plus a two-element array per attribute only to be destructured.
		// The own-property test keeps that identical to what `entries` returned.
		for (const key in value) {
			if (Object.hasOwn(value, key)) this.set(bounds, key, value[key] as T[keyof T]);
		}
	}

	/**
	 * Query every attribute over a range, yielding one cell per distinct region
	 * with the attributes covering it.
	 *
	 * O(k × (log n + m) + km log km + A + G) for k active partitions, n ranges
	 * each, m results each, A covered grid-cell assignments, and G swept cells.
	 * Query a window where you can, since the sweep only covers the bands it
	 * touches.
	 */
	*query(bounds: Readonly<Rectangle> = r.ALL): IterableIterator<PartitionedQueryResult<T>> {
		const partitionResults: Array<PartitionSnapshot<T>> = [];

		for (const [key, partition] of this.partitions.entries()) {
			const results = Array.from(partition.query(bounds));
			if (results.length) {
				partitionResults.push({ key, results });
			}
		}
		if (!partitionResults.length) {
			return;
		}

		// The join needs every partition's results at once to find the cell
		// boundaries, so it cannot defer the search the way a single index does.
		// It owes the same invalidation contract anyway: continuing across a write
		// answers from a snapshot the index no longer holds.
		const stamp = this.version;
		for (const result of spatialJoin(partitionResults, bounds)) {
			if (this.version !== stamp) {
				throw new Error(
					'Query iterator invalidated: the index was modified while this query was being iterated.',
				);
			}
			yield result;
		}
	}

	/**
	 * Extent of the joined view, derived from `query()` rather than folded from the
	 * partitions' own extents.
	 *
	 * The join introduces coordinates no stored rectangle carries: partitions
	 * covering [1,3] and [0,inf) yield a cell starting at 4, which belongs to the
	 * joined view and nothing else. A fold over `partition.extent()` cannot see it
	 * and under-reports. The cost is a full join per uncached call, and making it
	 * cheap means first deciding whether `extent()` describes the joined view or
	 * the stored rectangles, which changes a published observable.
	 */
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

	/**
	 * Number of rectangles in one partition, O(n) because counting is the only
	 * thing a `SpatialIndex` can be asked: neither shipped implementation exposes
	 * a size on that interface, only on its own concrete type.
	 */
	sizeOf(key: keyof T): number {
		const partition = this.partitions.get(key);
		if (!partition) return 0;
		let count = 0;
		for (const _ of partition.query()) count++;
		return count;
	}

	clear(): void {
		this.partitions.clear();
		this.extentCached = null;
		this.version++;
	}
}

/**
 * Create a partitioned spatial index, one partition per attribute.
 *
 * Best for properties with independent spatial coverage, such as spreadsheet cell
 * backgrounds, fonts, and borders.
 *
 * @param indexFactory - Creates the underlying index for each partition
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
