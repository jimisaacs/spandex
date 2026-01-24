#!/usr/bin/env -S deno run --allow-read --allow-write
/**
 * Compare benchmark text output between two runs
 *
 * Usage:
 *   scripts/compare-benchmarks.ts <pr.txt> <main.txt> <output.md>
 *
 * Or run benchmarks automatically:
 *   scripts/compare-benchmarks.ts
 *   (runs benchmarks, compares to saved baseline, outputs to stdout)
 *
 * Exit codes:
 *   0 = No regressions
 *   1 = Regressions found (>20% slower)
 *   2 = Error (invalid input, parse failure, etc.)
 */

const REGRESSION_THRESHOLD = 1.2; // 20% slower = regression
const IMPROVEMENT_THRESHOLD = 0.8; // 20% faster = improvement

interface BenchmarkResult {
	impl: string;
	scenario: string;
	timeMs: number;
}

/**
 * Parse benchmark table output
 */
function parseBenchmarks(text: string): BenchmarkResult[] {
	// Remove ANSI color codes
	// deno-lint-ignore no-control-regex
	const clean = text.replace(/\x1b\[[0-9;]*m/g, '');

	const results: BenchmarkResult[] = [];
	const pattern = /^\|\s*([\w-]+)\s+-\s+(.+?)\s+\|\s*([\d.]+)\s*(µs|ns|ms)\s*\|/;

	for (const line of clean.split('\n')) {
		const match = line.match(pattern);
		if (!match) continue;

		const [, impl, scenario, time, unit] = match;

		// Skip correctness verification
		if (scenario === 'Correctness verification') continue;

		let timeMs = parseFloat(time!);
		if (unit === 'µs') timeMs /= 1000;
		else if (unit === 'ns') timeMs /= 1_000_000;

		results.push({ impl: impl!, scenario: scenario!, timeMs });
	}

	return results;
}

/**
 * Compare two benchmark result sets
 */
function compare(pr: BenchmarkResult[], main: BenchmarkResult[]): {
	output: string;
	hasRegressions: boolean;
} {
	const lines: string[] = [];
	let regressions = 0;
	let improvements = 0;

	lines.push('## Performance Comparison\n');
	lines.push('| Implementation | Scenario | Main (µs) | PR (µs) | Change | Status |');
	lines.push('|----------------|----------|-----------|---------|--------|--------|');

	// Group by scenario, then implementation
	const scenarios = new Set([...pr.map((b) => b.scenario), ...main.map((b) => b.scenario)]);

	for (const scenario of Array.from(scenarios).sort()) {
		const prResults = pr.filter((b) => b.scenario === scenario);
		const mainResults = main.filter((b) => b.scenario === scenario);

		const impls = new Set([...prResults.map((b) => b.impl), ...mainResults.map((b) => b.impl)]);

		for (const impl of Array.from(impls).sort()) {
			const prBench = prResults.find((b) => b.impl === impl);
			const mainBench = mainResults.find((b) => b.impl === impl);

			if (!prBench) {
				lines.push(`| ${impl} | ${scenario} | ${(mainBench!.timeMs * 1000).toFixed(2)} | - | REMOVED | ⚠️ |`);
				continue;
			}

			if (!mainBench) {
				lines.push(`| ${impl} | ${scenario} | - | ${(prBench.timeMs * 1000).toFixed(2)} | NEW | 🆕 |`);
				continue;
			}

			const ratio = prBench.timeMs / mainBench.timeMs;
			const pctChange = ((ratio - 1) * 100).toFixed(1);
			const change = `${Number(pctChange) > 0 ? '+' : ''}${pctChange}%`;

			let status = '✅';
			if (ratio >= REGRESSION_THRESHOLD) {
				status = '🔴';
				regressions++;
			} else if (ratio <= IMPROVEMENT_THRESHOLD) {
				status = '🎉';
				improvements++;
			}

			lines.push(
				`| ${impl} | ${scenario} | ${(mainBench.timeMs * 1000).toFixed(2)} | ${
					(prBench.timeMs * 1000).toFixed(2)
				} | ${change} | ${status} |`,
			);
		}
	}

	lines.push('\n---\n');

	if (regressions > 0) {
		lines.push(`⚠️ **Found ${regressions} regression(s) (>20% slower)**\n`);
	} else if (improvements > 0) {
		lines.push(`✨ Found ${improvements} improvement(s) (>20% faster)!\n`);
	} else {
		lines.push('✅ No significant changes detected.\n');
	}

	return { output: lines.join('\n'), hasRegressions: regressions > 0 };
}

async function main() {
	const [prPath, mainPath, outputPath] = Deno.args;

	try {
		// Read and parse benchmark outputs
		let pr: BenchmarkResult[];
		let main: BenchmarkResult[];

		if (prPath && mainPath) {
			// Files provided - parse them
			const prText = await Deno.readTextFile(prPath);
			const mainText = await Deno.readTextFile(mainPath);

			pr = parseBenchmarks(prText);
			main = parseBenchmarks(mainText);

			if (pr.length === 0) throw new Error(`No benchmarks found in ${prPath}`);
			if (main.length === 0) throw new Error(`No benchmarks found in ${mainPath}`);
		} else {
			// No files provided - just validate we can run benchmarks
			console.error('No input files - running local benchmark test...');

			const command = new Deno.Command('deno', {
				args: ['bench', '--allow-read', 'benchmarks/performance.ts'],
				stdout: 'piped',
				stderr: 'inherit',
			});

			const { stdout, code } = await command.output();
			if (code !== 0) {
				throw new Error('Benchmark execution failed');
			}

			const output = new TextDecoder().decode(stdout);
			const results = parseBenchmarks(output);

			if (results.length === 0) {
				throw new Error('No benchmark results found');
			}

			console.log(`\n✅ Successfully parsed ${results.length} benchmarks`);
			console.log(`   Implementations: ${new Set(results.map((r) => r.impl)).size}`);
			console.log(`   Scenarios: ${new Set(results.map((r) => r.scenario)).size}`);
			console.log('\nScript ready for use in CI!');
			Deno.exit(0);
		}

		// Compare results
		const { output, hasRegressions } = compare(pr, main);

		// Write output if path provided
		if (outputPath) {
			await Deno.writeTextFile(outputPath, output);
			console.error(`Comparison written to ${outputPath}`);
		} else {
			console.log(output);
		}

		// Exit with appropriate code
		Deno.exit(hasRegressions ? 1 : 0);
	} catch (error) {
		console.error('Error:', error);
		Deno.exit(2);
	}
}

main();
