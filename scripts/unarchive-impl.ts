#!/usr/bin/env -S deno run --allow-read --allow-write

/**
 * Restore an archived implementation to active status
 *
 * Usage: deno task unarchive:impl <name> <category>
 *
 * Categories:
 *   - superseded: Working but obsolete
 *   - failed-experiments: Failed hypothesis
 *
 * Example: deno task unarchive:impl CompactRTree superseded
 */

const [implName, category] = Deno.args;

if (!implName || !category) {
	console.error('Usage: deno task unarchive:impl <name> <category>');
	console.error('Categories: superseded, failed-experiments');
	Deno.exit(1);
}

if (!['superseded', 'failed-experiments'].includes(category)) {
	console.error(`Invalid category: ${category}`);
	console.error('Valid categories: superseded, failed-experiments');
	Deno.exit(1);
}

// Convert implementation name to filename
const filename = implName.toLowerCase().replace(/impl$/, '') + '.ts';
const testFilename = filename.replace('.ts', '.test.ts');

const archiveSrcPath = `archive/src/implementations/${category}/${filename}`;
const archiveTestPath = `archive/test/${category}/${testFilename}`;
const srcPath = `src/implementations/${filename}`;
const testPath = `test/${testFilename}`;

console.log(`\n📂 Unarchiving ${implName}...\n`);

// Check if archived source exists
try {
	await Deno.stat(archiveSrcPath);
} catch {
	console.error(`❌ Archived source not found: ${archiveSrcPath}`);
	Deno.exit(1);
}

// Move source file back
console.log(`📦 Moving ${archiveSrcPath} → ${srcPath}`);
await Deno.rename(archiveSrcPath, srcPath);

// Move test file back if exists
try {
	await Deno.stat(archiveTestPath);
	console.log(`📦 Moving ${archiveTestPath} → ${testPath}`);
	await Deno.rename(archiveTestPath, testPath);
} catch {
	console.log(`⚠️  No archived test file found (skipping)`);
}

// Remove archive header
console.log(`\n📝 Removing archive documentation...`);
const content = await Deno.readTextFile(srcPath);
const archiveHeaderPattern = /\/\*\*\s*\n\s*\* ARCHIVED:.*?\*\/\s*\n\s*\n/s;
const newContent = content.replace(archiveHeaderPattern, '');
await Deno.writeTextFile(srcPath, newContent);
console.log(`✅ Removed archive header from ${srcPath}`);

console.log(`\n✅ Unarchive complete!\n`);
console.log(`Next steps:`);
console.log(`1. Benchmarks will auto-discover it from src/implementations/`);
console.log(`2. Run: deno task test && deno task bench:update`);
console.log(`4. Commit: git commit -m "unarchive: Restore ${implName} from ${category}"`);
