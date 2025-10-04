/// <reference types="@types/google-apps-script" />

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
		range: { startRowIndex: i * 10, endRowIndex: i * 10 + 1, startColumnIndex: 0, endColumnIndex: 1 },
		value: `seq_${i}`,
	})),

	'sparse-grid (n=60)': Array.from({ length: 60 }, (_, i) => ({
		range: {
			startRowIndex: Math.floor(i / 6) * 10,
			endRowIndex: Math.floor(i / 6) * 10 + 2,
			startColumnIndex: (i % 6) * 10,
			endColumnIndex: (i % 6) * 10 + 2,
		},
		value: `grid_${i}`,
	})),

	'sparse-overlapping (n=40)': Array.from({ length: 40 }, (_, i) => ({
		range: {
			startRowIndex: Math.floor(i / 4) * 5,
			endRowIndex: Math.floor(i / 4) * 5 + 8,
			startColumnIndex: (i % 4) * 5,
			endColumnIndex: (i % 4) * 5 + 8,
		},
		value: `overlap_${i}`,
	})),

	'sparse-large-ranges (n=30)': Array.from({ length: 30 }, (_, i) => ({
		range: {
			startRowIndex: i * 50,
			endRowIndex: i * 50 + 30,
			startColumnIndex: i * 50,
			endColumnIndex: i * 50 + 30,
		},
		value: `large_${i}`,
	})),

	// NEW: Real-world spreadsheet patterns
	'single-cell-edits (n=50)': Array.from({ length: 50 }, (_, i) => ({
		range: {
			startRowIndex: Math.floor(i / 10),
			endRowIndex: Math.floor(i / 10) + 1,
			startColumnIndex: i % 10,
			endColumnIndex: (i % 10) + 1,
		},
		value: `cell_${i}`,
	})),

	'column-operations (n=20)': Array.from({ length: 20 }, (_, i) => ({
		range: {
			startRowIndex: 0,
			endRowIndex: 1000, // Full column height
			startColumnIndex: i,
			endColumnIndex: i + 1,
		},
		value: `col_${i}`,
	})),

	'row-operations (n=20)': Array.from({ length: 20 }, (_, i) => ({
		range: {
			startRowIndex: i,
			endRowIndex: i + 1,
			startColumnIndex: 0,
			endColumnIndex: 26, // Full row width (A-Z)
		},
		value: `row_${i}`,
	})),

	'diagonal-selection (n=30)': Array.from({ length: 30 }, (_, i) => ({
		range: {
			startRowIndex: i,
			endRowIndex: i + 5,
			startColumnIndex: i,
			endColumnIndex: i + 5,
		},
		value: `diag_${i}`,
	})),

	'striping-alternating-rows (n=25)': Array.from({ length: 25 }, (_, i) => ({
		range: {
			startRowIndex: i * 2, // Every other row
			endRowIndex: i * 2 + 1,
			startColumnIndex: 0,
			endColumnIndex: 10,
		},
		value: `stripe_${i}`,
	})),

	'merge-like-blocks (n=15)': Array.from({ length: 15 }, (_, i) => ({
		range: {
			startRowIndex: Math.floor(i / 3) * 20,
			endRowIndex: Math.floor(i / 3) * 20 + 15,
			startColumnIndex: (i % 3) * 15,
			endColumnIndex: (i % 3) * 15 + 12,
		},
		value: `block_${i}`,
	})),
};

