/// <reference types="@types/google-apps-script" />

/**
 * Linear Scan Championship: Find the Sparse Data Winner
 *
 * Tests all 4 linear scan implementations head-to-head to validate
 * that OptimizedLinearScanImpl is truly optimal for n < 100.
 *
 * Goal: Empirically validate or replace current sparse data recommendation.
 */

import ArrayBufferLinearScanImpl from '../src/implementations/superseded/arraybufferlinearscan.ts';
import CompactLinearScanImpl from '../../src/implementations/compactlinearscan.ts';
import LinearScanImpl from '../src/implementations/superseded/linearscan.ts';
import OptimizedLinearScanImpl from '../src/implementations/superseded/optimizedlinearscan.ts';

type GridRange = GoogleAppsScript.Sheets.Schema.GridRange;

const implementations = [
	{ name: 'LinearScan (reference)', Class: LinearScanImpl },
	{ name: 'CompactLinearScan (minimal)', Class: CompactLinearScanImpl },
	{ name: 'OptimizedLinearScan (V8-tuned)', Class: OptimizedLinearScanImpl },
	{ name: 'ArrayBufferLinearScan (TypedArray)', Class: ArrayBufferLinearScanImpl },
];

const SIZES = [10, 25, 50, 75, 100];
const QUERY_COUNTS = [50, 250, 1000]; // Write-heavy, balanced, read-heavy

// Data generators
function generateSequential(n: number) {
	return Array.from({ length: n }, (_, i) => ({
		range: {
			startRowIndex: i * 10,
			endRowIndex: i * 10 + 1,
			startColumnIndex: 0,
			endColumnIndex: 1,
		},
		value: `seq_${i}`,
	}));
}

function generateGrid(n: number) {
	const cols = Math.ceil(Math.sqrt(n));
	return Array.from({ length: n }, (_, i) => ({
		range: {
			startRowIndex: Math.floor(i / cols) * 3,
			endRowIndex: Math.floor(i / cols) * 3 + 2,
			startColumnIndex: (i % cols) * 3,
			endColumnIndex: (i % cols) * 3 + 2,
		},
		value: `grid_${i}`,
	}));
}

function generateOverlapping(n: number) {
	const cols = Math.ceil(Math.sqrt(n / 2));
	return Array.from({ length: n }, (_, i) => ({
		range: {
			startRowIndex: Math.floor(i / cols) * 2,
			endRowIndex: Math.floor(i / cols) * 2 + 5,
			startColumnIndex: (i % cols) * 2,
			endColumnIndex: (i % cols) * 2 + 5,
		},
		value: `overlap_${i}`,
	}));
}

function generateQueries(count: number): GridRange[] {
	return Array.from({ length: count }, (_, i) => {
		const row = (i * 17) % 100; // Pseudo-random in sparse space
		const col = (i * 13) % 50;
		return {
			startRowIndex: row,
			endRowIndex: row + 5,
			startColumnIndex: col,
			endColumnIndex: col + 3,
		};
	});
}

// Benchmark matrix
for (const n of SIZES) {
	const datasets = {
		sequential: generateSequential(n),
		grid: generateGrid(n),
		overlapping: generateOverlapping(n),
	};

	for (const [patternName, data] of Object.entries(datasets)) {
		for (const queryCount of QUERY_COUNTS) {
			const queries = generateQueries(queryCount);
			const workloadName = queryCount === 50 ? 'write-heavy' : queryCount === 250 ? 'balanced' : 'read-heavy';

			for (const { name, Class } of implementations) {
				Deno.bench(
					`${name} - ${patternName} (n=${n}) - ${workloadName}`,
					{ group: `${patternName}-n${n}-${workloadName}` },
					() => {
						const store = new Class<string>();

						// Construction
						for (const d of data) {
							store.insert(d.range, d.value);
						}

						// Queries
						for (const q of queries) {
							store.query(q);
						}
					},
				);
			}
		}
	}
}
