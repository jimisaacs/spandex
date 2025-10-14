/**
 * Render-Only Edge Cases
 *
 * Tests for rendering features that CANNOT be parsed (no round-trip).
 * - Grid-only mode (excludes legend/annotations)
 * - Legend validation and error handling
 *
 * Keep this file minimal - most tests belong in regression.test.ts.
 */

import { MortonLinearScanImpl } from '@jim/spandex';
import { render } from '@jim/spandex-ascii';
import { assertEquals, assertStringIncludes, assertThrows } from '@std/assert';

Deno.test('Render - Grid Only Mode', () => {
	const index = new MortonLinearScanImpl<string>();
	index.insert([0, 0, 1, 0], 'RED');
	index.insert([2, 0, 2, 0], 'BLUE');

	const gridOnly = render(() => index.query(), {
		'R': 'RED',
		'B': 'BLUE',
	}, { gridOnly: true });

	// Verify legend is excluded
	assertEquals(gridOnly.includes('R = "RED"'), false);
	assertEquals(gridOnly.includes('B = "BLUE"'), false);
	// Grid content should still be present
	assertStringIncludes(gridOnly, '| R |');
	assertStringIncludes(gridOnly, '| B |');
});

Deno.test('Render - Grid Only Excludes Infinity Annotations', () => {
	const index = new MortonLinearScanImpl<string>();
	index.insert([-Infinity, 0, Infinity, 0], 'HORIZONTAL');

	const gridOnly = render(() => index.query(), { 'H': 'HORIZONTAL' }, { gridOnly: true });

	// Verify infinity annotation is excluded
	assertEquals(gridOnly.includes('∞ edges'), false);
	// Grid content should still be present
	assertStringIncludes(gridOnly, 'H');
});

Deno.test('Render - Legend Validation: Unused Symbols Allowed', () => {
	const index = new MortonLinearScanImpl<string>();
	index.insert([0, 0, 1, 0], 'RED');

	// Should NOT throw (unused symbols allowed by default)
	const result = render(() => index.query(), {
		'R': 'RED',
		'B': 'BLUE', // Unused but allowed
	});

	assertStringIncludes(result, 'R = "RED"');
	assertStringIncludes(result, 'B = "BLUE"');
});

Deno.test('Render - Legend Validation: Missing Symbol Throws', () => {
	const index = new MortonLinearScanImpl<string>();
	index.insert([0, 0, 1, 0], 'RED');
	index.insert([2, 0, 2, 0], 'BLUE');

	assertThrows(
		() => {
			render(() => index.query(), {
				'R': 'RED',
				// Missing 'B' for BLUE
			});
		},
		Error,
		'Render error: Legend missing symbol for value "BLUE"',
	);
});

Deno.test('Render - Strict Mode: Unused Symbols Throw', () => {
	const index = new MortonLinearScanImpl<string>();
	index.insert([0, 0, 1, 0], 'RED');

	assertThrows(
		() => {
			render(() => index.query(), {
				'R': 'RED',
				'B': 'BLUE', // Unused
			}, { strict: true });
		},
		Error,
		'Render error (strict mode): Legend contains unused symbols: B',
	);
});

Deno.test('Render - Strict Mode: All Used Passes', () => {
	const index = new MortonLinearScanImpl<string>();
	index.insert([0, 0, 1, 0], 'RED');
	index.insert([2, 0, 2, 0], 'BLUE');

	// Should not throw
	const result = render(() => index.query(), {
		'R': 'RED',
		'B': 'BLUE',
	}, { strict: true });

	assertStringIncludes(result, '| R |');
	assertStringIncludes(result, '| B |');
});
