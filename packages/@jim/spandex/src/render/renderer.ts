/** Frontend: applies extent transforms, delegates to backend */

import { canonical } from '../r.ts';
import type { ExtentResult, QueryResult, QueryValue, Rectangle, SingleOrPartitionedSpatialIndex } from '../types.ts';
import type {
	LayoutContext,
	LayoutItem,
	ProgressionStep,
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

/** Convert source → resolve includeOrigin → render */
function render<T, Output, Params extends RenderParams>(
	source: RenderSource<T> | RenderableIndex<T>,
	context: RenderContext<T, Output, Params>,
	renderParams?: Partial<Params>,
): Output {
	const { extent, query } = toRenderSource(source);
	const includeOrigin = renderParams?.includeOrigin ?? context.params.includeOrigin;
	const finalExtent = includeOrigin ? applyOriginInclusion(extent) : extent;
	return context.render(query(finalExtent.mbr), finalExtent, renderParams);
}

/**
 * Render each item as partial IR, compose via layout.
 *
 * Type parameter `T` represents the union of all value types from all items.
 * This is inferred by the wrapper interfaces (ASCIIRenderer, HTMLRenderer) using
 * `LayoutItemsValueType<Items>` to compute the union and apply it to layoutParams.
 */
function renderLayout<T, Output, LayoutParams extends RenderParams, PartialParams extends RenderParams, IR>(
	items: ReadonlyArray<
		LayoutItem<T, PartialParams> | { source: RenderSource<T> | RenderableIndex<T>; params: PartialParams }
	>,
	context: LayoutContext<T, Output, LayoutParams, PartialParams, IR>,
	layoutParams?: Partial<LayoutParams>,
): Output {
	const irs = items.map((item) => {
		const { extent, query, params } = 'source' in item ? toLayoutItem(item) : item;
		const includeOrigin = params?.includeOrigin ?? context.params.includeOrigin;
		const finalExtent = includeOrigin ? applyOriginInclusion(extent) : extent;
		return context.renderPartial(query(finalExtent.mbr), finalExtent, params);
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
	layoutParams?: Partial<LayoutParams>,
): Output {
	const index = indexFactory();
	const irs: IR[] = [];
	for (const { params, action } of steps) {
		action(index);
		const { extent, query } = toRenderSource(index) as RenderSource<QueryValue<Index>>;
		const includeOrigin = params?.includeOrigin ?? context.params.includeOrigin;
		const finalExtent = includeOrigin ? applyOriginInclusion(extent) : extent;
		irs.push(context.renderPartial(query(finalExtent.mbr), finalExtent, params));
	}
	return context.layout(irs, layoutParams);
}

/**
 * Create renderer frontend with the specified backend.
 *
 * **Responsibilities**:
 * - Handle `includeOrigin` extent transforms
 * - Delegate rendering to backend
 * - Support standalone, layout, and progression rendering
 *
 * @template Output - Final rendered output type (e.g., string, HTMLElement)
 * @template Params - Full render parameters
 * @template LayoutParams - Layout composition parameters
 * @template PartialParams - Per-item render parameters
 * @template IR - Intermediate representation for layout composition
 *
 * @param backend - Backend implementation (creates contexts)
 * @returns Renderer instance with render, renderLayout, renderProgression
 *
 * @example
 * ```typescript
 * import { createRenderer } from '@jim/spandex/render';
 * import { ASCIIBackend } from '@jim/spandex-ascii';
 *
 * const backend = new ASCIIBackend();
 * const renderer = createRenderer(backend, 'full');
 * ```
 */
export function createRenderer<
	Output,
	Params extends RenderParams,
	LayoutParams extends RenderParams,
	PartialParams extends RenderParams,
	IR = Output,
>(
	backend: RenderBackend<Output, Params, LayoutParams, PartialParams, IR>,
): Renderer<Output, Params, LayoutParams, PartialParams> {
	return {
		render: (source, params) => render(source, backend.context(params)),
		renderLayout: (items, params) => renderLayout(items, backend.layoutContext(params)),
		renderProgression: (indexFactory, steps, params) =>
			renderProgression(indexFactory, steps, backend.layoutContext(params)),
	};
}
