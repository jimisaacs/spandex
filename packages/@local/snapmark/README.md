# @local/snapmark

Snapshot testing with markdown storage and composable codecs.

## What It Does

Store test snapshots as readable markdown. Codecs control serialization, comparison, and rendering. Compose adapters for complex transformations like base64 or data URIs.

```typescript
import { createFixtureGroup, jsonCodec } from '@local/snapmark';

interface Civilization {
	name: string;
	period: string;
	region: string;
}

Deno.test('Ancient civilizations', async (t) => {
	const { assertMatchStep, flush } = createFixtureGroup(jsonCodec<Civilization>(), { context: t });

	await assertMatchStep(t, 'Sumer', {
		name: 'Sumer',
		period: '4500-1900 BCE',
		region: 'Mesopotamia',
	});

	await flush();
});
```

First run captures snapshots. Subsequent runs compare. Update with `UPDATE_FIXTURES=1 deno test`.

## Codecs

- `jsonCodec<T>()` - Semantic comparison (ignores formatting)
- `stringCodec<T>()` - Plain text
- `binaryCodec()` - Uint8Array

## Adapters

- `base64Adapter(codec)` - Encode as base64
- `dataUriAdapter(codec, mime)` - Wrap as data URI
- `imageDataUriCodec(mime)` - Binary → data URI (renders inline)

Chain them: `dataUriAdapter(base64Adapter(binaryCodec()), 'image/png')`

## Two Modes

**Convention** (auto-infer path from test file location):

```typescript
Deno.test('My test', async (t) => {
	const { assertMatchStep, flush } = createFixtureGroup(codec, { context: t });
	// Path auto-inferred: test/foo.test.ts → test/fixtures/foo.md

	await assertMatchStep(t, 'Name', value);

	await flush();
});
```

**Manual** (explicit path):

```typescript
Deno.test('Test', async (t) => {
	const { assertMatch, flush } = createFixtureGroup(jsonCodec<T>(), {
		context: t,
		filePath: new URL('./fixtures/shared.md', import.meta.url),
	});

	await assertMatch(value, { context: t });

	await flush();
});
```

## Examples

See actual snapshot files:

- [auto-infer.md](test/fixtures/auto-infer.md) - Convention mode
- [manual.md](test/fixtures/manual.md) - Manual mode
- [adapters.md](test/fixtures/adapters.md) - Base64 encoding
- [image.md](test/fixtures/image.md) - SVG rendering

## License

MIT
