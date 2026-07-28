import * as path from '@std/path';
import * as md from './markdown.ts';

/** Cache of loaded fixture files */
const cache = new Map<string, md.FixtureFile>();

/** Returns empty structure for new files (allows seamless fixture creation in update mode) */
export async function readFixtureFile(absFilePath: string): Promise<md.FixtureFile | undefined> {
	if (cache.has(absFilePath)) {
		return cache.get(absFilePath)!;
	}
	try {
		const content = await Deno.readTextFile(absFilePath);
		const parsed = md.parseFixtureFile(content);
		cache.set(absFilePath, parsed);
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
): Promise<void> {
	const content = md.writeFixtureFile(file, defaultLanguageTag);
	await Deno.mkdir(path.dirname(absFilePath), { recursive: true });
	await Deno.writeTextFile(absFilePath, content, options);
	// The cache owns its entry, so it takes a snapshot rather than the caller's
	// live map. A fixture group clears its own map after flushing, and two
	// groups can share one file — the morton and rstartree geometry suites both
	// write test/index/fixtures/geometry-test.md — so caching the caller's map
	// would leave the second group reading an emptied file it had just written.
	cache.set(absFilePath, { header: file.header, fixtures: new Map(file.fixtures) });
}
