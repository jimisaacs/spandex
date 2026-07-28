import * as path from '@std/path';
import * as md from './markdown.ts';

/** Cache of loaded fixture files */
const cache = new Map<string, md.FixtureFile>();

/** Returns empty structure for new files (allows seamless fixture creation in update mode) */
export async function readFixtureFile(
	absFilePath: string,
	sectionLabel?: string,
): Promise<md.FixtureFile | undefined> {
	// The parse depends on the section label, so it is part of the cache identity.
	const key = `${sectionLabel ?? md.DEFAULT_SECTION_LABEL}\u0000${absFilePath}`;
	if (cache.has(key)) {
		return cache.get(key)!;
	}
	try {
		const content = await Deno.readTextFile(absFilePath);
		const parsed = md.parseFixtureFile(content, sectionLabel);
		cache.set(key, parsed);
		return parsed;
	} catch (error) {
		if (error instanceof Deno.errors.NotFound) {
			return;
		}
		throw error;
	}
}

export async function writeFixtureFile(
	absFilePath: string,
	file: md.FixtureFile,
	defaultLanguageTag?: string,
	options?: Deno.WriteFileOptions,
	sectionLabel?: string,
): Promise<void> {
	const content = md.writeFixtureFile(file, defaultLanguageTag, sectionLabel);
	await Deno.mkdir(path.dirname(absFilePath), { recursive: true });
	await Deno.writeTextFile(absFilePath, content, options);
	// The cache owns its entry, so it takes a snapshot rather than the caller's
	// live map. A fixture group clears its own map after flushing, and two
	// groups can share one file — the morton and rstartree geometry suites both
	// write test/index/fixtures/geometry-test.md — so caching the caller's map
	// would leave the second group reading an emptied file it had just written.
	cache.set(`${sectionLabel ?? md.DEFAULT_SECTION_LABEL}\u0000${absFilePath}`, {
		header: file.header,
		fixtures: new Map(file.fixtures),
	});
}
