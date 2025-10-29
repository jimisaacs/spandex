/**
 * @module
 *
 * ASCII grid renderer for spatial indexes. Terminal/log-friendly visualization with round-trip parsing.
 *
 * Renders spatial indexes as ASCII grids using box-drawing characters. Supports standalone rendering,
 * multi-grid layouts, and progression rendering (step-by-step visualization).
 *
 * @example
 * ```typescript
 * import { createRenderer } from '@jim/spandex-ascii';
 * import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
 * import { createA1Adapter } from '@jim/spandex/adapter/a1';
 *
 * const index = createMortonLinearScanIndex<'red'>();
 * const adapter = createA1Adapter(index);
 * adapter.insert('A1:C2', 'red');
 *
 * const { render } = createRenderer();
 * console.log(render(adapter, { legend: { R: 'red' } }));
 * ```
 */

import type { QueryValue, SingleOrPartitionedSpatialIndex } from '@jim/spandex';
import * as frontend from '@jim/spandex/render';
import { ASCIIBackend } from './backend.ts';
import type { ASCIILayoutParams, ASCIIPartialParams, ASCIIRenderParams } from './types.ts';

export * from './parse.ts';
export * from './types.ts';

/**
 * ASCII renderer interface with type-safe legend validation.
 *
 * Provides three rendering modes:
 * - `render` - Single grid with full legend validation
 * - `renderLayout` - Multiple grids side-by-side with shared legend
 * - `renderProgression` - Step-by-step visualization with layout
 *
 * @example
 * ```typescript
 * const { render, renderLayout } = createRenderer();
 *
 * // Single grid
 * const grid = render(index, { legend: { R: 'red' } });
 *
 * // Multiple grids with union type validation
 * const layout = renderLayout(
 *   [
 *     { source: indexA, params: { name: 'A' } },
 *     { source: indexB, params: { name: 'B' } }
 *   ],
 *   { legend: { R: 'red', B: 'blue' } } // Must include all value types
 * );
 * ```
 */
interface ASCIIRenderer {
	/**
	 * Render single source or index to ASCII grid.
	 *
	 * Legend keys must match values in the source (type-safe).
	 *
	 * @param source - Spatial index or render source with bounds
	 * @param renderParams - Render options (legend, gridOnly, includeOrigin, strict)
	 * @returns ASCII grid as string
	 */
	readonly render: <S extends frontend.RenderSource<unknown> | frontend.RenderableIndex<unknown>>(
		source: S,
		renderParams: ASCIIRenderParams<QueryValue<S>>,
	) => string;

	/**
	 * Render multiple grids side-by-side with shared legend.
	 *
	 * Legend must cover the union of all value types from all items (type-safe).
	 *
	 * @param items - Array of sources with per-item params (name, includeOrigin)
	 * @param layoutParams - Layout options (legend, spacing, strict)
	 * @returns Composed ASCII layout as string
	 */
	readonly renderLayout: <
		Items extends ReadonlyArray<
			frontend.LayoutItem<unknown, ASCIIPartialParams> | {
				source: frontend.RenderSource<unknown> | frontend.RenderableIndex<unknown>;
				params: ASCIIPartialParams;
			}
		>,
	>(
		items: Items,
		layoutParams: ASCIILayoutParams<frontend.LayoutItemsValueType<Items>>,
	) => string;

	/**
	 * Render progression: mutate index step-by-step, visualize each state.
	 *
	 * Useful for demonstrating insert operations and decomposition behavior.
	 *
	 * @param indexFactory - Factory function to create fresh index
	 * @param steps - Array of mutation steps with per-step params
	 * @param layoutParams - Layout options for composing all steps
	 * @returns Composed progression layout as string
	 */
	readonly renderProgression: <Index extends SingleOrPartitionedSpatialIndex<unknown, unknown>>(
		indexFactory: () => Index,
		steps: Array<frontend.ProgressionStep<Index, ASCIIPartialParams>>,
		layoutParams: ASCIILayoutParams<QueryValue<Index>>,
	) => string;
}

/**
 * Create ASCII grid renderer for spatial indexes.
 *
 * @returns Renderer instance with render, renderLayout, and renderProgression methods
 */
export function createRenderer(): ASCIIRenderer {
	return frontend.createRenderer(new ASCIIBackend(), 'full') satisfies ASCIIRenderer;
}
