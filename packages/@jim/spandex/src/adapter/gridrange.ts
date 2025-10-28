/** Google Sheets GridRange adapter: half-open [start, end) ⟷ closed [min, max] */

import * as r from '../r.ts';
import type { RenderableIndexAdapter } from '../render/types.ts';
import type {
	ExtentResult,
	PartitionedQueryResult,
	PartitionedSpatialIndex,
	QueryResult,
	Rectangle,
	SpatialIndex,
} from '../types.ts';

/**
 * Google Sheets GridRange: 2D bounds with half-open intervals.
 *
 * **Semantics**: Half-open intervals `[start, end)` — end is excluded
 * **Example**: `{startRowIndex: 0, endRowIndex: 5}` represents rows 0, 1, 2, 3, 4 (NOT 5)
 * **Unbounded**: undefined = extends to infinity
 */
export interface GridRange {
	/** End column index (exclusive, undefined = unbounded right) */
	endColumnIndex?: number | undefined;
	/** End row index (exclusive, undefined = unbounded bottom) */
	endRowIndex?: number | undefined;
	/** Start column index (inclusive, undefined = unbounded left) */
	startColumnIndex?: number | undefined;
	/** Start row index (inclusive, undefined = unbounded top) */
	startRowIndex?: number | undefined;
}

/** Spatial join result: GridRange (half-open) instead of Rectangle (closed) */
export type GridRangeSpatialJoinResult<T extends Record<string, unknown>> = readonly [
	/** The spatial bounds of this result region (Google Sheets format) */
	bounds: GridRange,
	/** Merged attributes from all partitions (only includes attributes with values) */
	attributes: Partial<T>,
];

/**
 * GridRange → Rectangle (lossless, undefined ⟷ ±∞)
 *
 * @example `{startRowIndex: 0, endRowIndex: 5, startColumnIndex: 0, endColumnIndex: 10}` → `[0, 0, 9, 4]`
 */
export function gridRangeToRectangle(
	{ startColumnIndex: x1, startRowIndex: y1, endColumnIndex: x2, endRowIndex: y2 }: GridRange,
): Readonly<Rectangle> {
	return r.make(
		x1 != null && x1 >= 0 ? x1 : r.negInf,
		y1 != null && y1 >= 0 ? y1 : r.negInf,
		x2 != null && x2 < r.posInf ? x2 - 1 : r.posInf,
		y2 != null && y2 < r.posInf ? y2 - 1 : r.posInf,
	);
}

/**
 * Rectangle → GridRange (lossless, negative/∞ → undefined)
 *
 * @example `[0, 0, 9, 4]` → `{startRowIndex: 0, endRowIndex: 5, startColumnIndex: 0, endColumnIndex: 10}`
 */
export function rectangleToGridRange([x1, y1, x2, y2]: Readonly<Rectangle>): Readonly<GridRange> {
	const range: GridRange = {};
	if (x1 >= 0) range.startColumnIndex = x1;
	if (y1 >= 0) range.startRowIndex = y1;
	if (x2 < r.posInf) range.endColumnIndex = x2 + 1;
	if (y2 < r.posInf) range.endRowIndex = y2 + 1;
	return range;
}

/**
 * Wrap SpatialIndex to accept/return GridRange instead of Rectangle.
 *
 * Adapts a spatial index to work with Google Sheets' GridRange type
 * (half-open intervals) while the core library uses Rectangle (closed intervals).
 *
 * @param index - Underlying spatial index to wrap
 * @returns Adapted index accepting GridRange bounds
 *
 * @example
 * ```typescript
 * import { createGridRangeAdapter } from '@jim/spandex/adapter/gridrange';
 * import createMortonLinearScanIndex from '@jim/spandex';
 *
 * const index = createMortonLinearScanIndex<string>();
 * const adapter = createGridRangeAdapter(index);
 *
 * // Insert using GridRange (half-open: endRowIndex=5 means up to row 4)
 * adapter.insert({ startRowIndex: 0, endRowIndex: 5, startColumnIndex: 0, endColumnIndex: 3 }, 'data');
 *
 * // Query using GridRange
 * for (const [bounds, value] of adapter.query({ startRowIndex: 0, endRowIndex: 10 })) {
 *   console.log(bounds, value);
 * }
 * ```
 */
export function createGridRangeAdapter<T>(
	index: SpatialIndex<T>,
): SpatialIndex<T, Readonly<GridRange>> & RenderableIndexAdapter<T, Readonly<GridRange>> {
	return {
		insert(gridRange: Readonly<GridRange>, value: T): void {
			index.insert(gridRangeToRectangle(gridRange), value);
		},
		query(gridRange?: Readonly<GridRange>): IterableIterator<QueryResult<T>> {
			return index.query(gridRange ? gridRangeToRectangle(gridRange) : undefined);
		},
		extent(): ExtentResult {
			return index.extent();
		},
		toBounds: rectangleToGridRange,
	} as const;
}

/**
 * Wrap PartitionedSpatialIndex to accept/return GridRange instead of Rectangle.
 *
 * Adapts the partitioned index to work with Google Sheets' GridRange type
 * (half-open intervals) while the core library uses Rectangle (closed intervals).
 *
 * @example
 * ```typescript
 * import { createPartitionedGridRangeAdapter } from '@jim/spandex/adapter/gridrange';
 * import createLazyPartitionedIndex from '@jim/spandex/index/lazypartitionedindex';
 * import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
 *
 * type CellProps = { background?: string; fontColor?: string };
 *
 * const index = createLazyPartitionedIndex<CellProps>(
 *   createMortonLinearScanIndex
 * );
 *
 * const adapter = createPartitionedGridRangeAdapter(index);
 *
 * // Use with GridRange (Google Sheets API)
 * adapter.set({ startRowIndex: 0, endRowIndex: 5 }, 'background', 'red');
 * const results = adapter.query({ startRowIndex: 0, endRowIndex: 10 });
 * ```
 */
export function createPartitionedGridRangeAdapter<T extends Record<string, unknown>>(
	index: PartitionedSpatialIndex<T>,
): PartitionedSpatialIndex<Partial<T>, Readonly<GridRange>> & RenderableIndexAdapter<Partial<T>, Readonly<GridRange>> {
	return {
		set<K extends keyof T>(gridRange: Readonly<GridRange>, key: K, value: T[K]): void {
			index.set(gridRangeToRectangle(gridRange), key, value);
		},
		insert(gridRange: Readonly<GridRange>, value: Partial<T>): void {
			index.insert(gridRangeToRectangle(gridRange), value);
		},
		query(gridRange?: Readonly<GridRange>): IterableIterator<PartitionedQueryResult<T>> {
			return index.query(gridRange ? gridRangeToRectangle(gridRange) : undefined);
		},
		extent(): ExtentResult {
			return index.extent();
		},
		toBounds: rectangleToGridRange,
	} as const;
}
