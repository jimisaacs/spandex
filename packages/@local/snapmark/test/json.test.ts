import { createFixtureGroup, jsonCodec } from '../src/mod.ts';

interface Artifact {
	name: string;
	origin: string;
	yearDiscovered: number;
}

Deno.test('JSON codec - Archaeological artifacts', async (t) => {
	const { assertMatchStep, flush } = createFixtureGroup(jsonCodec<Artifact>(), { context: t });

	await assertMatchStep(t, 'Single item', {
		name: 'Rosetta Stone',
		origin: 'Egypt',
		yearDiscovered: 1799,
	});

	await assertMatchStep(t, 'Mesopotamian tablet', {
		name: 'Epic of Gilgamesh tablet',
		origin: 'Mesopotamia',
		yearDiscovered: 1853,
	});

	await assertMatchStep(t, 'Prehistoric tools', {
		name: 'Oldowan stone tools',
		origin: 'East Africa',
		yearDiscovered: 1931,
	});

	await flush();
});

interface Civilization {
	name: string;
	period: string;
	region: string;
}

Deno.test('JSON codec - Ancient civilizations', async (t) => {
	const { assertMatchStep, flush } = createFixtureGroup(jsonCodec<Civilization>(), { context: t });

	await assertMatchStep(t, 'Sumer', {
		name: 'Sumer',
		period: '4500-1900 BCE',
		region: 'Mesopotamia',
	});

	await assertMatchStep(t, 'Ancient Egypt', {
		name: 'Ancient Egypt',
		period: '3100-30 BCE',
		region: 'Nile Valley',
	});

	await flush({ append: true });
});
