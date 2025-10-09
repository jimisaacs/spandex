/**
 * Google Sheets adapter: GridRange (half-open) ⟷ Rectangle (closed)
 */

import * as Rect from '../rect.ts';
import type {
	PartitionedQueryResult,
	PartitionedSpatialIndex,
	QueryResult,
	Rectangle,
	SpatialIndex,
} from '../types.ts';

export interface GridRange {
	endColumnIndex?: number | undefined;
	endRowIndex?: number | undefined;
	startColumnIndex?: number | undefined;
	startRowIndex?: number | undefined;
}

/**
 * Spatial join result adapted for Google Sheets GridRange type.
 * Similar to PartitionedQueryResult but uses GridRange (half-open) instead of Rectangle (closed).
 */
export type GridRangeSpatialJoinResult<T extends Record<string, unknown>> = readonly [
	/** The spatial bounds of this result region (Google Sheets format) */
	bounds: GridRange,
	/** Merged attributes from all partitions (only includes attributes with values) */
	attributes: Partial<T>,
];

/**
 * GridRange → Rectangle (lossless, undefined ⟷ ±Infinity)
 *
 * @example `{startRowIndex: 0, endRowIndex: 5, startColumnIndex: 0, endColumnIndex: 10}` → `[0, 0, 9, 4]`
 */
export function gridRangeToRectangle(
	{ startColumnIndex: x1, startRowIndex: y1, endColumnIndex: x2, endRowIndex: y2 }: GridRange,
): Rectangle {
	return Rect.rect(
		x1 != null && x1 >= 0 ? x1 : -Infinity,
		y1 != null && y1 >= 0 ? y1 : -Infinity,
		x2 != null && x2 < Infinity ? x2 - 1 : Infinity,
		y2 != null && y2 < Infinity ? y2 - 1 : Infinity,
	);
}

/**
 * Rectangle → GridRange (lossless, negative/Infinity → undefined)
 *
 * @example `[0, 0, 9, 4]` → `{startRowIndex: 0, endRowIndex: 5, startColumnIndex: 0, endColumnIndex: 10}`
 */
export function rectangleToGridRange([x1, y1, x2, y2]: Rectangle): GridRange {
	const range: GridRange = {};
	if (x1 >= 0) range.startColumnIndex = x1;
	if (y1 >= 0) range.startRowIndex = y1;
	if (x2 < Infinity) range.endColumnIndex = x2 + 1;
	if (y2 < Infinity) range.endRowIndex = y2 + 1;
	return range;
}

/**
 * Wrap SpatialIndex to accept/return GridRange instead of Rectangle.
 */
export function createGridRangeAdapter<T>(index: SpatialIndex<T>) {
	return {
		insert(gridRange: GridRange, value: T): void {
			index.insert(gridRangeToRectangle(gridRange), value);
		},
		query(gridRange?: GridRange): IterableIterator<QueryResult<T>> {
			return index.query(gridRange ? gridRangeToRectangle(gridRange) : undefined);
		},
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
 * import { createPartitionedGridRangeAdapter } from './adapters/gridrange.ts';
 * import { LazyPartitionedSpatialIndexImpl } from './lazypartitionedindex.ts';
 * import MortonLinearScanImpl from './implementations/mortonlinearscan.ts';
 *
 * type CellProps = { background?: string; fontColor?: string };
 *
 * const index = new LazyPartitionedSpatialIndexImpl<CellProps>(
 *   () => new MortonLinearScanImpl()
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
) {
	return {
		set<K extends keyof T>(gridRange: GridRange, key: K, value: T[K]): void {
			index.set(gridRangeToRectangle(gridRange), key, value);
		},
		insert(gridRange: GridRange, value: Partial<T>): void {
			index.insert(gridRangeToRectangle(gridRange), value);
		},
		query(gridRange?: GridRange): IterableIterator<PartitionedQueryResult<T>> {
			return index.query(gridRange ? gridRangeToRectangle(gridRange) : undefined);
		},
	} as const;
}
