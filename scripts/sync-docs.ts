#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run

/**
 * AI Assistant Documentation Sync Utility
 *
 * This script should be run by Claude Code whenever implementations, tests, or benchmarks change.
 * It automatically regenerates derived documentation to prevent drift.
 *
 * Usage:
 *   deno task sync-docs
 *
 * What it does:
 * 1. Detects what changed (implementations, tests, benchmarks)
 * 2. Regenerates appropriate documentation
 * 3. Reports what was updated
 */

async function exec(cmd: string[]): Promise<{ success: boolean; output: string }> {
	if (cmd.length === 0) {
		throw new Error('Command array cannot be empty');
	}
	try {
		const process = new Deno.Command(cmd[0]!, {
			args: cmd.slice(1),
			stdout: 'piped',
			stderr: 'piped',
		});
		const { code, stdout, stderr } = await process.output();
		const output = new TextDecoder().decode(stdout) + new TextDecoder().decode(stderr);
		return { success: code === 0, output };
	} catch (e) {
		return { success: false, output: String(e) };
	}
}

async function getChangedFiles(): Promise<string[]> {
	// Check both staged and unstaged changes
	const staged = await exec(['git', 'diff', '--cached', '--name-only']);
	const unstaged = await exec(['git', 'diff', '--name-only']);

	const stagedFiles = staged.success ? staged.output.trim().split('\n').filter(Boolean) : [];
	const unstagedFiles = unstaged.success ? unstaged.output.trim().split('\n').filter(Boolean) : [];

	return [...new Set([...stagedFiles, ...unstagedFiles])];
}

async function main() {
	console.log('🔄 Syncing documentation...\n');

	const changed = await getChangedFiles();

	// Check if implementations changed (including archived)
	const implsChanged = changed.some((f) =>
		(f.startsWith('packages/@jim/spandex/src/index/') || f.startsWith('archive/src/implementations/')) &&
		f.endsWith('.ts')
	);

	// Check if tests changed
	const testsChanged = changed.some((f) =>
		(f.startsWith('test/') || f.startsWith('packages/@local/spandex-testing/src/axioms/')) && f.endsWith('.ts')
	);

	const updates: string[] = [];

	if (implsChanged) {
		console.log('📊 Implementations changed - regenerating BENCHMARKS.md...');

		const benchResult = await exec(['deno', 'task', 'bench:update']);
		if (!benchResult.success) {
			console.error('❌ Failed to regenerate BENCHMARKS.md');
			console.error(benchResult.output);
			Deno.exit(1);
		}

		updates.push('BENCHMARKS.md');
		console.log('✅ BENCHMARKS.md updated');
	}

	if (testsChanged) {
		console.log('🧪 Tests changed - checking test documentation...');

		const testsuiteContent = await Deno.readTextFile(
			'packages/@local/spandex-testing/src/axiom/properties.ts',
		);
		const axiomCount = (testsuiteContent.match(/export async function test/g) || []).length;

		console.log(`   Found ${axiomCount} test axioms in conformance suite`);
		updates.push(`Test suite (${axiomCount} axioms)`);
	}

	// Summary
	if (updates.length > 0) {
		console.log('\n📝 Updated documentation:');
		updates.forEach((u) => console.log(`   - ${u}`));
	} else {
		console.log('✅ No documentation updates needed');
	}

	console.log('\n💡 Tip: Run `deno task test && deno task check` to verify everything works');
}

main();