// Large scenarios (n > 1000) - stress testing
const largeScenarios = {
	'large-sequential (n=2500)': Array.from({ length: 2500 }, (_, i) => ({
		range: { startRowIndex: i, endRowIndex: i + 1, startColumnIndex: 0, endColumnIndex: 1 },
		value: `seq_${i}`,
	})),

	'large-grid (n=2500)': Array.from({ length: 2500 }, (_, i) => ({
		range: {
			startRowIndex: Math.floor(i / 10) * 2,
			endRowIndex: Math.floor(i / 10) * 2 + 1,
			startColumnIndex: (i % 10) * 2,
			endColumnIndex: (i % 10) * 2 + 1,
		},
		value: `grid_${i}`,
	})),

	'large-overlapping (n=1250)': Array.from({ length: 1250 }, (_, i) => ({
		range: {
			startRowIndex: Math.floor(i / 5),
			endRowIndex: Math.floor(i / 5) + 5,
			startColumnIndex: i % 10,
			endColumnIndex: (i % 10) + 5,
		},
		value: `overlap_${i}`,
	})),

	'large-ranges (n=500)': Array.from({ length: 500 }, (_, i) => ({
		range: {
			startRowIndex: i * 50,
			endRowIndex: i * 50 + 100,
			startColumnIndex: i * 50,
			endColumnIndex: i * 50 + 100,
		},
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
				index.query({
					startRowIndex: row,
					endRowIndex: row + 20,
					startColumnIndex: col,
					endColumnIndex: col + 20,
				});
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
				index.query({
					startRowIndex: row,
					endRowIndex: row + 50,
					startColumnIndex: col,
					endColumnIndex: col + 50,
				});
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
			index.insert(
				{ startRowIndex: i * 10, endRowIndex: i * 10 + 1, startColumnIndex: 0, endColumnIndex: 1 },
				`seq_${i}`,
			);
			if (i % 5 === 0) {
				index.query({ startRowIndex: 0, endRowIndex: 100, startColumnIndex: 0, endColumnIndex: 10 });
			}
		}
	});

	Deno.bench(`${name} - mixed: sparse-overlapping (n=40) 80/20`, () => {
		const index = new Class();
		for (let i = 0; i < 40; i++) {
			index.insert(
				{
					startRowIndex: Math.floor(i / 4) * 5,
					endRowIndex: Math.floor(i / 4) * 5 + 8,
					startColumnIndex: (i % 4) * 5,
					endColumnIndex: (i % 4) * 5 + 8,
				},
				`overlap_${i}`,
			);
			if (i % 5 === 0) {
				index.query({ startRowIndex: 0, endRowIndex: 50, startColumnIndex: 0, endColumnIndex: 20 });
			}
		}
	});

	// Large mixed workloads
	Deno.bench(`${name} - mixed: large-sequential (n=1000) 80/20`, () => {
		const index = new Class();
		for (let i = 0; i < 1000; i++) {
			index.insert({ startRowIndex: i, endRowIndex: i + 1, startColumnIndex: 0, endColumnIndex: 1 }, `seq_${i}`);
			if (i % 5 === 0) {
				index.query({
					startRowIndex: Math.floor(i / 50) * 50,
					endRowIndex: Math.floor(i / 50) * 50 + 100,
					startColumnIndex: 0,
					endColumnIndex: 10,
				});
			}
		}
	});

	Deno.bench(`${name} - mixed: large-overlapping (n=500) 80/20`, () => {
		const index = new Class();
		for (let i = 0; i < 500; i++) {
			index.insert(
				{
					startRowIndex: Math.floor(i / 5),
					endRowIndex: Math.floor(i / 5) + 5,
					startColumnIndex: i % 10,
					endColumnIndex: (i % 10) + 5,
				},
				`overlap_${i}`,
			);
			if (i % 5 === 0) {
				index.query({
					startRowIndex: Math.floor(i / 50) * 10,
					endRowIndex: Math.floor(i / 50) * 10 + 20,
					startColumnIndex: 0,
					endColumnIndex: 20,
				});
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
function generateQueryRange(max: number): GoogleAppsScript.Sheets.Schema.GridRange {
	const row = Math.floor(Math.random() * max);
	const col = Math.floor(Math.random() * max);
	const size = 5 + Math.floor(Math.random() * 10);
	return {
		startRowIndex: row,
		endRowIndex: row + size,
		startColumnIndex: col,
		endColumnIndex: col + size,
	};
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
				index.insert({
					startRowIndex: i * 10,
					endRowIndex: i * 10 + 5,
					startColumnIndex: (i % 10) * 10,
					endColumnIndex: (i % 10) * 10 + 5,
				}, `value${i}`);
			}

			// Measured: Pure query performance
			for (let i = 0; i < 10000; i++) {
				const results = index.query(generateQueryRange(1000));
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
				index.insert({
					startRowIndex: Math.floor(i / 5),
					endRowIndex: Math.floor(i / 5) + 50,
					startColumnIndex: i % 10,
					endColumnIndex: (i % 10) + 50,
				}, `value${i}`);
			}

			// Measured: Query performance with high overlap
			for (let i = 0; i < 10000; i++) {
				const results = index.query(generateQueryRange(200));
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
				index.insert({
					startRowIndex: i * 5,
					endRowIndex: i * 5 + 10,
					startColumnIndex: (i % 50) * 5,
					endColumnIndex: (i % 50) * 5 + 10,
				}, `value${i}`);
			}

			// Measured: Query performance at scale
			for (let i = 0; i < 10000; i++) {
				const results = index.query(generateQueryRange(5000));
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
		return index.getAllRanges().length;
	});

	if (!results.every((count) => count === results[0])) {
		throw new Error(`Implementations produce different results: ${results.join(', ')}`);
	}
});
