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

**Update mode**: `UPDATE_FIXTURES=1 deno test -A` (reading the env var needs permission)

## Fixtures That Are Also Documentation

A fixture file is markdown, so it can be published as a page. Two options make
one read like a document rather than a test log:

```typescript
createFixtureGroup(codec, {
	context: t,
	header: '# ASCII Rendering Examples\n\nEvery example below is rendered from a real index.',
	sectionLabel: 'Example', // headings become "## Example: Name" instead of "## Test: Name"
});
```

`header` replaces the generated title, and `sectionLabel` renames every section
heading. The label is part of the file format, so changing it on an existing
fixture means regenerating that file; a stale heading fails the next run rather
than being skipped.

**License**: MIT
