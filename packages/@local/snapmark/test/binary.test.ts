/**
 * Example: Adapter composition
 *
 * Demonstrates composing adapters to create custom encoding pipelines.
 */

import { base64Adapter, binaryCodec, createFixtureGroup, jsonCodec } from '@local/snapmark';

// Base64-encoded JSON (for compact storage)

interface Scroll {
	title: string;
	date: string;
}

Deno.test('Base64 JSON - Ancient scrolls', async (t) => {
	const { assertMatchStep, flush } = createFixtureGroup(base64Adapter(jsonCodec<Scroll>()), { context: t });

	await assertMatchStep(t, 'Dead Sea Scrolls', {
		title: 'Isaiah Scroll',
		date: '125 BCE',
	});

	await assertMatchStep(t, 'Library of Alexandria catalog', {
		title: 'Works of Aristotle',
		date: '300 BCE',
	});

	await flush();
});

// Raw binary (for byte-perfect testing)

Deno.test('Binary codec - Cuneiform tablet bytes', async (t) => {
	const { assertMatchStep, flush } = createFixtureGroup(binaryCodec(), { context: t });

	// Simulate ancient writing system bytes
	const tablet = new Uint8Array([0x12, 0x34, 0x56, 0x78]);

	await assertMatchStep(t, 'Mesopotamian cuneiform', tablet);

	await flush({ append: true });
});
