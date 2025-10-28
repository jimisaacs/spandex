#!/usr/bin/env -S deno run --allow-read --allow-write

/**
 * Archive an implementation
 *
 * Usage: deno task archive:impl <name> <category>
 *
 * Categories:
 *   - superseded: Working but obsolete (replaced by better version)
 *   - failed-experiments: Failed hypothesis or validation
 *
 * Example: deno task archive:impl CompactRTree superseded
 */

const [implName, category] = Deno.args;

if (!implName || !category) {
	console.error('Usage: deno task archive:impl <name> <category>');
	console.error('Categories: superseded, failed-experiments');
	Deno.exit(1);
}

if (!['superseded', 'failed-experiments'].includes(category)) {
	console.error(`Invalid category: ${category}`);
	console.error('Valid categories: superseded, failed-experiments');
	Deno.exit(1);
}

// Convert implementation name to filename
// "CompactRTree" -> "compactrtree.ts"
const filename = implName.toLowerCase().replace(/impl$/, '') + '.ts';
const testFilename = filename.replace('.ts', '.test.ts');

const srcPath = `packages/@jim/spandex/src/index/${filename}`;
const testPath = `test/${testFilename}`;
const archiveSrcPath = `archive/src/implementations/${category}/${filename}`;
const archiveTestPath = `archive/test/${category}/${testFilename}`;

console.log(`\n🗂️  Archiving ${implName}...\n`);

// Check if source exists
try {
	await Deno.stat(srcPath);
} catch {
	console.error(`❌ Source file not found: ${srcPath}`);
	Deno.exit(1);
}

// Create archive directories if needed
await Deno.mkdir(`archive/src/implementations/${category}`, { recursive: true });
await Deno.mkdir(`archive/test/${category}`, { recursive: true });

// Move source file
console.log(`📦 Moving ${srcPath} → ${archiveSrcPath}`);
await Deno.rename(srcPath, archiveSrcPath);

// Move test file if exists
try {
	await Deno.stat(testPath);
	console.log(`📦 Moving ${testPath} → ${archiveTestPath}`);
	await Deno.rename(testPath, archiveTestPath);
} catch {
	console.log(`⚠️  No test file found at ${testPath} (skipping)`);
}

// Benchmarks will automatically exclude archived implementations (auto-discovery)
console.log(`\n✅ Benchmarks will auto-discover implementations (no manual update needed)`);

// Add archive documentation header
console.log(`\n📝 Adding archive documentation...`);
const archivedContent = await Deno.readTextFile(archiveSrcPath);
const archiveHeader = `/**
 * ARCHIVED: ${new Date().toISOString().split('T')[0]}
 * Category: ${category}
 * Reason: [TODO: Document why this was archived]
 *
 * This implementation has been moved to the archive.
 * It remains runnable for historical comparison but is not
 * included in the main benchmark suite.
 */

`;

// Insert after the reference comment if it exists, otherwise at the top
const hasReference = archivedContent.startsWith('/// <reference');
let newArchivedContent: string;
if (hasReference) {
	const lines = archivedContent.split('\n');
	const referenceLines = lines.filter((l) => l.startsWith('///')).join('\n');
	const restLines = lines.filter((l) => !l.startsWith('///')).join('\n');
	newArchivedContent = referenceLines + '\n\n' + archiveHeader + restLines;
} else {
	newArchivedContent = archiveHeader + archivedContent;
}

await Deno.writeTextFile(archiveSrcPath, newArchivedContent);
console.log(`✅ Added archive header to ${archiveSrcPath}`);

// Fix import paths in archived implementation
console.log(`\n🔧 Fixing import paths in archived implementation...`);
let fixedContent = await Deno.readTextFile(archiveSrcPath);

// Fix relative imports to workspace imports
// From: '../types.ts' or '../r.ts' → '@jim/spandex'
fixedContent = fixedContent.replace(
	/from ['"]\.\.\/[^'"]+['"]/g,
	"from '@jim/spandex'",
);

await Deno.writeTextFile(archiveSrcPath, fixedContent);
console.log(`✅ Fixed import paths in ${archiveSrcPath}`);

// Fix import paths in archived test if it exists
try {
	await Deno.stat(archiveTestPath);
	console.log(`\n🔧 Fixing import paths in archived test...`);
	let testContent = await Deno.readTextFile(archiveTestPath);

	// Fix conformance imports: '../src/conformance/...' → '@local/spandex-testing'
	testContent = testContent.replace(
		/from ['"]\.\.\/src\/conformance\/[^'"]+['"]/g,
		"from '@local/spandex-testing'",
	);

	// Fix direct imports: '../src/implementations/...' → '@jim/spandex'
	testContent = testContent.replace(
		/from ['"]\.\.\/src\/implementations\/[^'"]+['"]/g,
		"from '@jim/spandex'",
	);

	// Add import for archived implementation
	const implImport = `import ${implName} from '@jim/spandex';\n`;

	// Remove the archived impl from the main mod.ts import if present
	testContent = testContent.replace(
		new RegExp(`(import \\{[^}]*),?\\s*${implName}\\s*,?([^}]*\\} from ['"]../../src/mod\\.ts['"];)`, 'g'),
		'$1$2',
	);
	testContent = testContent.replace(
		new RegExp(`(import \\{)\\s*${implName}\\s*,?\\s*(\\} from ['"]../../src/mod\\.ts['"];)`, 'g'),
		'$1$2',
	);

	// Add the archived implementation import after other imports
	const importSectionEnd = testContent.indexOf('\n\n');
	if (importSectionEnd > 0 && !testContent.includes(`from '@jim/spandex'`)) {
		testContent = testContent.slice(0, importSectionEnd) + '\n' + implImport + testContent.slice(importSectionEnd);
	}

	await Deno.writeTextFile(archiveTestPath, testContent);
	console.log(`✅ Fixed import paths in ${archiveTestPath}`);
} catch {
	// Test file doesn't exist, skip
}

// Verify archived files type-check
console.log(`\n🔍 Verifying archived files type-check...`);
const checkCmd = new Deno.Command('deno', {
	args: ['check', archiveSrcPath],
	stdout: 'piped',
	stderr: 'piped',
});

const { code, stderr } = await checkCmd.output();
if (code !== 0) {
	const errors = new TextDecoder().decode(stderr);
	console.error(`⚠️  Type check failed for archived files:\n${errors}`);
	console.error(`\nYou may need to manually fix import paths in:`);
	console.error(`  - ${archiveSrcPath}`);
	if (await Deno.stat(archiveTestPath).catch(() => null)) {
		console.error(`  - ${archiveTestPath}`);
	}
} else {
	console.log(`✅ Archived files type-check successfully`);
}

console.log(`\n✅ Archive complete!\n`);
console.log(`Next steps:`);
console.log(`1. Edit ${archiveSrcPath} and update the "Reason:" field in archive header`);
console.log(`2. Run: deno check (verify entire project including archive)`);
console.log(`3. Run: deno task bench:update`);
console.log(`4. Update archive/docs/README.md if needed`);
console.log(`5. Commit: git commit -m "archive: Move ${implName} to ${category} - [reason]"`);
