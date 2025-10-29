# @local/snapmark

Snapshot testing with markdown fixture storage.

```typescript
import { createFixtureGroup, jsonCodec } from '@local/snapmark';

Deno.test('My test', async (t) => {
	const { assertMatchStep, flush } = createFixtureGroup(jsonCodec<T>(), { context: t });

	await assertMatchStep(t, 'Snapshot name', myData);

	await flush();
});
```

**Codecs**: `jsonCodec`, `stringCodec`, `asciiStringCodec`, `binaryCodec`, `imageDataUriCodec`\
**Adapters**: `base64Adapter`, `dataUriAdapter` (chainable)

**Path convention**: `test/foo.test.ts` → `test/fixtures/foo.md`

**Update mode**: `UPDATE_FIXTURES=1 deno test`

**License**: MIT
