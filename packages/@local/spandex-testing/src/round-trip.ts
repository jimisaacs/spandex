/**
 * Round-trip validation utilities for ASCII rendering/parsing.
 *
 * Validates that: render → parse → render produces identical output.
 */

import { type ASCIILayoutParams, type ASCIIRenderParams, createRenderer, parse } from '@jim/spandex-ascii';
import type { RenderSource } from '@jim/spandex/render';
import { assertEquals, assertExists, assertGreater } from '@std/assert';

/**
 * Validate full round-trip: render → parse → render → verify identical output.
 *
 * This ensures:
 * 1. Rendered output can be parsed
 * 2. Parsed data contains all necessary information
 * 3. Re-rendering parsed data produces identical output
 *
 * @param ascii - The rendered ASCII to validate
 * @param expectedGridCount - Expected number of grids
 * @param params - Render parameters (type depends on useLayout)
 * @param useLayout - If true, use renderLayout() with ASCIILayoutParams; if false (default), use render() with ASCIIRenderParams
 */
export function validateRoundTrip<T>(
	ascii: string,
	expectedGridCount: number,
	params: ASCIIRenderParams<T>,
	useLayout?: false,
): void;
export function validateRoundTrip<T>(
	ascii: string,
	expectedGridCount: number,
	params: ASCIILayoutParams<T>,
	useLayout: true,
): void;
export function validateRoundTrip<T>(
	ascii: string,
	expectedGridCount: number,
	params: ASCIIRenderParams<T> | ASCIILayoutParams<T>,
	useLayout: boolean = false,
): void {
	const { grids, legend: parsedLegend } = parse<T>(ascii);

	// Should parse successfully without throwing
	assertGreater(grids.length, 0, 'Parse should produce at least one grid');
	assertEquals(grids.length, expectedGridCount, `Expected ${expectedGridCount} grids, got ${grids.length}`);
	assertEquals(parsedLegend, params.legend, 'Legend should match');

	// Re-render using the appropriate renderer
	const { render, renderLayout } = createRenderer();

	// Convert parsed grids to render sources
	const sources: RenderSource<T>[] = grids.map(({ extent, results }) => ({
		extent,
		query: function* () {
			yield* results;
		},
	}));
	assertExists(sources[0], 'Must have at least one parsed grid');

	// Determine which renderer to use
	const reRendered = useLayout
		? renderLayout(
			sources.map((source, index) => {
				const { name = `Unnamed ${index + 1}`, includeOrigin } = grids[index]!;
				return { source, params: { name, includeOrigin } };
			}),
			params,
		)
		: render(sources[0], params);

	// Verify round-trip matches
	assertEquals(reRendered, ascii, 'Re-rendered output should match original ASCII');
}
