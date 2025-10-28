/**
 * Fixture group orchestration for snapshot testing
 *
 * **Modes**: Test (compare) | Update (UPDATE_FIXTURES=1 to capture)
 * **Convention**: `test/foo.test.ts` → `test/fixtures/foo.md`
 *
 * @example
 * ```ts
 * const { assertMatch, flush } = createFixtureGroup(stringCodec(), {
 *   context: t,
 *   filePath: new URL('./fixtures/test.md', import.meta.url),
 * });
 *
 * await t.step('fixture-name', async (context) => {
 *   await assertMatch(value, { context });  // Uses step name
 * });
 *
 * await flush();
 * ```
 *
 * @module
 */

import { assertEquals } from '@std/assert';
import * as path from '@std/path';
import type { FixtureCodec } from './codec.ts';
import { defaultCompare } from './codec.ts';
import { readFixtureFile, writeFixtureFile } from './disk.ts';
import type { FixtureFile } from './markdown.ts';

const DEFAULT_HEADER = '# Test Fixtures\n\nAutomatically generated fixture file.';

//#region Configuration Types

interface FixtureGroupCommonOptions {
	/** Fallback language tag when codec.languageTag is undefined */
	languageTag?: string;
	/** Override automatic UPDATE_FIXTURES env detection */
	updateMode?: boolean;
	/** Fixture file header to use if file isn't saved to disk yet */
	header?: string;
}

interface FixtureGroupManualOptions {
	/** Explicit path to fixture file */
	filePath: string | URL;
}

interface FixtureGroupConventionalOptions {
	/** Test context (infers fixture path from test file location) */
	context: Deno.TestContext;
}

/** Options for createFixtureGroup - requires filePath OR context */
export type FixtureGroupOptions =
	& FixtureGroupCommonOptions
	& (
		| (FixtureGroupManualOptions & Partial<FixtureGroupConventionalOptions>)
		| (Partial<FixtureGroupManualOptions> & FixtureGroupConventionalOptions)
	);

/**
 * Options for assertMatch
 *
 * **Name resolution**: `name` (explicit) → `context.name` (step name) → error
 */
export interface AssertMatchOptions {
	/** Explicit fixture name (overrides context.name) */
	name?: string;
	/** Test context (infers name from context.name) */
	context?: Deno.TestContext;
}

//#endregion

//#region Path Inference

/**
 * Infer fixture path from test file location
 *
 * Convention: `test/foo.test.ts` → `test/fixtures/foo.md`
 *
 * @example
 * ```ts
 * // Given: file:///project/test/foo.test.ts
 * inferFixturePath(context) // → file:///project/test/fixtures/foo.md
 * ```
 */
function inferFixturePath(context: Deno.TestContext): URL {
	const testUrl = new URL(context.origin);
	const pathParts = testUrl.pathname.split('/');
	const filename = pathParts.pop()!;

	const fixtureFilename = filename.replace(/\.test\.ts$/, '.md');
	pathParts.push('fixtures', fixtureFilename);

	return new URL('file://' + pathParts.join('/'));
}

//#endregion Configuration Types

//#region Helper Functions

function isUpdateMode(): boolean {
	return Deno.env.get('UPDATE_FIXTURES') === '1' || Deno.args.includes('--update-fixtures');
}

function resolvedPath(p: string | URL): string {
	return path.resolve(p instanceof URL ? p.pathname : p);
}

function resolveFixtureName(options: AssertMatchOptions): string {
	const name = options.name ?? options.context?.name;
	if (!name) {
		throw new Error(
			'Fixture name required: provide either options.name or options.context',
		);
	}
	return name;
}
//#endregion Helper Functions

//#region FixtureGroupImpl Class

/**
 * Manages fixtures in a single markdown file
 *
 * @internal Use `createFixtureGroup()` or `withFixtures()` instead
 */
class FixtureGroupImpl<T> {
	private readonly absFilePath: string;
	private readonly codec: FixtureCodec<T>;
	private readonly defaultLanguageTag: string | undefined;

	/** partial file to update only if we are in update mode */
	private readonly encountered?: { header: string | undefined } & Omit<FixtureFile, 'header'>;

