/**
 * @module
 *
 * HTML table renderer for spatial indexes. Generates styled HTML tables with visual gradients and
 * infinite edge indicators for debugging and visualization.
 *
 * Supports standalone rendering, multi-grid layouts, and progression rendering (step-by-step visualization).
 * Features include custom cell colors, gradient-based infinite edge visualization, and coordinate labels.
 *
 * @example
 * ```typescript
 * import { createRenderer } from '@jim/spandex-html';
 * import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
 * import { createA1Adapter } from '@jim/spandex/adapter/a1';
 *
 * const index = createMortonLinearScanIndex<'red' | 'blue'>();
 * const adapter = createA1Adapter(index);
 * adapter.insert('A1:C2', 'red');
 * adapter.insert('B2:D3', 'blue');
 *
 * const { render } = createRenderer();
 * const html = render(adapter, {
 *   legend: {
 *     R: { label: 'R', color: '#ff0000', value: 'red' },
 *     B: { label: 'B', color: '#0000ff', value: 'blue' }
 *   }
 * });
 *
 * // Write to file or serve via HTTP
 * await Deno.writeTextFile('output.html', `<!DOCTYPE html><html><body>${html}</body></html>`);
 * ```
 */

import type { QueryValue, SingleOrPartitionedSpatialIndex } from '@jim/spandex';
import * as frontend from '@jim/spandex/render';
import { HTMLBackend } from './backend.ts';
import type { HTMLLayoutParams, HTMLPartialParams, HTMLRenderParams } from './types.ts';

export * from './types.ts';

/**
 * HTML renderer interface with type-safe legend validation.
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
 * // Single grid with colors
 * const grid = render(index, {
 *   legend: {
 *     R: { label: 'R', color: '#ff0000', value: 'red' }
 *   }
 * });
 *
 * // Multiple grids with union type validation
 * const layout = renderLayout(
 *   [
 *     { source: indexA, params: { name: 'A' } },
 *     { source: indexB, params: { name: 'B' } }
 *   ],
 *   {
 *     legend: {
 *       R: { label: 'R', color: '#ff0000', value: 'red' },
 *       B: { label: 'B', color: '#0000ff', value: 'blue' }
 *     }
 *   }
 * );
 * ```
 */
interface HTMLRenderer {
	/**
	 * Render single source or index to HTML table.
	 *
	 * Legend keys must match values in the source (type-safe). Each legend entry
	 * specifies label, color, and value for visual representation.
	 *
	 * @param source - Spatial index or render source with bounds
	 * @param renderParams - Render options (legend, cellWidth, cellHeight, showCoordinates, etc.)
	 * @returns HTML table as string
	 */
	readonly render: <S extends frontend.RenderSource<unknown> | frontend.RenderableIndex<unknown>>(
		source: S,
		renderParams: HTMLRenderParams<QueryValue<S>>,
	) => string;

	/**
	 * Render multiple grids side-by-side with shared legend.
	 *
	 * Legend must cover the union of all value types from all items (type-safe).
	 * Grids can be arranged horizontally or vertically.
	 *
	 * @param items - Array of sources with per-item params (name, includeOrigin)
	 * @param layoutParams - Layout options (legend, direction, spacing, title, strict)
	 * @returns Composed HTML layout as string
	 */
	readonly renderLayout: <
		Items extends ReadonlyArray<
			frontend.LayoutItem<unknown, HTMLPartialParams<unknown>> | {
				source: frontend.RenderSource<unknown> | frontend.RenderableIndex<unknown>;
				params: HTMLPartialParams<unknown>;
			}
		>,
	>(
		items: Items,
		layoutParams: HTMLLayoutParams<frontend.LayoutItemsValueType<Items>>,
	) => string;

	/**
	 * Render progression: mutate index step-by-step, visualize each state.
	 *
	 * Useful for demonstrating insert operations and decomposition behavior.
	 *
	 * @param indexFactory - Factory function to create fresh index
	 * @param steps - Array of mutation steps with per-step params
	 * @param layoutParams - Layout options for composing all steps
	 * @returns Composed progression layout as HTML string
	 */
	readonly renderProgression: <Index extends SingleOrPartitionedSpatialIndex<unknown, unknown>>(
		indexFactory: () => Index,
		steps: Array<frontend.ProgressionStep<Index, HTMLPartialParams<QueryValue<Index>>>>,
		layoutParams: HTMLLayoutParams<QueryValue<Index>>,
	) => string;
}

/**
 * Create HTML table renderer for spatial indexes.
 *
 * @returns Renderer instance with render, renderLayout, and renderProgression methods
 */
export function createRenderer(): HTMLRenderer {
	return frontend.createRenderer(new HTMLBackend(), 'full') satisfies HTMLRenderer;
}
