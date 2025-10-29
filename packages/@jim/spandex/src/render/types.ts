/**
 * Rendering abstractions for spatial indexes.
 *
 * Frontend: Query strategy, extent transforms, context creation
 * Backend: Value transformation, output format, composition
 */

import type { ExtentResult, QueryResult, Rectangle, SingleOrPartitionedSpatialIndex, SpatialIndex } from '../types.ts';

/** Index with bounds adapter for non-Rectangle coordinate systems */
export interface RenderableIndexAdapter<T, Bounds> extends SpatialIndex<T, Bounds> {
	/** Convert Rectangle to adapter's Bounds type */
	toBounds(bounds: Readonly<Rectangle>): Bounds;
}

/** Index that can be rendered (native Rectangle or adapted) */
export type RenderableIndex<T> = SpatialIndex<T, Readonly<Rectangle>> | RenderableIndexAdapter<T, unknown>;

/** Base render parameters (extended by backends) */
export interface RenderParams {
	/** Include origin (0,0) in render output */
	includeOrigin?: boolean;
}

/** Spatial data source (extent + query function) */
export interface RenderSource<T> {
	/** Spatial extent (MBR + infinity edges) */
	extent: ExtentResult;
	/** Query fragments intersecting bounds */
	query: (bounds: Readonly<Rectangle>) => IterableIterator<QueryResult<T>>;
}

/** Layout item with render parameters */
export interface LayoutItem<T, PartialParams extends RenderParams | undefined = undefined> extends RenderSource<T> {
	/** Render parameters for this layout item */
	params: PartialParams;
}

/** Progression step: mutate index, render with specific params */
export interface ProgressionStep<Index, Params extends RenderParams> {
	/** Mutate index (e.g., insert operation) */
	action: (index: Index) => void;
	/** Render parameters for this step */
	params: Params;
}

/** Query strategy: 'full' = query all, 'scanline' = row-by-row, 'tiled' = tiled regions */
export type QueryStrategy = 'full' | 'scanline' | 'tiled';

/** Backend context for standalone rendering */
export interface RenderContext<T, Output, Params extends RenderParams> {
	/** Default render parameters (fully specified) */
	readonly params: Required<Params>;
	/** Render fragments to output format */
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
	/** Default layout parameters (fully specified) */
	readonly params: Required<LayoutParams>;
	/** Render fragments to intermediate representation (IR) */
	renderPartial(fragments: Iterable<QueryResult<T>>, extent: ExtentResult, params: PartialParams): IR;
	/** Compose intermediate representations into final output */
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
	/** Create render context for standalone rendering */
	context<T>(params: Params): RenderContext<T, Output, Params>;
	/** Create layout context for composition (partial render + layout) */
	layoutContext<T>(params: LayoutParams): LayoutContext<T, Output, LayoutParams, PartialParams, IR>;
}

/**
 * Extract value type T from a single layout item.
 *
 * Handles both `LayoutItem<T>` and inline `{ source: RenderSource<T>, params: ... }` objects.
 */
type ExtractItemValueType<Item> = Item extends LayoutItem<infer T, any> ? T
	: Item extends { source: RenderSource<infer T> | RenderableIndex<infer T> } ? T
	: never;

/**
 * Extract union of all value types from an array of layout items.
 *
 * Used to constrain `layoutParams` legend to accept union of all item value types.
 *
 * @example
 * ```typescript
 * type Items = [
 *   LayoutItem<'A', Params>,
 *   { source: RenderSource<'B'>, params: Params }
 * ];
 * type Union = LayoutItemsValueType<Items>; // 'A' | 'B'
 * ```
 */
export type LayoutItemsValueType<Items extends readonly unknown[]> = Items extends readonly [infer Head, ...infer Tail]
	? ExtractItemValueType<Head> | LayoutItemsValueType<Tail>
	: Items[number] extends infer Item ? ExtractItemValueType<Item>
	: never;

/** Frontend API (render + layout + progression) */
export interface Renderer<
	Output,
	Params extends RenderParams,
	LayoutParams extends RenderParams,
	PartialParams extends RenderParams,
> {
	/** Render single source or index to output */
	readonly render: <T>(source: RenderSource<T> | RenderableIndex<T>, renderParams: Params) => Output;
	/** Render multiple items with individual params, compose into single output */
	readonly renderLayout: <T>(
		items: ReadonlyArray<
			LayoutItem<T, PartialParams> | { source: RenderSource<T> | RenderableIndex<T>; params: PartialParams }
		>,
		layoutParams: LayoutParams,
	) => Output;
	/** Render progression: create index, apply steps, render each step */
	readonly renderProgression: <Index extends SingleOrPartitionedSpatialIndex<unknown, unknown>>(
		indexFactory: () => Index,
		steps: Array<ProgressionStep<Index, PartialParams>>,
		layoutParams: LayoutParams,
	) => Output;
}
