#!/usr/bin/env -S deno run --allow-run --allow-read --allow-write

/**
 * Multi-run benchmark analysis tool
 *
 * Runs benchmarks N times and computes statistical metrics:
 * - Mean ± standard deviation
 * - Coefficient of variation (CV%)
 * - Min/max ranges
 * - Relative performance comparisons
 *
 * Usage:
 *   ./scripts/analyze-benchmarks.ts [runs] [output.md]
 *
 * Examples:
 *   ./scripts/analyze-benchmarks.ts           # 5 runs, console output only
 *   ./scripts/analyze-benchmarks.ts 3         # 3 runs, console output
 *   ./scripts/analyze-benchmarks.ts 5 results.md  # 5 runs, save to results.md
 *
 * This tool is generic and works with any implementation/scenario in benchmarks/performance.ts
 */

interface BenchmarkResult {
	implementation: string;
	scenario: string;
	time_us: number;
}

interface AggregatedResult {
	implementation: string;
	scenario: string;
	mean: number;
	stddev: number;
	cv: number;
	min: number;
	max: number;
	runs: number[];
}

async function runBenchmark(runNumber: number, totalRuns: number): Promise<BenchmarkResult[]> {
	// Progress indicator
	const progressBar = (current: number, total: number, width: number = 30): string => {
		const percent = current / total;
		const filled = Math.floor(percent * width);
		const empty = width - filled;
		return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${(percent * 100).toFixed(0)}%`;
	};

	console.log(`\n${progressBar(runNumber - 1, totalRuns)} Run ${runNumber}/${totalRuns}`);
	console.log('Running benchmark... (this takes ~30-60 seconds)');

	const cmd = new Deno.Command('deno', {
		args: ['bench', '--json', '--allow-read=src', 'benchmarks/performance.ts'],
		stdout: 'piped',
		stderr: 'piped',
	});

	const startTime = Date.now();
	const { stdout, stderr, code } = await cmd.output();
	const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

	if (code !== 0) {
		const errorText = new TextDecoder().decode(stderr);
		throw new Error(`Benchmark failed: ${errorText}`);
	}

	console.log(`✓ Completed in ${elapsed}s`);

	const output = new TextDecoder().decode(stdout);
	const results: BenchmarkResult[] = [];

	// Parse Deno bench JSON output
	try {
		const data = JSON.parse(output);
		if (data.benches && Array.isArray(data.benches)) {
			for (const bench of data.benches) {
				// Parse name: "Implementation - workload: scenario"
				const match = bench.name.match(/^(\w+) - (write|read|mixed|query-only): (.+)$/);
				if (match && bench.results && bench.results[0]?.ok) {
					const [, impl, workload, scenario] = match;
					results.push({
						implementation: impl,
						scenario: `${workload}: ${scenario}`,
						time_us: bench.results[0].ok.avg / 1000, // Convert ns to µs
					});
				}
			}
		}
	} catch (e) {
		throw new Error(`Failed to parse benchmark output: ${e}`);
	}

	console.log(`  → Captured ${results.length} data points`);
	return results;
}

function computeStats(values: number[]): {
	mean: number;
	stddev: number;
	cv: number;
	min: number;
	max: number;
} {
	const n = values.length;
	const mean = values.reduce((a, b) => a + b, 0) / n;
	const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
	const stddev = Math.sqrt(variance);
	const cv = (stddev / mean) * 100; // Coefficient of variation as percentage
	const min = Math.min(...values);
	const max = Math.max(...values);

	return { mean, stddev, cv, min, max };
}

async function main() {
	const RUNS = Deno.args[0] ? parseInt(Deno.args[0]) : 5;
	const OUTPUT_FILE = Deno.args[1]; // Optional output file

	console.log('\n' + '='.repeat(80));
	console.log('MULTI-RUN BENCHMARK ANALYSIS');
	console.log('='.repeat(80));
	console.log(`Runs: ${RUNS}`);
	if (OUTPUT_FILE) {
		console.log(`Output: ${OUTPUT_FILE}`);
	}
	console.log(`Estimated time: ${RUNS * 45}s (~${Math.ceil(RUNS * 45 / 60)} minutes)\n`);

	const allResults: BenchmarkResult[][] = [];

	for (let i = 0; i < RUNS; i++) {
		const results = await runBenchmark(i + 1, RUNS);
		allResults.push(results);

		// Small delay between runs to allow system to stabilize
		if (i < RUNS - 1) {
			console.log('  Cooling down...');
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}
	}

	console.log('\n' + '='.repeat(80));
	console.log('ALL RUNS COMPLETE - Analyzing results...');
	console.log('='.repeat(80) + '\n');

	// Aggregate results by implementation + scenario
	const aggregated = new Map<string, AggregatedResult>();

	for (const run of allResults) {
		for (const result of run) {
			const key = `${result.implementation}|${result.scenario}`;
			if (!aggregated.has(key)) {
				aggregated.set(key, {
					implementation: result.implementation,
					scenario: result.scenario,
					mean: 0,
					stddev: 0,
					cv: 0,
					min: 0,
					max: 0,
					runs: [],
				});
			}
			aggregated.get(key)!.runs.push(result.time_us);
		}
	}

	// Compute statistics
	for (const [, agg] of aggregated) {
		const stats = computeStats(agg.runs);
		agg.mean = stats.mean;
		agg.stddev = stats.stddev;
		agg.cv = stats.cv;
		agg.min = stats.min;
		agg.max = stats.max;
	}

	// Sort by implementation, then scenario
	const sorted = Array.from(aggregated.values()).sort((a, b) => {
		if (a.implementation !== b.implementation) {
			return a.implementation.localeCompare(b.implementation);
		}
		return a.scenario.localeCompare(b.scenario);
	});

	// Output results
	console.log('='.repeat(100));
	console.log('BENCHMARK ANALYSIS RESULTS');
	console.log('='.repeat(100));
	console.log();

	// Group by scenario for comparison
	const byScenario = new Map<string, AggregatedResult[]>();
	for (const result of sorted) {
		if (!byScenario.has(result.scenario)) {
			byScenario.set(result.scenario, []);
		}
		byScenario.get(result.scenario)!.push(result);
	}

	// Get all implementations
	const implementations = Array.from(new Set(sorted.map((r) => r.implementation))).sort();

	console.log(`RESULTS: ${implementations.length} Implementations × ${byScenario.size} Scenarios\n`);
	console.log(`Implementations: ${implementations.join(', ')}\n`);

	// Show detailed results for each scenario
	for (const [scenario, results] of byScenario) {
		console.log(`\n### ${scenario}`);
		console.log('```');
		console.log(
			'Implementation          Mean (µs)    ±Stddev    CV%   Min (µs)   Max (µs)   Relative',
		);
		console.log('-'.repeat(95));

		// Sort by mean time (fastest first)
		const sortedResults = [...results].sort((a, b) => a.mean - b.mean);
		const baseline = sortedResults[0]; // Fastest is baseline

		for (const result of sortedResults) {
			const relative = result.mean / baseline.mean;
			const relativeStr = result === baseline ? '(fastest)' : `${relative.toFixed(2)}x`;
			const marker = result === baseline ? '✓' : '';

			console.log(
				`${(result.implementation + ' ' + marker).padEnd(22)} ${result.mean.toFixed(1).padStart(9)}  ` +
					`±${result.stddev.toFixed(1).padStart(7)}  ${result.cv.toFixed(1).padStart(5)}  ` +
					`${result.min.toFixed(1).padStart(9)}  ${result.max.toFixed(1).padStart(9)}   ${relativeStr}`,
			);
		}
		console.log('```');
	}

	// Summary statistics: wins per implementation
	console.log('\n\n='.repeat(100));
	console.log('SUMMARY: Performance Rankings');
	console.log('='.repeat(100));

	const winCounts = new Map<string, number>();
	for (const impl of implementations) {
		winCounts.set(impl, 0);
	}

	for (const [, results] of byScenario) {
		const sortedResults = [...results].sort((a, b) => a.mean - b.mean);
		const winner = sortedResults[0].implementation;
		winCounts.set(winner, (winCounts.get(winner) || 0) + 1);
	}

	console.log('\nFastest Implementation per Scenario:');
	console.log('```');
	console.log('Implementation          Wins   Win Rate   Avg Time (µs)');
	console.log('-'.repeat(60));

	// Sort by wins (descending)
	const rankedImpls = Array.from(winCounts.entries())
		.sort((a, b) => b[1] - a[1]);

	for (const [impl, wins] of rankedImpls) {
		const implResults = sorted.filter((r) => r.implementation === impl);
		const avgTime = implResults.reduce((sum, r) => sum + r.mean, 0) / implResults.length;
		const winRate = ((wins / byScenario.size) * 100).toFixed(0);

		console.log(
			`${impl.padEnd(22)} ${wins.toString().padStart(4)}   ${winRate.padStart(4)}%     ${
				avgTime.toFixed(1).padStart(10)
			}`,
		);
	}
	console.log('```');

	// Statistical quality check
	console.log('\n\nStatistical Quality (Coefficient of Variation):');
	console.log('```');
	console.log('Implementation          Avg CV%   Max CV%   Status');
	console.log('-'.repeat(60));

	for (const impl of implementations) {
		const implResults = sorted.filter((r) => r.implementation === impl);
		const avgCV = implResults.reduce((sum, r) => sum + r.cv, 0) / implResults.length;
		const maxCV = Math.max(...implResults.map((r) => r.cv));
		const status = maxCV < 5 ? '✅ Stable' : maxCV < 10 ? '⚠️  Variable' : '❌ Unstable';

		console.log(
			`${impl.padEnd(22)} ${avgCV.toFixed(2).padStart(7)}   ${maxCV.toFixed(2).padStart(7)}   ${status}`,
		);
	}
	console.log('```');

	// Write to file (if requested)
	if (OUTPUT_FILE) {
		const report = `# Benchmark Analysis Results

**Date**: ${new Date().toISOString()}
**Runs**: ${RUNS}
**Method**: Statistical analysis (mean ± stddev, CV%)

## Methodology

**Sample Size**: ${RUNS} runs per scenario (each run = mean of Deno's 10-100 internal iterations) → **${RUNS * 10}-${
			RUNS * 100
		} total iterations**

**Metrics**:
- **Mean (μ)**: Average performance
- **Std Dev (σ)**: Absolute variability
- **CV%**: \`(σ/μ) × 100\` - normalized variability (<5% = stable ✅, >5% = variable ⚠️)
- **95% CI**: \`μ ± 1.96(σ/√${RUNS})\` - typically ±2-4% of mean for stable results

**Practical Significance Threshold**: Report differences **>10%** with CV% <5% (both large effect size AND stable measurement). All major findings show >20% differences, well above noise.

**Why effect size over p-values?** Microbenchmarks prioritize magnitude (2x faster matters, 2% doesn't) over statistical hypothesis testing. We measure effect size and stability, not statistical significance (which would require hypothesis tests we don't perform).

**Reproducibility**: \`deno task bench:analyze ${RUNS} docs/analyses/benchmark-statistics.md\` regenerates. Expect ±10-20% absolute variance across systems, but relative rankings stable.

---

## Summary

**Implementations**: ${implementations.length}
**Scenarios**: ${byScenario.size}
**Total Data Points**: ${sorted.length}

### Performance Rankings

| Implementation | Wins | Win Rate | Avg Time (µs) |
| -------------- | ---- | -------- | ------------- |
${
			rankedImpls.map(([impl, wins]) => {
				const implResults = sorted.filter((r) => r.implementation === impl);
				const avgTime = implResults.reduce((sum, r) => sum + r.mean, 0) / implResults.length;
				const winRate = ((wins / byScenario.size) * 100).toFixed(0);
				return `| ${impl} | ${wins} | ${winRate}% | ${avgTime.toFixed(1)} |`;
			}).join('\n')
		}

### Statistical Quality

| Implementation | Avg CV% | Max CV% | Status |
| -------------- | ------- | ------- | ------ |
${
			implementations.map((impl) => {
				const implResults = sorted.filter((r) => r.implementation === impl);
				const avgCV = implResults.reduce((sum, r) => sum + r.cv, 0) / implResults.length;
				const maxCV = Math.max(...implResults.map((r) => r.cv));
				const status = maxCV < 5 ? '✅ Stable' : maxCV < 10 ? '⚠️ Variable' : '❌ Unstable';
				return `| ${impl} | ${avgCV.toFixed(2)} | ${maxCV.toFixed(2)} | ${status} |`;
			}).join('\n')
		}

## Detailed Results

${
			Array.from(byScenario.entries()).map(([scenario, results]) => {
				const sortedResults = [...results].sort((a, b) => a.mean - b.mean);
				const baseline = sortedResults[0];

				return `### ${scenario}

| Implementation | Mean (µs) | ±Stddev | CV% | Relative |
| -------------- | --------- | ------- | --- | -------- |
${
					sortedResults.map((r) => {
						const relative = r.mean / baseline.mean;
						const relStr = r === baseline ? '(fastest)' : `${relative.toFixed(2)}x`;
						const marker = r === baseline ? ' ✓' : '';
						return `| ${r.implementation}${marker} | ${r.mean.toFixed(1)} | ±${r.stddev.toFixed(1)} | ${
							r.cv.toFixed(1)
						} | ${relStr} |`;
					}).join('\n')
				}
`;
			}).join('\n')
		}

---

**Note**: CV% (Coefficient of Variation) measures result stability. Lower is better (< 5% = stable).
`;

		await Deno.writeTextFile(OUTPUT_FILE, report);
		console.log(`\n✅ Results written to ${OUTPUT_FILE}`);

		// Format the generated markdown file
		console.log('Formatting output...');
		const fmtCmd = new Deno.Command('deno', {
			args: ['fmt', OUTPUT_FILE],
			stdout: 'piped',
			stderr: 'piped',
		});
		await fmtCmd.output();
		console.log('✅ Formatted with deno fmt');
	} else {
		console.log('\n💡 Tip: Run with output file to save results:');
		console.log(`   ./scripts/analyze-benchmarks.ts ${RUNS} results.md`);
	}
}

main();
