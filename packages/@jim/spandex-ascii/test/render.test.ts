/** Render-only edge cases (grid-only mode, legend validation) */

import { createRenderer } from '@jim/spandex-ascii';
import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
import * as r from '@jim/spandex/r';
import { assertEquals, assertStringIncludes, assertThrows } from '@std/assert';

Deno.test('Render - Grid Only Mode', () => {
	const { render } = createRenderer();
	const index = createMortonLinearScanIndex<string>();
	index.insert([0, 0, 1, 0], 'RED');
	index.insert([2, 0, 2, 0], 'BLUE');

	const gridOnly = render(index, {
		legend: { 'R': 'RED', 'B': 'BLUE' },
		gridOnly: true,
	});

	// Verify legend is excluded
	assertEquals(gridOnly.includes('R = "RED"'), false);
	assertEquals(gridOnly.includes('B = "BLUE"'), false);
	// Grid content should still be present
	assertStringIncludes(gridOnly, '┃ R ┃');
	assertStringIncludes(gridOnly, '┃ B ┃');
});

Deno.test('Render - Grid Only Excludes infinity edge annotations', () => {
	const { render } = createRenderer();

	const index = createMortonLinearScanIndex<string>();
	index.insert([r.negInf, 0, r.posInf, 0], 'HORIZONTAL');

	const gridOnly = render(index, { legend: { 'H': 'HORIZONTAL' }, gridOnly: true });

	// Verify infinity annotation is excluded
	assertEquals(gridOnly.includes('∞ edges'), false);
	// Grid content should still be present
	assertStringIncludes(gridOnly, 'H');
});

Deno.test('Render - Legend Validation: Unused Legend Keys Allowed', () => {
	const { render } = createRenderer();

	const index = createMortonLinearScanIndex<string>();
	index.insert([0, 0, 1, 0], 'RED');

	// Should NOT throw (unused legend keys allowed by default)
	const result = render(index, {
		legend: {
			'R': 'RED',
			'B': 'BLUE', // Unused but allowed
		},
		strict: false,
	});

	assertStringIncludes(result, 'R = "RED"');
	assertStringIncludes(result, 'B = "BLUE"');
});

Deno.test('Render - Legend Validation: Missing Key Throws', () => {
	const { render } = createRenderer();

	const index = createMortonLinearScanIndex<string>();
	index.insert([0, 0, 1, 0], 'RED');
	index.insert([2, 0, 2, 0], 'BLUE');

	assertThrows(
		() => {
			render(index, { legend: { 'R': 'RED' } });
		},
		Error,
		'Missing legend key for value "BLUE"',
	);
});

Deno.test('Render - Strict Mode: Unused Legend Keys Throw', () => {
	const { render } = createRenderer();

	const index = createMortonLinearScanIndex<string>();
	index.insert([0, 0, 1, 0], 'RED');

	assertThrows(
		() => {
			render(index, {
				legend: { 'R': 'RED', 'B': 'BLUE' },
				strict: true,
			});
		},
		Error,
		'unused legend key',
	);
});

Deno.test('Render - Strict Mode: All Used Passes', () => {
	const { render } = createRenderer();

	const index = createMortonLinearScanIndex<string>();
	index.insert([0, 0, 1, 0], 'RED');
	index.insert([2, 0, 2, 0], 'BLUE');

	// Should not throw
	const result = render(index, {
		legend: { 'R': 'RED', 'B': 'BLUE' },
		strict: true,
	});

	assertStringIncludes(result, '┃ R ┃');
	assertStringIncludes(result, '┃ B ┃');
});
