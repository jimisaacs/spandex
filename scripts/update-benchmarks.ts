#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run

/**
 * Updates BENCHMARKS.md with current benchmark results
 * Run: deno task bench:update
 *
 * Fully dynamic - automatically discovers implementations from benchmark output
 *
 * ⚠️ IMPORTANT: This generates BENCHMARKS.md (quick, ~2 min).
 * Run frequently during iteration. Before completing tasks, also run:
 *   deno task bench:analyze 5 docs/analyses/benchmark-statistics.md
 * to ensure both benchmark docs are current.
 */

const BENCHMARKS_FILE = './BENCHMARKS.md';

console.log('Running benchmarks...\n');

const command = new Deno.Command('deno', {
	args: ['bench', '-A', 'benchmarks/performance.ts'],
	stdout: 'piped',
	stderr: 'piped',
});

const { stdout, stderr, code } = await command.output();
let output = new TextDecoder().decode(stdout);
const errors = new TextDecoder().decode(stderr);

if (code !== 0 && !output.includes('| benchmark |')) {
	console.error('Benchmark failed:', errors);
	console.error('stdout:', output);
	Deno.exit(1);
}

// deno-lint-ignore no-control-regex
output = output.replace(/\x1b\[[0-9;]*m/g, '');

const lines = output.split('\n');
const results: Record<string, Record<string, number>> = {};
const implementationNames = new Set<string>();
const scenarioNames = new Set<string>();

for (const line of lines) {
	const pattern = /^\|\s*([\w-]+)\s+-\s+(.+?)\s+\|\s*([\d.]+)\s*(µs|ns|ms)\s*\|/;
	const match = line.match(pattern);
	if (match) {
		const [, impl, scenario, time, unit] = match;

		if (scenario === 'Correctness verification') continue;

		implementationNames.add(impl);
		scenarioNames.add(scenario);

		if (!results[scenario]) {
			results[scenario] = {};
		}

		let timeInMs = parseFloat(time);
		if (unit === 'µs') timeInMs /= 1000;
		else if (unit === 'ns') timeInMs /= 1_000_000;
		results[scenario][impl] = timeInMs;
	}
}

// Sort implementations with RStarTree first (baseline), then alphabetically
const implementations = Array.from(implementationNames).sort((a, b) => {
	if (a === 'RStarTree') return -1;
	if (b === 'RStarTree') return 1;
	return a.localeCompare(b);
});

console.log(`Found implementations: ${implementations.join(', ')}`);
console.log(`Found ${scenarioNames.size} scenarios\n`);

// Categorize scenarios
const writeScenarios = Array.from(scenarioNames).filter((s) => s.startsWith('write:'));
const readScenarios = Array.from(scenarioNames).filter((s) => s.startsWith('read:'));
const mixedScenarios = Array.from(scenarioNames).filter((s) => s.startsWith('mixed:'));
const queryOnlyScenarios = Array.from(scenarioNames).filter((s) => s.startsWith('query-only:'));

// Generate markdown
const formatResults = (scenario: Record<string, number>) => {
	const baseline = scenario.RStarTree || 1; // RStarTree is now the baseline
	const entries = Object.entries(scenario).sort(([, a], [, b]) => a - b);

	return entries.map(([impl, time]) => {
		const relative = (time / baseline).toFixed(2);
		return `| ${impl} | ${time.toFixed(2)}ms | ${relative}x |`;
	}).join('\n');
};

const getBundleSize = async (filePath: string): Promise<number> => {
	const bundleCmd = new Deno.Command('deno', {
		args: ['bundle', '--platform=deno', '--minify', filePath],
		stdout: 'piped',
		stderr: 'piped',
	});
	const { stdout } = await bundleCmd.output();
	return stdout.length;
};

const generateSummary = async (
	results: Record<string, Record<string, number>>,
	implementations: string[],
) => {
	// Bundle and measure minified file sizes dynamically
	const bundleSizes: Record<string, number> = {};
	for (const impl of implementations) {
		// Convert implementation name to lowercase filename
		// "RStarTree" -> "rstartree.ts", "LinearScan" -> "linearscan.ts", etc.
		const filename = impl.toLowerCase().replace(/linearscan/g, 'linearscan') + '.ts';
		const filePath = `packages/@jim/spandex/src/implementations/${filename}`;
		try {
			bundleSizes[impl] = await getBundleSize(filePath);
		} catch {
			console.warn(`Warning: Could not bundle ${filePath}`);
			bundleSizes[impl] = 0;
		}
	}

	// Calculate fastest and slowest counts for each implementation
	const fastest: Record<string, number> = {};
	const slowest: Record<string, number> = {};
	for (const impl of implementations) {
		fastest[impl] = 0;
		slowest[impl] = 0;
	}

	const allScenarios = Object.values(results).filter((s) => Object.keys(s).length > 0);

	for (const scenario of allScenarios) {
		const entries = Object.entries(scenario);
		if (entries.length === 0) continue;
		const fastestEntry = entries.reduce((min, curr) => curr[1] < min[1] ? curr : min);
		const slowestEntry = entries.reduce((max, curr) => curr[1] > max[1] ? curr : max);
		fastest[fastestEntry[0]]++;
		slowest[slowestEntry[0]]++;
	}

	const totalScenarios = allScenarios.length;

	// Calculate average speedup vs Reference for each implementation
	const avgSpeedups: Record<string, number> = {};
	for (const impl of implementations) {
		if (impl === 'Reference') {
			avgSpeedups[impl] = 1;
			continue;
		}

		const speedups: number[] = [];
		for (const scenario of allScenarios) {
			const ref = scenario.Reference;
			const implTime = scenario[impl];
			if (ref && implTime) {
				speedups.push(ref / implTime);
			}
		}

		avgSpeedups[impl] = speedups.length > 0 ? speedups.reduce((a, b) => a + b, 0) / speedups.length : 1;
	}

	const formatBytes = (bytes: number) => bytes < 1024 ? `${bytes}B` : `${(bytes / 1024).toFixed(1)}KB`;

	// Generate summary for each implementation dynamically
	const summaries: string[] = [];

	summaries.push(`**What do these numbers actually mean?**

These benchmarks compare **O(n) linear scan** vs **O(log n) R-tree** for different data sizes and workload patterns.

**Sparse data (n < 100)**: Typical for individual spreadsheet properties (backgrounds, borders, etc.)
**Large data (n > 1000)**: Consolidated or heavy usage scenarios

**RStarTree is the baseline (1.0x)** - numbers > 1.0x are slower, < 1.0x are faster.
`);

	for (const impl of implementations) {
		const avg = avgSpeedups[impl] || 1;
		const pct = Number(((avg - 1) * 100).toFixed(0));
		const size = bundleSizes[impl] || 0;
		const fastCount = fastest[impl] || 0;
		const slowCount = slowest[impl] || 0;

		const speedupText = pct > 0 ? `${pct}% slower` : pct < 0 ? `${-pct}% faster` : 'same';

		summaries.push(`**${impl}** (${formatBytes(size)} minified):

- Fastest in ${fastCount}/${totalScenarios} scenarios, slowest in ${slowCount}/${totalScenarios} scenarios
- Average ${avg.toFixed(2)}x vs RStarTree (${speedupText})${
			impl === 'RStarTree' ? '\n- Baseline for comparison' : ''
		}`);
	}

	return summaries.join('\n\n');
};

const now = new Date().toISOString().split('T')[0];
const denoVersion = Deno.version.deno;

// Generate sections dynamically
const generateSection = (title: string, scenarios: string[]) => {
	if (scenarios.length === 0) return '';

	return `## ${title}\n\n` + scenarios.map((scenario) => {
		const cleanName = scenario.replace(/^(write|read|mixed|query-only):\s*/, '');
		return `### ${cleanName}\n\n| Implementation | Time | Relative |\n| -------------- | ---- | -------- |\n${
			formatResults(results[scenario])
		}`;
	}).join('\n\n');
};

// Generate performance comparison table
const generateComparisonTable = (results: Record<string, Record<string, number>>, implementations: string[]) => {
	// Find representative scenarios for each category
	const sparseScenario = Object.keys(results).find((s) => s.includes('sparse-grid'));
	const largeOverlapScenario = Object.keys(results).find((s) => s.includes('large-overlapping'));
	const largeSeqScenario = Object.keys(results).find((s) => s.includes('large-sequential'));

	if (!sparseScenario || !largeOverlapScenario || !largeSeqScenario) {
		return ''; // Not enough data
	}

	const scenarios = [
		{ label: 'Sparse (n < 100)', key: sparseScenario },
		{ label: 'Large overlapping (n ≈ 1000)', key: largeOverlapScenario },
		{ label: 'Large sequential (n ≈ 2500)', key: largeSeqScenario },
	];

	// Get all implementations except RStarTree (baseline)
	const impls = implementations.filter((impl) => impl !== 'RStarTree');

	// Generate table rows dynamically
	const rows: string[] = [];
	for (const { label, key } of scenarios) {
		const rstartreeTime = results[key]?.RStarTree || 1;
		const ratios = impls.map((impl) => {
			const time = results[key]?.[impl];
			return time ? (time / rstartreeTime).toFixed(1) + 'x' : 'N/A';
		});
		ratios.push('1.0x (baseline)'); // Add RStarTree as baseline
		rows.push(`| ${label} | ${ratios.join(' | ')} |`);
	}

	if (rows.length === 0) return '';

	// Generate header dynamically
	const headers = [...impls, 'RStarTree'];
	const headerRow = `| Scenario | ${headers.join(' | ')} |`;
	const separatorRow = `| ${'-------- | '.repeat(headers.length + 1).slice(0, -2)}|`;

	return `
## Quick Comparison

**Speed relative to RStarTree** (lower is better):

${headerRow}
${separatorRow}
${rows.join('\n')}

**Key insights**:
- **Sparse data (n < 100)**: All implementations competitive, linear scan overhead minimal
- **Medium data (n ≈ 1000)**: R-tree starts to win, but linear scan still reasonable
- **Large data (n ≈ 2500)**: R-tree dramatically faster (20-28x), hierarchical indexing pays off
`;
};

// Build sections array with separators only between non-empty sections
const sections: string[] = [
	`<!-- GENERATED FILE - DO NOT EDIT MANUALLY -->
<!-- This file is automatically generated by scripts/update-benchmarks.ts -->
<!-- Run 'deno task bench:update' to regenerate -->

# Benchmark Results

> Last updated: ${now} | Deno ${denoVersion}
>
> **⚠️ Note**: These benchmarks run in GitHub Actions CI (shared runners). Results show relative performance
> but may have high variability (CV% >20%). For research-grade measurements, run on dedicated hardware.

## Performance Comparison

Comparing **O(n) linear scan** vs **O(log n) R-tree** across:

- **Data sizes**: Sparse (n < 100) vs Large (n > 1000)
- **Overlap patterns**: Sequential, Grid, Overlapping, Large ranges
- **Workloads**: Write-heavy (pure inserts), Read-heavy (many queries), Mixed (80/20)

**Key Question**: When does O(log n) beat O(n)?

**How to read**: Lower time is better. "Relative" compares to RStarTree baseline:
- **1.0x** = same speed as RStarTree
- **>1.0x** = slower than RStarTree (e.g., 2.0x = twice as slow)
- **<1.0x** = faster than RStarTree (e.g., 0.5x = twice as fast)

${generateComparisonTable(results, implementations)}`,
];

// Add sections with separators only if non-empty
const addSection = (content: string) => {
	if (content) {
		sections.push(content);
	}
};

addSection(generateSection('Write-Heavy Workloads (Pure Inserts)', writeScenarios.sort()));
addSection(generateSection('Read-Heavy Workloads (Frequent Queries)', readScenarios.sort()));
addSection(generateSection('Mixed Workloads (80% Write / 20% Read)', mixedScenarios.sort()));
addSection(generateSection('Query-Only Benchmarks (Construction Not Measured)', queryOnlyScenarios.sort()));

sections.push(`## Summary

${await generateSummary(results, implementations)}

**System**: ${Deno.build.os} ${Deno.build.arch}
**Run**: \`deno task bench:update\` to regenerate
`);

// Join sections with separator only between non-empty sections
const markdown = sections.join('\n\n---\n\n');

await Deno.writeTextFile(BENCHMARKS_FILE, markdown);

// Format the generated file
const fmtCmd = new Deno.Command('deno', {
	args: ['fmt', BENCHMARKS_FILE],
	stdout: 'piped',
	stderr: 'piped',
});
await fmtCmd.output();

console.log(`\n✅ Updated ${BENCHMARKS_FILE}`);
