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
const slug = implName.toLowerCase().replace(/impl$/, '');
const filename = `${slug}.ts`;

const archiveSrcPath = `archive/src/implementations/${category}/${filename}`;
const archiveTestPath = `archive/test/${category}/${slug}`;
const srcPath = `packages/@jim/spandex/src/index/${filename}`;
// Conformance tests live in one directory per implementation.
const testPath = `packages/@jim/spandex/test/index/${slug}`;

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

// Move the test directory back if it exists
try {
	await Deno.stat(archiveTestPath);
	console.log(`📦 Moving ${archiveTestPath}/ → ${testPath}/`);
	await Deno.rename(archiveTestPath, testPath);
} catch {
	console.log(`⚠️  No archived test directory found (skipping)`);
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
console.log(`1. Benchmarks will auto-discover it from packages/@jim/spandex/src/index/`);
console.log(`2. Fix imports: convert workspace imports back to relative imports if needed`);
console.log(`3. Run: deno task test && deno task bench:update`);
console.log(`4. Commit: git commit -m "unarchive: Restore ${implName} from ${category}"`);
