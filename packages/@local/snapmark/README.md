# @local/snapmark

**Dev-only**: General-purpose snapshot testing with markdown fixture storage.

Not published to JSR. Used internally by [@jim/spandex](https://jsr.io/@jim/spandex) tests.

```typescript
import { createFixtureGroup, jsonCodec } from '@local/snapmark';

Deno.test('My test', async (t) => {
	const { assertMatchStep, flush } = createFixtureGroup(jsonCodec<T>(), { context: t });

	await assertMatchStep(t, 'Snapshot name', myData);

	await flush(); // Write on UPDATE_FIXTURES=1
});
```

**Built-in codecs**: JSON, string, binary, image (data URIs)\
**Built-in adapters**: Base64, data URI (chainable)

## Usage

**Auto-inferred path** (default):

```typescript
const { assertMatchStep, flush } = createFixtureGroup(codec, { context: t });
// Path: test/foo.test.ts → test/fixtures/foo.md
```

**Explicit path**:

```typescript
const { assertMatch, flush } = createFixtureGroup(codec, {
	context: t,
	filePath: new URL('./fixtures/shared.md', import.meta.url),
});
```

**Update fixtures**: `UPDATE_FIXTURES=1 deno test`

## Related

- [@jim/spandex-ascii](https://jsr.io/@jim/spandex-ascii) - Uses this for ASCII snapshot tests
- `@local/spandex-testing` - Uses this for conformance tests
- [Examples](./test/fixtures/) - Real fixture files

## License

MIT
