// Core types
export type {
	IndexFactory,
	PartitionedQueryResult,
	PartitionedSpatialIndex,
	QueryResult,
	Rectangle,
	SpatialIndex,
} from './types.ts';
export * from './rect.ts';

// Implementations
export { default as MortonLinearScanImpl } from './implementations/mortonlinearscan.ts';
export { default as RStarTreeImpl } from './implementations/rstartree.ts';

// Adapters - Basic
export { createGridRangeAdapter, gridRangeToRectangle, rectangleToGridRange } from './adapters/gridrange.ts';
export type { GridRange, GridRangeSpatialJoinResult } from './adapters/gridrange.ts';
export { createA1Adapter } from './adapters/a1.ts';
export type { A1Cell, A1CellRange, A1Column, A1ColumnRange, A1RowRange, A1SheetRange } from './adapters/a1.ts';

// Adapters - Partitioned
export { createPartitionedA1Adapter } from './adapters/a1.ts';
export { createPartitionedGridRangeAdapter } from './adapters/gridrange.ts';

// Advanced
export { LazyPartitionedSpatialIndexImpl } from './lazypartitionedindex.ts';
