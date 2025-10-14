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
	cache.set(absFilePath, file);
}
