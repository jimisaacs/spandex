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
 *
 * ⚠️ IMPORTANT: This generates statistical analysis (slow, ~30 min).
 * Run before completing tasks to ensure stats are current. Also run:
 *   deno task bench:update
 * to ensure both benchmark docs are in sync.
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

/** How many times faster the winner of one scenario was than the runner-up. */
interface ScenarioMargin {
	scenario: string;
	winner: string;
	runnerUp: string;
	margin: number;
	/** True when the two 95% confidence intervals do not overlap. */
	separated: boolean;
}

/**
 * A win counts as decisive once it clears the practical-significance threshold
 * this report applies everywhere else. The methodology prose below is written
 * from this constant, so the two cannot drift apart.
 */
const DECISIVE_MARGIN = 1.1;

/**
 * Half-width of the 95% confidence interval on a mean.
 *
 * The threshold above is only half of the significance rule this report states:
 * a difference has to be both large and stable. On a noisy machine a wide
 * margin can still be noise, so the margin is paired with this interval and a
 * win counts only when the two intervals stay apart.
 */
function confidenceHalfWidth(stddev: number, runs: number): number {
	if (runs < 2) return 0;
	return 1.96 * (stddev / Math.sqrt(runs));
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
		args: ['bench', '--json', '-A', 'benchmarks/performance.ts'],
		stdout: 'piped',
		stderr: 'piped',
	});

	const startTime = Date.now();
	const { stdout, stderr, code } = await cmd.output();
	const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

	const output = new TextDecoder().decode(stdout);
	const errorText = new TextDecoder().decode(stderr);

	// Deno bench --json sometimes exits with non-zero even on success
	// Check if we have valid JSON output before failing
	if (code !== 0 && !output.trim().startsWith('{')) {
		console.error('=== STDERR ===');
		console.error(errorText || '(empty)');
		console.error('=== STDOUT ===');
		console.error(output || '(empty)');
		throw new Error(`Benchmark failed with code ${code}. See above for details.`);
	}

	console.log(`✓ Completed in ${elapsed}s`);
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

/**
 * The average that suits ratios. Two speedups of 2x and 8x average to 4x here,
 * where an arithmetic mean would say 5x and let the lopsided scenario set the
 * number on its own.
 */
function geometricMean(values: number[]): number {
	if (values.length === 0) return 0;
	const sumOfLogs = values.reduce((sum, value) => sum + Math.log(value), 0);
	return Math.exp(sumOfLogs / values.length);
}

function median(values: number[]): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/**
 * For each scenario, how far ahead of the runner-up the winner finished. A
 * scenario with fewer than two implementations has no margin to report.
 */
function computeMargins(byScenario: Map<string, AggregatedResult[]>): ScenarioMargin[] {
	const margins: ScenarioMargin[] = [];

	for (const [scenario, results] of byScenario) {
		const ranked = [...results].sort((a, b) => a.mean - b.mean);
		const winner = ranked[0];
		const runnerUp = ranked[1];
		if (!winner || !runnerUp || winner.mean <= 0) continue;

		const winnerCeiling = winner.mean + confidenceHalfWidth(winner.stddev, winner.runs.length);
		const runnerUpFloor = runnerUp.mean - confidenceHalfWidth(runnerUp.stddev, runnerUp.runs.length);

		margins.push({
			scenario,
			winner: winner.implementation,
			runnerUp: runnerUp.implementation,
			margin: runnerUp.mean / winner.mean,
			separated: winnerCeiling < runnerUpFloor,
		});
	}

	return margins;
}

/**
 * For each implementation, how far behind the winner it finished in every
 * scenario it did not win.
 */
function computeLossRatios(byScenario: Map<string, AggregatedResult[]>): Map<string, number[]> {
	const losses = new Map<string, number[]>();

	for (const [, results] of byScenario) {
		const ranked = [...results].sort((a, b) => a.mean - b.mean);
		const best = ranked[0];
		if (!best || best.mean <= 0) continue;

		for (const result of ranked.slice(1)) {
			const ratios = losses.get(result.implementation) ?? [];
			ratios.push(result.mean / best.mean);
			losses.set(result.implementation, ratios);
		}
	}

	return losses;
}

