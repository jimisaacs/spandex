/** Frontend: applies query strategy, extent transforms, delegates to backend */

import { canonical } from '../r.ts';
import type { ExtentResult, QueryResult, QueryValue, Rectangle, SingleOrPartitionedSpatialIndex } from '../types.ts';
import type {
	LayoutContext,
	LayoutItem,
	ProgressionStep,
	QueryStrategy,
	RenderableIndex,
	RenderBackend,
	RenderContext,
	Renderer,
	RenderParams,
	RenderSource,
} from './types.ts';

function applyOriginInclusion(extent: ExtentResult): ExtentResult {
	const [xmin, ymin, xmax, ymax] = extent.mbr;
	return {
		...extent,
		mbr: canonical([Math.min(0, xmin), Math.min(0, ymin), Math.max(0, xmax), Math.max(0, ymax)]),
	};
}

function* scanlineStrategy<T>(
	mbr: Readonly<Rectangle>,
	query: (bounds: Readonly<Rectangle>) => IterableIterator<QueryResult<T>>,
): IterableIterator<QueryResult<T>> {
	const [xmin, ymin, xmax, ymax] = mbr;
	for (let y = ymin; y <= ymax; y++) yield* query([xmin, y, xmax, y]);
}

const TILE_SIZE = 1;

function* tiledStrategy<T>(
	mbr: Readonly<Rectangle>,
	query: (bounds: Readonly<Rectangle>) => IterableIterator<QueryResult<T>>,
): IterableIterator<QueryResult<T>> {
	const [xmin, ymin, xmax, ymax] = mbr;
	for (let y = ymin; y <= ymax; y += TILE_SIZE) {
		for (let x = xmin; x <= xmax; x += TILE_SIZE) {
			yield* query([x, y, x + TILE_SIZE - 1, y + TILE_SIZE - 1]);
		}
	}
}

function applyStrategy<T>(
	mbr: Readonly<Rectangle>,
	query: (bounds: Readonly<Rectangle>) => IterableIterator<QueryResult<T>>,
	strategy: QueryStrategy,
): IterableIterator<QueryResult<T>> {
	switch (strategy) {
		case 'full':
			return query(mbr);
		case 'scanline':
			return scanlineStrategy(mbr, query);
		case 'tiled':
			return tiledStrategy(mbr, query);
		default:
			throw new Error(`Unknown strategy: ${strategy}`);
	}
}

function toRenderSource<T>(source: RenderSource<T> | RenderableIndex<T>): RenderSource<T> {
	if (!('insert' in source)) return source;
	const query = 'toBounds' in source
		? (bounds: Readonly<Rectangle>) => source.query(source.toBounds(bounds))
		: (bounds: Readonly<Rectangle>) => source.query(bounds);
	return { extent: source.extent(), query };
}

function toLayoutItem<T, PartialParams extends RenderParams>(
	{ source, params }: { source: RenderSource<T> | RenderableIndex<T>; params: PartialParams },
): LayoutItem<T, PartialParams> {
	return { ...toRenderSource(source), params };
}

/** Convert source → resolve includeOrigin → apply strategy → render */
function render<T, Output, Params extends RenderParams>(
	source: RenderSource<T> | RenderableIndex<T>,
	context: RenderContext<T, Output, Params>,
	strategy: QueryStrategy,
	renderParams?: Partial<Params>,
): Output {
	const { extent, query } = toRenderSource(source);
	const includeOrigin = renderParams?.includeOrigin ?? context.params.includeOrigin;
	const finalExtent = includeOrigin ? applyOriginInclusion(extent) : extent;
	return context.render(applyStrategy(finalExtent.mbr, query, strategy), finalExtent, renderParams);
}

/** Render each item as partial IR, compose via layout */
function renderLayout<T, Output, LayoutParams extends RenderParams, PartialParams extends RenderParams, IR>(
	items: Array<
		LayoutItem<T, PartialParams> | { source: RenderSource<T> | RenderableIndex<T>; params: PartialParams }
	>,
	context: LayoutContext<T, Output, LayoutParams, PartialParams, IR>,
	strategy: QueryStrategy,
	layoutParams?: Partial<LayoutParams>,
): Output {
	const irs = items.map((item) => {
		const { extent, query, params } = 'source' in item ? toLayoutItem(item) : item;
		const includeOrigin = params?.includeOrigin ?? context.params.includeOrigin;
		const finalExtent = includeOrigin ? applyOriginInclusion(extent) : extent;
		return context.renderPartial(applyStrategy(finalExtent.mbr, query, strategy), finalExtent, params);
	});
	return context.layout(irs, layoutParams);
}

/** Mutate index cumulatively, render each state */
function renderProgression<
	Output,
	Index extends SingleOrPartitionedSpatialIndex<unknown, unknown>,
	LayoutParams extends RenderParams,
	PartialParams extends RenderParams,
	IR,
>(
	indexFactory: () => Index,
	steps: Array<ProgressionStep<Index, PartialParams>>,
	context: LayoutContext<QueryValue<Index>, Output, LayoutParams, PartialParams, IR>,
	strategy: QueryStrategy,
	layoutParams?: Partial<LayoutParams>,
): Output {
	const index = indexFactory();
	const irs: IR[] = [];
	for (const { params, action } of steps) {
		action(index);
		const { extent, query } = toRenderSource(index) as RenderSource<QueryValue<Index>>;
		const includeOrigin = params?.includeOrigin ?? context.params.includeOrigin;
		const finalExtent = includeOrigin ? applyOriginInclusion(extent) : extent;
		irs.push(context.renderPartial(applyStrategy(finalExtent.mbr, query, strategy), finalExtent, params));
	}
	return context.layout(irs, layoutParams);
}

export function createRenderer<
	Output,
	Params extends RenderParams,
	LayoutParams extends RenderParams,
	PartialParams extends RenderParams,
	IR = Output,
>(
	backend: RenderBackend<Output, Params, LayoutParams, PartialParams, IR>,
	strategy: QueryStrategy,
): Renderer<Output, Params, LayoutParams, PartialParams> {
	return {
		render: (source, params) => render(source, backend.context(params), strategy),
		renderLayout: (items, params) => renderLayout(items, backend.layoutContext(params), strategy),
		renderProgression: (indexFactory, steps, params) =>
			renderProgression(indexFactory, steps, backend.layoutContext(params), strategy),
	};
}
