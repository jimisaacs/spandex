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
