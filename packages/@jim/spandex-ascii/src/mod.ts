/**
 * @module
 *
 * ASCII grid renderer for spatial indexes. Terminal/log-friendly visualization with round-trip parsing.
 *
 * Renders spatial indexes as ASCII grids using box-drawing characters. Supports progression rendering
 * and round-trip parsing (render → parse → render).
 *
 * @example
 * ```typescript
 * import { createRenderer } from '@jim/spandex-ascii';
 * import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
 *
 * const index = createMortonLinearScanIndex<string>();
 * index.insert([0, 0, 2, 1], 'RED');
 *
 * const { render } = createRenderer();
 * console.log(render(index, { legend: { 'R': 'RED' } }));
 * ```
 */

import * as frontend from '@jim/spandex/render';
import { ASCIIBackend } from './backend.ts';
import type { ASCIILayoutParams, ASCIIPartialParams, ASCIIRenderParams } from './types.ts';

export * from './parse.ts';
export * from './types.ts';

export function createRenderer(): frontend.Renderer<
	string,
	ASCIIRenderParams<unknown>,
	ASCIILayoutParams<unknown>,
	ASCIIPartialParams
> {
	return frontend.createRenderer(new ASCIIBackend(), 'full');
}
