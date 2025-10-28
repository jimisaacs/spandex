/**
 * Rendering abstractions for spatial indexes.
 *
 * Frontend: Query strategy, extent transforms, context creation
 * Backend: Value transformation, output format, composition
 */

import type { ExtentResult, QueryResult, Rectangle, SingleOrPartitionedSpatialIndex, SpatialIndex } from '../types.ts';

/** Index with bounds adapter for non-Rectangle coordinate systems */
export interface RenderableIndexAdapter<T, Bounds> extends SpatialIndex<T, Bounds> {
	toBounds(bounds: Readonly<Rectangle>): Bounds;
}

/** Index that can be rendered (native Rectangle or adapted) */
export type RenderableIndex<T> = SpatialIndex<T, Readonly<Rectangle>> | RenderableIndexAdapter<T, unknown>;

/** Base render parameters (extended by backends) */
export interface RenderParams {
	includeOrigin?: boolean;
}

/** Spatial data source (extent + query function) */
export interface RenderSource<T> {
	extent: ExtentResult;
	query: (bounds: Readonly<Rectangle>) => IterableIterator<QueryResult<T>>;
}

/** Layout item with render parameters */
export interface LayoutItem<T, PartialParams extends RenderParams | undefined = undefined> extends RenderSource<T> {
	params: PartialParams;
}

/** Progression step: mutate index, render with specific params */
export interface ProgressionStep<Index, Params extends RenderParams> {
	action: (index: Index) => void;
	params: Params;
}

export type QueryStrategy = 'full' | 'scanline' | 'tiled';

/** Backend context for standalone rendering */
export interface RenderContext<T, Output, Params extends RenderParams> {
	readonly params: Required<Params>;
	render(fragments: Iterable<QueryResult<T>>, extent: ExtentResult, params?: Partial<Params>): Output;
}

/** Backend context for layout composition (partial render + layout) */
export interface LayoutContext<
	T,
	Output,
	LayoutParams extends RenderParams,
	PartialParams extends RenderParams,
	IR = Output,
> {
	readonly params: Required<LayoutParams>;
	renderPartial(fragments: Iterable<QueryResult<T>>, extent: ExtentResult, params: PartialParams): IR;
	layout(irs: Iterable<IR>, params?: Partial<LayoutParams>): Output;
}

/** Backend factory */
export interface RenderBackend<
	Output,
	Params extends RenderParams,
	LayoutParams extends RenderParams,
	PartialParams extends RenderParams,
	IR = Output,
> {
	context<T>(params: Params): RenderContext<T, Output, Params>;
	layoutContext<T>(params: LayoutParams): LayoutContext<T, Output, LayoutParams, PartialParams, IR>;
}

/** Frontend API (render + layout + progression) */
export interface Renderer<
	Output,
	Params extends RenderParams,
	LayoutParams extends RenderParams,
	PartialParams extends RenderParams,
> {
	readonly render: <T>(source: RenderSource<T> | RenderableIndex<T>, renderParams: Params) => Output;
	readonly renderLayout: <T>(
		items: Array<
			LayoutItem<T, PartialParams> | { source: RenderSource<T> | RenderableIndex<T>; params: PartialParams }
		>,
		layoutParams: LayoutParams,
	) => Output;
	readonly renderProgression: <Index extends SingleOrPartitionedSpatialIndex<unknown, unknown>>(
		indexFactory: () => Index,
		steps: Array<ProgressionStep<Index, PartialParams>>,
		layoutParams: LayoutParams,
	) => Output;
}
