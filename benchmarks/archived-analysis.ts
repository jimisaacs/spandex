/**
 * Comprehensive benchmark including archived implementations
 *
 * Purpose: Analyze ALL implementations (active + archived) to discover
 * insights that may be missing from main documentation.
 *
 * Run with: deno bench benchmarks/archived-analysis.ts
 */

/// <reference types="@types/google-apps-script" />

type GridRange = GoogleAppsScript.Sheets.Schema.GridRange;

// Active implementations
import HilbertLinearScanImpl from '../src/implementations/hilbertlinearscan.ts';
import RTreeImpl from '../src/implementations/rtree.ts';

// Archived implementations
import LinearScanImpl from '../archive/src/implementations/superseded/linearscan.ts';
import ArrayBufferRTreeImpl from '../archive/src/implementations/superseded/arraybufferrtree.ts';
import HybridRTreeImpl from '../archive/src/implementations/failed-experiments/hybridrtree.ts';

const implementations = [
	{ name: 'HilbertLinearScan (active)', Class: HilbertLinearScanImpl, category: 'active' },
	{ name: 'LinearScan (archived-superseded)', Class: LinearScanImpl, category: 'archived' },
	{ name: 'RTree (active)', Class: RTreeImpl, category: 'active' },
	{ name: 'ArrayBufferRTree (archived-superseded)', Class: ArrayBufferRTreeImpl, category: 'archived' },
	{ name: 'HybridRTree (archived-failed)', Class: HybridRTreeImpl, category: 'archived' },
];

// ============================================================================
// QUERY-ONLY BENCHMARKS
// ============================================================================

function generateQueryRange(max: number): GridRange {
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

// Query-only: Sequential (n=1000, 10k queries)
for (const { name, Class } of implementations) {
	Deno.bench({
		name: `${name} - query: sequential (n=1000, 10k queries)`,
		group: 'query-sequential-full',
		fn: () => {
			const index = new Class();
			// Warm-up: Build index (NOT measured)
			for (let i = 0; i < 1000; i++) {
				index.insert({
					startRowIndex: i * 10,
					endRowIndex: i * 10 + 5,
					startColumnIndex: (i % 10) * 10,
					endColumnIndex: (i % 10) * 10 + 5,
				}, `value${i}`);
			}

			// Measured: Query performance
			for (let i = 0; i < 10000; i++) {
				const results = index.query(generateQueryRange(1000));
				if (results.length > 1000) throw new Error('Unexpected');
			}
		},
	});
}

// Query-only: Overlapping (n=1000, 10k queries)
for (const { name, Class } of implementations) {
	Deno.bench({
		name: `${name} - query: overlapping (n=1000, 10k queries)`,
		group: 'query-overlapping-full',
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

			// Measured: Query performance
			for (let i = 0; i < 10000; i++) {
				const results = index.query(generateQueryRange(200));
				if (results.length > 1000) throw new Error('Unexpected');
			}
		},
	});
}

// Query-only: Large (n=5000, 10k queries)
for (const { name, Class } of implementations) {
	Deno.bench({
		name: `${name} - query: large (n=5000, 10k queries)`,
		group: 'query-large-full',
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

			// Measured: Query performance
			for (let i = 0; i < 10000; i++) {
				const results = index.query(generateQueryRange(5000));
				if (results.length > 5000) throw new Error('Unexpected');
			}
		},
	});
}

// ============================================================================
// CONSTRUCTION BENCHMARKS
// ============================================================================

// Construction: Sparse Sequential (n=50)
for (const { name, Class } of implementations) {
	Deno.bench({
		name: `${name} - construct: sparse-sequential (n=50)`,
		group: 'construct-sparse',
		fn: () => {
			const index = new Class();
			for (let i = 0; i < 50; i++) {
				index.insert({
					startRowIndex: i * 10,
					endRowIndex: i * 10 + 5,
					startColumnIndex: (i % 5) * 10,
					endColumnIndex: (i % 5) * 10 + 5,
				}, `value${i}`);
			}
		},
	});
}

// Construction: Large Grid (n=2500)
for (const { name, Class } of implementations) {
	Deno.bench({
		name: `${name} - construct: large-grid (n=2500)`,
		group: 'construct-large',
		fn: () => {
			const index = new Class();
			for (let i = 0; i < 2500; i++) {
				const row = Math.floor(i / 50);
				const col = i % 50;
				index.insert({
					startRowIndex: row * 10,
					endRowIndex: row * 10 + 5,
					startColumnIndex: col * 10,
					endColumnIndex: col * 10 + 5,
				}, `value${i}`);
			}
		},
	});
}

// Construction: Overlapping (n=1250)
for (const { name, Class } of implementations) {
	Deno.bench({
		name: `${name} - construct: overlapping (n=1250)`,
		group: 'construct-overlapping',
		fn: () => {
			const index = new Class();
			for (let i = 0; i < 1250; i++) {
				index.insert({
					startRowIndex: Math.floor(i / 25) * 4,
					endRowIndex: Math.floor(i / 25) * 4 + 20,
					startColumnIndex: (i % 25) * 4,
					endColumnIndex: (i % 25) * 4 + 20,
				}, `value${i}`);
			}
		},
	});
}
