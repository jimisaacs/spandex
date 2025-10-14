/**
 * Example: Image data URI codec
 *
 * Demonstrates encoding images as data URIs that display in markdown.
 * Uses SVG for simplicity - could also use PNG, JPEG, etc.
 */

import { createFixtureGroup, imageDataUriCodec } from '@local/snapmark';

// Helper: Create a simple SVG image
function createSvg(color: string, size: number): Uint8Array {
	const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="${color}"/>
</svg>`;
	return new TextEncoder().encode(svg);
}

Deno.test('Image data URI - Ancient pottery colors', async (t) => {
	const { assertMatchStep, flush } = createFixtureGroup(imageDataUriCodec('image/svg+xml'), { context: t });

	// Mesopotamian glazes
	await assertMatchStep(t, 'Egyptian blue', createSvg('#1034A6', 100));
	// Greek pottery
	await assertMatchStep(t, 'Terracotta red', createSvg('#E2725B', 100));
	// Roman frescoes
	await assertMatchStep(t, 'Pompeian red', createSvg('#CC4E5C', 100));

	await flush();
});
