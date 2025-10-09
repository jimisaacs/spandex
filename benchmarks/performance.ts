import type { Rectangle } from '../src/types.ts';
import { seededRandom } from '../src/conformance/utils.ts';

// Parse command-line arguments
const args = Deno.args;
const includeArchived = args.includes('--include-archived') || args.includes('--archived');
const excludeActive = args.filter((arg) => arg.startsWith('--exclude=')).map((arg) => arg.replace('--exclude=', ''));
const archivedFilter = args.find((arg) => arg.startsWith('--include-archived='))?.replace('--include-archived=', '');

/**
 * Auto-discover implementations from file system
 * Convention: All *.ts files in the directory are implementation classes
 */
async function discoverImplementations(baseDir: string, label?: string) {
	const implementations = [];

	try {
		// Check if directory exists and is accessible
		const entries = [];
		for await (const entry of Deno.readDir(baseDir)) {
			entries.push(entry);
		}

		// If base directory has subdirectories (like archive), recurse into them
		const hasSubdirs = entries.some((e) => e.isDirectory);

		if (hasSubdirs) {
			// Archive structure: archive/src/implementations/category/*.ts
			for (const category of entries) {
				if (!category.isDirectory) continue;
				if (archivedFilter && category.name !== archivedFilter) continue;

				for await (const file of Deno.readDir(`${baseDir}/${category.name}`)) {
					if (!file.name.endsWith('.ts')) continue;

					const implName = file.name.replace('.ts', '');
					if (archivedFilter && archivedFilter !== category.name && archivedFilter !== implName) continue;

					try {
						const path = `../${baseDir}/${category.name}/${file.name}`;
						const module = await import(path);

						if (module.default && typeof module.default === 'function') {
							const displayName = `${implName} [${category.name}]`;
							implementations.push({ name: displayName, Class: module.default, active: false });
						}
					} catch (error) {
						const message = error instanceof Error ? error.message : String(error);
						console.warn(`⚠️  Failed to load ${file.name}: ${message}`);
					}
				}
			}
		} else {
			// Flat structure: src/implementations/*.ts
			for (const file of entries) {
				if (!file.name.endsWith('.ts')) continue;

				try {
					const path = `../${baseDir}/${file.name}`;
					const module = await import(path);

					if (module.default && typeof module.default === 'function') {
						const implName = file.name.replace('.ts', '');
						const displayName = label ? `${implName} [${label}]` : implName;
						implementations.push({ name: displayName, Class: module.default, active: !label });
					}
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					console.warn(`⚠️  Failed to load ${file.name}: ${message}`);
				}
			}
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.warn(`⚠️  Could not read ${baseDir}: ${message}`);
	}

	return implementations;
}

// Discover implementations from file system (both use same mechanism)
const activeImplementations = await discoverImplementations('src/implementations');
const archivedImplementations = includeArchived ? await discoverImplementations('archive/src/implementations') : [];

// Filter and combine
const implementations = [
	...activeImplementations.filter((impl) => !excludeActive.includes(impl.name)),
	...archivedImplementations,
];

// Sparse scenarios (n < 100) - realistic per-property usage
const sparseScenarios = {
	'sparse-sequential (n=50)': Array.from({ length: 50 }, (_, i) => ({
		range: [0, i * 10, 0, i * 10] as Rectangle,
		value: `seq_${i}`,
	})),

	'sparse-grid (n=60)': Array.from({ length: 60 }, (_, i) => ({
		range: [(i % 6) * 10, Math.floor(i / 6) * 10, (i % 6) * 10 + 1, Math.floor(i / 6) * 10 + 1] as Rectangle,
		value: `grid_${i}`,
	})),

	'sparse-overlapping (n=40)': Array.from({ length: 40 }, (_, i) => ({
		range: [(i % 4) * 5, Math.floor(i / 4) * 5, (i % 4) * 5 + 7, Math.floor(i / 4) * 5 + 7] as Rectangle,
		value: `overlap_${i}`,
	})),

	'sparse-large-ranges (n=30)': Array.from({ length: 30 }, (_, i) => ({
		range: [i * 50, i * 50, i * 50 + 29, i * 50 + 29] as Rectangle,
		value: `large_${i}`,
	})),

	// NEW: Real-world spreadsheet patterns
	'single-cell-edits (n=50)': Array.from({ length: 50 }, (_, i) => ({
		range: [i % 10, Math.floor(i / 10), i % 10, Math.floor(i / 10)] as Rectangle,
		value: `cell_${i}`,
	})),

	'column-operations (n=20)': Array.from({ length: 20 }, (_, i) => ({
		range: [i, 0, i, 999] as Rectangle, // Full column height
		value: `col_${i}`,
	})),

	'row-operations (n=20)': Array.from({ length: 20 }, (_, i) => ({
		range: [0, i, 25, i] as Rectangle, // Full row width (A-Z)
		value: `row_${i}`,
	})),

	'diagonal-selection (n=30)': Array.from({ length: 30 }, (_, i) => ({
		range: [i, i, i + 4, i + 4] as Rectangle,
		value: `diag_${i}`,
	})),

	'striping-alternating-rows (n=25)': Array.from({ length: 25 }, (_, i) => ({
		range: [0, i * 2, 9, i * 2] as Rectangle, // Every other row
		value: `stripe_${i}`,
	})),

	'merge-like-blocks (n=15)': Array.from({ length: 15 }, (_, i) => ({
		range: [(i % 3) * 15, Math.floor(i / 3) * 20, (i % 3) * 15 + 11, Math.floor(i / 3) * 20 + 14] as Rectangle,
		value: `block_${i}`,
	})),
};

// Large scenarios (n > 1000) - stress testing
const largeScenarios = {
	'large-sequential (n=2500)': Array.from({ length: 2500 }, (_, i) => ({
		range: [0, i, 0, i] as Rectangle,
		value: `seq_${i}`,
	})),

	'large-grid (n=2500)': Array.from({ length: 2500 }, (_, i) => ({
		range: [(i % 10) * 2, Math.floor(i / 10) * 2, (i % 10) * 2, Math.floor(i / 10) * 2] as Rectangle,
		value: `grid_${i}`,
	})),

	'large-overlapping (n=1250)': Array.from({ length: 1250 }, (_, i) => ({
		range: [i % 10, Math.floor(i / 5), (i % 10) + 4, Math.floor(i / 5) + 4] as Rectangle,
		value: `overlap_${i}`,
	})),

	'large-ranges (n=500)': Array.from({ length: 500 }, (_, i) => ({
		range: [i * 50, i * 50, i * 50 + 99, i * 50 + 99] as Rectangle,
		value: `large_${i}`,
	})),
};

const allScenarios = { ...sparseScenarios, ...largeScenarios };

// ============================================================================
// WRITE-HEAVY BENCHMARKS (Pure Inserts)
// ============================================================================

for (const [scenarioName, operations] of Object.entries(allScenarios)) {
	for (const { name, Class } of implementations) {
		Deno.bench(`${name} - write: ${scenarioName}`, () => {
			const index = new Class();
			operations.forEach((op) => index.insert(op.range, op.value));
		});
	}
}

// ============================================================================
// READ-HEAVY BENCHMARKS (Many queries after setup)
// ============================================================================

for (const { name, Class } of implementations) {
	// Sparse scenarios with frequent queries
	for (const [scenarioName, operations] of Object.entries(sparseScenarios)) {
		Deno.bench(`${name} - read: ${scenarioName} + 100 queries`, () => {
			const index = new Class();
			operations.forEach((op) => index.insert(op.range, op.value));

			// 100 viewport queries
			for (let i = 0; i < 100; i++) {
				const row = i * 5;
				const col = (i % 10) * 5;
				index.query([col, row, col + 19, row + 19] as Rectangle);
			}
		});
	}

	// Large scenarios with frequent queries
	for (const [scenarioName, operations] of Object.entries(largeScenarios)) {
		Deno.bench(`${name} - read: ${scenarioName} + 100 queries`, () => {
			const index = new Class();
			operations.forEach((op) => index.insert(op.range, op.value));

			// 100 viewport queries
			for (let i = 0; i < 100; i++) {
				const row = i * 10;
				const col = (i % 10) * 10;
				index.query([col, row, col + 49, row + 49] as Rectangle);
			}
		});
	}
}

// ============================================================================
// MIXED BENCHMARKS (80% write, 20% read)
// ============================================================================

for (const { name, Class } of implementations) {
	// Sparse mixed workloads
	Deno.bench(`${name} - mixed: sparse-sequential (n=50) 80/20`, () => {
		const index = new Class();
		for (let i = 0; i < 50; i++) {
			index.insert([0, i * 10, 0, i * 10] as Rectangle, `seq_${i}`);
			if (i % 5 === 0) {
				index.query([0, 0, 9, 99] as Rectangle);
			}
		}
	});

	Deno.bench(`${name} - mixed: sparse-overlapping (n=40) 80/20`, () => {
		const index = new Class();
		for (let i = 0; i < 40; i++) {
			index.insert(
				[(i % 4) * 5, Math.floor(i / 4) * 5, (i % 4) * 5 + 7, Math.floor(i / 4) * 5 + 7] as Rectangle,
				`overlap_${i}`,
			);
			if (i % 5 === 0) {
				index.query([0, 0, 19, 49] as Rectangle);
			}
		}
	});

	// Large mixed workloads
	Deno.bench(`${name} - mixed: large-sequential (n=1000) 80/20`, () => {
		const index = new Class();
		for (let i = 0; i < 1000; i++) {
			index.insert([0, i, 0, i] as Rectangle, `seq_${i}`);
			if (i % 5 === 0) {
				index.query([0, Math.floor(i / 50) * 50, 9, Math.floor(i / 50) * 50 + 99] as Rectangle);
			}
		}
	});

	Deno.bench(`${name} - mixed: large-overlapping (n=500) 80/20`, () => {
		const index = new Class();
		for (let i = 0; i < 500; i++) {
			index.insert(
				[i % 10, Math.floor(i / 5), (i % 10) + 4, Math.floor(i / 5) + 4] as Rectangle,
				`overlap_${i}`,
			);
			if (i % 5 === 0) {
				index.query([0, Math.floor(i / 50) * 10, 19, Math.floor(i / 50) * 10 + 19] as Rectangle);
			}
		}
	});
}

// ============================================================================
// QUERY-ONLY BENCHMARKS (Construction not measured)
// ============================================================================

/**
 * Query-only benchmarks: Measure pure query performance by building the index
 * in the warm-up phase (not measured), then running many queries (measured).
 *
 * This isolates query performance from construction cost, testing tree quality
 * and search efficiency under different data patterns.
 */

// Helper for random query ranges
function generateQueryRange(max: number, random: () => number): Rectangle {
	const row = Math.floor(random() * max);
	const col = Math.floor(random() * max);
	const size = 5 + Math.floor(random() * 10);
	return [col, row, col + size - 1, row + size - 1] as Rectangle;
}

// Scenario 1: Sequential data (tests best-case tree structure)
for (const { name, Class } of implementations) {
	Deno.bench({
		name: `${name} - query-only: sequential (n=1000, 10k queries)`,
		group: 'query-sequential',
		fn: () => {
			const index = new Class();
			// Warm-up: Build index with sequential data (NOT measured)
			for (let i = 0; i < 1000; i++) {
				index.insert(
					[(i % 10) * 10, i * 10, (i % 10) * 10 + 4, i * 10 + 4] as Rectangle,
					`value${i}`,
				);
			}

			// Measured: Pure query performance
			const random = seededRandom(42);
			for (let i = 0; i < 10000; i++) {
				const results = index.query(generateQueryRange(1000, random));
				// Touch results to prevent dead code elimination
				if (results.length > 1000) throw new Error('Unexpected');
			}
		},
	});
}

// Scenario 2: Overlapping data (tests tree quality under stress)
for (const { name, Class } of implementations) {
	Deno.bench({
		name: `${name} - query-only: overlapping (n=1000, 10k queries)`,
		group: 'query-overlapping',
		fn: () => {
			const index = new Class();
			// Warm-up: Build index with high overlap (NOT measured)
			for (let i = 0; i < 1000; i++) {
				index.insert(
					[i % 10, Math.floor(i / 5), (i % 10) + 49, Math.floor(i / 5) + 49] as Rectangle,
					`value${i}`,
				);
			}

			// Measured: Query performance with high overlap
			const random = seededRandom(123);
			for (let i = 0; i < 10000; i++) {
				const results = index.query(generateQueryRange(200, random));
				if (results.length > 1000) throw new Error('Unexpected');
			}
		},
	});
}

// Scenario 3: Large dataset (tests scalability)
for (const { name, Class } of implementations) {
	Deno.bench({
		name: `${name} - query-only: large (n=5000, 10k queries)`,
		group: 'query-large',
		fn: () => {
			const index = new Class();
			// Warm-up: Build large index (NOT measured)
			for (let i = 0; i < 5000; i++) {
				index.insert(
					[(i % 50) * 5, i * 5, (i % 50) * 5 + 9, i * 5 + 9] as Rectangle,
					`value${i}`,
				);
			}

			// Measured: Query performance at scale
			const random = seededRandom(456);
			for (let i = 0; i < 10000; i++) {
				const results = index.query(generateQueryRange(5000, random));
				if (results.length > 5000) throw new Error('Unexpected');
			}
		},
	});
}

// ============================================================================
// CORRECTNESS VERIFICATION
// ============================================================================

Deno.bench('Correctness verification', () => {
	const results = implementations.map(({ Class }) => {
		const index = new Class();
		largeScenarios['large-overlapping (n=1250)'].forEach((op) => index.insert(op.range, op.value));
		return index.query().length;
	});

	if (!results.every((count) => count === results[0])) {
		throw new Error(`Implementations produce different results: ${results.join(', ')}`);
	}
});