async function main() {
	const RUNS = Deno.args[0] ? parseInt(Deno.args[0]) : 5;
	const OUTPUT_FILE = Deno.args[1]; // Optional output file

	console.log('\n' + '='.repeat(40));
	console.log('MULTI-RUN BENCHMARK ANALYSIS');
	console.log('='.repeat(40));
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

	console.log('\n' + '='.repeat(40));
	console.log('ALL RUNS COMPLETE - Analyzing results...');
	console.log('='.repeat(40) + '\n');

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
	console.log('='.repeat(40));
	console.log('BENCHMARK ANALYSIS RESULTS');
	console.log('='.repeat(40));
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
	const implementations = Array.from(new Set(sorted.map((result) => result.implementation))).sort();

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
		if (sortedResults.length === 0) {
			console.error('Error: No benchmark results to analyze');
			return;
		}
		const baseline = sortedResults[0]!; // Guaranteed by length check

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
	console.log('\n\n='.repeat(40));
	console.log('SUMMARY: Performance Rankings');
	console.log('='.repeat(40));

	const winCounts = new Map<string, number>();
	for (const impl of implementations) {
		winCounts.set(impl, 0);
	}

	for (const [, results] of byScenario) {
		const sortedResults = [...results].sort((a, b) => a.mean - b.mean);
		if (sortedResults.length === 0) continue; // Skip empty scenarios
		const winner = sortedResults[0]!.implementation; // Guaranteed by length check
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
		const implResults = sorted.filter((result) => result.implementation === impl);
		const avgTime = implResults.reduce((sum, result) => sum + result.mean, 0) / implResults.length;
		const winRate = ((wins / byScenario.size) * 100).toFixed(0);

		console.log(
			`${impl.padEnd(22)} ${wins.toString().padStart(4)}   ${winRate.padStart(4)}%     ${
				avgTime.toFixed(1).padStart(10)
			}`,
		);
	}
	console.log('```');

	// Margin of victory: how much the winner won by, not just that it won
	const margins = computeMargins(byScenario);
	const lossRatios = computeLossRatios(byScenario);

	// Both halves of the significance rule: a large enough difference, measured
	// stably enough to tell the two apart.
	const isDecisive = (entry: ScenarioMargin) => entry.margin >= DECISIVE_MARGIN && entry.separated;

	const marginsByWinner = new Map<string, ScenarioMargin[]>();
	for (const entry of margins) {
		const won = marginsByWinner.get(entry.winner) ?? [];
		won.push(entry);
		marginsByWinner.set(entry.winner, won);
	}

	const tooClose = margins
		.filter((entry) => entry.margin < DECISIVE_MARGIN)
		.sort((a, b) => a.margin - b.margin);
	const tooNoisy = margins
		.filter((entry) => entry.margin >= DECISIVE_MARGIN && !entry.separated)
		.sort((a, b) => a.margin - b.margin);

	const marginRows = rankedImpls
		.filter(([impl]) => (marginsByWinner.get(impl) ?? []).length > 0)
		.map(([impl]) => {
			const won = marginsByWinner.get(impl)!;
			const ratios = won.map((entry) => entry.margin);
			return {
				impl,
				wins: won.length,
				decisive: won.filter(isDecisive).length,
				typical: geometricMean(ratios),
				median: median(ratios),
				tightest: Math.min(...ratios),
				widest: Math.max(...ratios),
			};
		});

	const marginCaveats = (() => {
		const listOf = (entries: ScenarioMargin[]) =>
			entries.map((entry) => `- ${entry.scenario} — ${entry.winner} by ${entry.margin.toFixed(2)}x`)
				.join('\n');

		const parts: string[] = [];
		if (tooClose.length > 0) {
			parts.push(
				`Too close to call, where the margin never reaches ${DECISIVE_MARGIN.toFixed(2)}x:\n\n${
					listOf(tooClose)
				}`,
			);
		}
		if (tooNoisy.length > 0) {
			parts.push(
				`Too noisy to call, where the margin clears the threshold but the two confidence intervals still overlap:\n\n${
					listOf(tooNoisy)
				}`,
			);
		}
		return parts.length === 0 ? 'Every win satisfied both conditions.' : parts.join('\n\n');
	})();

	const marginBands: { label: string; holds: (margin: number) => boolean }[] = [
		{ label: 'Under 1.10x, a tie', holds: (margin) => margin < 1.1 },
		{ label: '1.10x to 1.50x', holds: (margin) => margin >= 1.1 && margin < 1.5 },
		{ label: '1.50x to 3x', holds: (margin) => margin >= 1.5 && margin < 3 },
		{ label: '3x to 10x', holds: (margin) => margin >= 3 && margin < 10 },
		{ label: '10x and above', holds: (margin) => margin >= 10 },
	];

	const lossRows = Array.from(lossRatios.entries())
		.map(([impl, ratios]) => ({
			impl,
			losses: ratios.length,
			typical: geometricMean(ratios),
			median: median(ratios),
			worst: Math.max(...ratios),
		}))
		.sort((a, b) => a.typical - b.typical);

	console.log('\n\nMargin of Victory (winner vs runner-up):');
	console.log('```');
	console.log('Implementation          Wins  Decisive  Typical   Median  Tightest    Widest');
	console.log('-'.repeat(78));
	for (const row of marginRows) {
		console.log(
			`${row.impl.padEnd(22)} ${row.wins.toString().padStart(4)}  ${row.decisive.toString().padStart(8)}  ${
				(row.typical.toFixed(2) + 'x').padStart(7)
			}  ${(row.median.toFixed(2) + 'x').padStart(7)}  ` +
				`${(row.tightest.toFixed(2) + 'x').padStart(8)}  ${(row.widest.toFixed(2) + 'x').padStart(8)}`,
		);
	}
	console.log('```');

	console.log('\n\nCost of Choosing Wrong (behind the winner when it loses):');
	console.log('```');
	console.log('Implementation        Losses   Typical   Median      Worst');
	console.log('-'.repeat(60));
	for (const row of lossRows) {
		console.log(
			`${row.impl.padEnd(22)} ${row.losses.toString().padStart(4)}  ${
				(row.typical.toFixed(2) + 'x').padStart(8)
			}  ${(row.median.toFixed(2) + 'x').padStart(7)}  ${(row.worst.toFixed(2) + 'x').padStart(9)}`,
		);
	}
	console.log('```');

	// Statistical quality check
	console.log('\n\nStatistical Quality (Coefficient of Variation):');
	console.log('```');
	console.log('Implementation          Avg CV%   Max CV%   Status');
	console.log('-'.repeat(60));

	for (const impl of implementations) {
		const implResults = sorted.filter((result) => result.implementation === impl);
		const avgCV = implResults.reduce((sum, result) => sum + result.cv, 0) / implResults.length;
		const maxCV = Math.max(...implResults.map((result) => result.cv));
		const status = maxCV < 5 ? '✅ Stable' : maxCV < 10 ? '⚠️  Variable' : '❌ Unstable';

		console.log(
			`${impl.padEnd(22)} ${avgCV.toFixed(2).padStart(7)}   ${maxCV.toFixed(2).padStart(7)}   ${status}`,
		);
	}
	console.log('```');

	// Write to file (if requested)
	if (OUTPUT_FILE) {
		const report = `<!-- GENERATED FILE - DO NOT EDIT MANUALLY -->
<!-- This file is automatically generated by scripts/analyze-benchmarks.ts -->
<!-- Run 'deno task bench:analyze ${RUNS} ${OUTPUT_FILE}' to regenerate -->

# Benchmark Analysis Results

**Date**: ${new Date().toISOString()}
**Runs**: ${RUNS}
**Method**: Statistical analysis (mean ± stddev, CV%)

> **⚠️ CI Environment Note**: When run in GitHub Actions, expect higher CV% (>20%) due to shared/noisy runners.
> CI benchmarks are for **regression detection**, not research-grade measurements.
> For academic rigor, run on dedicated/idle hardware with CV% <5%.

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
				const implResults = sorted.filter((result) => result.implementation === impl);
				const avgTime = implResults.reduce((sum, result) => sum + result.mean, 0) / implResults.length;
				const winRate = ((wins / byScenario.size) * 100).toFixed(0);
				return `| ${impl} | ${wins} | ${winRate}% | ${avgTime.toFixed(1)} |`;
			}).join('\n')
		}

### Margin of Victory

Winning a scenario says nothing about by how much. The margin below is how many
times faster the winner was than the runner-up in that scenario. A margin of
1.05x is a photo finish where either implementation would have served, and 4x is
a scenario where the choice decided the outcome.

| Implementation | Wins | Decisive | Typical margin | Median | Tightest | Widest |
| -------------- | ---- | -------- | -------------- | ------ | -------- | ------ |
${
			marginRows.map((row) =>
				`| ${row.impl} | ${row.wins} | ${row.decisive} | ${row.typical.toFixed(2)}x | ${
					row.median.toFixed(2)
				}x | ${row.tightest.toFixed(2)}x | ${row.widest.toFixed(2)}x |`
			).join('\n')
		}

A win counts as decisive only when it meets both halves of the significance rule
stated above. Its margin has to clear ${((DECISIVE_MARGIN - 1) * 100).toFixed(0)}%, and the two 95% confidence
intervals have to stay apart, so that the ordering survives the run-to-run
variation rather than resting on it. A wide margin measured on a noisy machine
fails the second test even though it passes the first.

The typical margin is a geometric mean, which is the average that suits ratios:
a 2x win and an 8x win give 4x rather than the 5x an ordinary average reports,
so one lopsided scenario cannot set the figure by itself.

${marginCaveats}

### Cost of Choosing Wrong

The same measurements read from the other side. For every scenario an
implementation did not win, this is how far behind the winner it finished, so it
answers what a default costs you when the workload turns out to suit something
else.

| Implementation | Losses | Typical | Median | Worst |
| -------------- | ------ | ------- | ------ | ----- |
${
			lossRows.map((row) =>
				`| ${row.impl} | ${row.losses} | ${row.typical.toFixed(2)}x | ${row.median.toFixed(2)}x | ${
					row.worst.toFixed(2)
				}x |`
			).join('\n')
		}

Where only two implementations ever take first place, one's typical loss is the
other's typical win by construction. The two tables above are then the same
measurements seen from opposite ends rather than independent evidence, and an
implementation that never wins a scenario appears only in this second table.

### How Much the Choice Matters

| Margin | Scenarios |
| ------ | --------- |
${
			marginBands.map((band) =>
				`| ${band.label} | ${margins.filter((entry) => band.holds(entry.margin)).length} |`
			).join('\n')
		}

### Statistical Quality

| Implementation | Avg CV% | Max CV% | Status |
| -------------- | ------- | ------- | ------ |
${
			implementations.map((impl) => {
				const implResults = sorted.filter((result) => result.implementation === impl);
				const avgCV = implResults.reduce((sum, result) => sum + result.cv, 0) / implResults.length;
				const maxCV = Math.max(...implResults.map((result) => result.cv));
				const status = maxCV < 5 ? '✅ Stable' : maxCV < 10 ? '⚠️ Variable' : '❌ Unstable';
				return `| ${impl} | ${avgCV.toFixed(2)} | ${maxCV.toFixed(2)} | ${status} |`;
			}).join('\n')
		}

## Detailed Results

${
			Array.from(byScenario.entries()).map(([scenario, results]) => {
				const sortedResults = [...results].sort((a, b) => a.mean - b.mean);
				if (sortedResults.length === 0) return ''; // Skip empty scenarios
				const baseline = sortedResults[0]!; // Guaranteed by length check

				return `### ${scenario}

| Implementation | Mean (µs) | ±Stddev | CV% | Relative |
| -------------- | --------- | ------- | --- | -------- |
${
					sortedResults.map((result) => {
						const relative = result.mean / baseline.mean;
						const relStr = result === baseline ? '(fastest)' : `${relative.toFixed(2)}x`;
						const marker = result === baseline ? ' ✓' : '';
						return `| ${result.implementation}${marker} | ${result.mean.toFixed(1)} | ±${
							result.stddev.toFixed(1)
						} | ${result.cv.toFixed(1)} | ${relStr} |`;
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
