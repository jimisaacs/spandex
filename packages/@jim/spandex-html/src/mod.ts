/**
 * @module
 *
 * HTML table renderer for spatial indexes. Generates styled HTML tables for debugging and visualization.
 *
 * @example
 * ```typescript
 * import { createRenderer } from '@jim/spandex-html';
 * import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
 *
 * const index = createMortonLinearScanIndex<string>();
 * index.insert([0, 0, 2, 2], 'red');
 * index.insert([1, 1, 3, 3], 'blue');
 *
 * const { render } = createRenderer<string>();
 * const html = render(index, {
 *   legend: {
 *     red: { label: 'R', color: '#ff0000', value: 'red' },
 *     blue: { label: 'B', color: '#0000ff', value: 'blue' }
 *   },
 *   showCoordinates: true,
 *   cellWidth: 50,
 *   cellHeight: 50
 * });
 *
 * // Write to file or serve via HTTP
 * await Deno.writeTextFile('output.html', `<!DOCTYPE html><html><body>${html}</body></html>`);
 * ```
 */

import * as frontend from '@jim/spandex/render';
import { HTMLBackend } from './backend.ts';
import type { HTMLLayoutParams, HTMLPartialParams, HTMLRenderParams } from './types.ts';

export * from './types.ts';

/**
 * Create an HTML table renderer for spatial indexes.
 *
 * Returns a renderer instance with `render` and `renderLayout` methods for
 * generating styled HTML tables with infinite edge visualization.
 *
 * @returns Renderer instance with render and renderLayout methods
 *
 * @example
 * ```typescript
 * const { render } = createRenderer<string>();
 * const html = render(index, {
 *   legend: {
 *     red: { label: 'R', color: '#ff0000', value: 'red' }
 *   }
 * });
 * ```
 */
export function createRenderer(): frontend.Renderer<
	string,
	HTMLRenderParams<unknown>,
	HTMLLayoutParams<unknown>,
	HTMLPartialParams<unknown>
> {
	return frontend.createRenderer(new HTMLBackend(), 'full');
}