	constructor(codec: FixtureCodec<T>, options: Readonly<FixtureGroupOptions>) {
		const { languageTag, updateMode = isUpdateMode(), context, header } = options;
		this.absFilePath = resolvedPath(options.filePath ?? inferFixturePath(context!));
		this.codec = codec;
		this.defaultLanguageTag = codec.languageTag ?? languageTag;

		/// If we're in update mode, we'll create a new file
		if (updateMode) {
			this.encountered = {
				header: header ?? (options.context?.name && `# ${options.context.name}`),
				fixtures: new Map(),
			};
		}
	}

	async assertMatch(value: T, options: AssertMatchOptions): Promise<void> {
		const name = resolveFixtureName(options);
		const content = this.codec.encode(value);
		const file = await readFixtureFile(this.absFilePath);

		if (this.encountered) {
			const existing = file?.fixtures.get(name);
			this.encountered.fixtures.set(name, {
				name,
				purpose: existing?.purpose,
				content,
				index: existing?.index ?? file?.fixtures.size ?? 0,
				languageTag: this.codec.languageTag,
			});
			return;
		}

		const fixture = file?.fixtures.get(name);
		if (!fixture) {
			throw new Error(
				`Fixture "${name}" not found in ${path.relative(Deno.cwd(), this.absFilePath)}\n` +
					`Run with UPDATE_FIXTURES=1 to create it.`,
			);
		}

		const compare = this.codec.compare ?? defaultCompare;
		if (!compare(content, fixture.content)) {
			assertEquals(
				content,
				fixture.content,
				`Fixture "${name}" does not match.\nRun with UPDATE_FIXTURES=1 to update it.`,
			);
		}
	}

	/** Validates codec round-trip fidelity (encode→decode→encode produces same output) */
	async assertRoundTrip(value: T, options: AssertMatchOptions): Promise<void> {
		const name = resolveFixtureName(options);

		if (!this.codec.decode) {
			throw new Error('Codec does not provide decode() - cannot test round-trip');
		}

		const encoded1 = this.codec.encode(value);
		const decoded = this.codec.decode(encoded1);
		const encoded2 = this.codec.encode(decoded);

		const compare = this.codec.compare ?? defaultCompare;
		if (!compare(encoded1, encoded2)) {
			assertEquals(
				encoded2,
				encoded1,
				`Round-trip failed for "${name}": encode → decode → encode produced different output`,
			);
		}

		await this.assertMatch(value, options);
	}

	async flush(options?: Deno.WriteFileOptions): Promise<void> {
		const encountered = this.encountered;
		if (!encountered) return;

		const existing = await readFixtureFile(this.absFilePath);
		const newFile = {
			header: encountered.header ?? existing?.header ?? DEFAULT_HEADER,
			fixtures: encountered.fixtures,
		};
		const fixtureCount = newFile.fixtures.size;
		await writeFixtureFile(this.absFilePath, newFile, this.defaultLanguageTag, options);
		encountered.fixtures.clear();

		console.log(`✓ Updated fixtures: ${path.relative(Deno.cwd(), this.absFilePath)}`);
		console.log(`  Captured: ${fixtureCount} fixtures`);
	}
}

//#endregion FixtureGroupImpl Class

//#region Public API

/**
 * Create fixture group for snapshot testing
 *
 * **Path**: Explicit via `filePath` | Inferred from `context` (test/foo.test.ts → test/fixtures/foo.md)
 */
export function createFixtureGroup<T>(
	codec: FixtureCodec<T>,
	options: Readonly<FixtureGroupOptions>,
) {
	const group = new FixtureGroupImpl(codec, options);
	return {
		assertMatch: (value: T, options: AssertMatchOptions) => group.assertMatch(value, options),
		assertRoundTrip: (value: T, options: AssertMatchOptions) => group.assertRoundTrip(value, options),
		assertMatchStep: (t: Deno.TestContext, name: string, value: T) =>
			t.step(name, (context) => group.assertMatch(value, { context })),
		flush: (options?: Deno.WriteFileOptions) => group.flush(options),
	} as const;
}

/** Fixtures object returned by createFixtureGroup */
export type FixtureGroup<T> = ReturnType<typeof createFixtureGroup<T>>;
