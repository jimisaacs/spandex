/// <reference types="@types/google-apps-script" />

/**
 * Corrected Transition Zone: ArrayBuffer vs RTree
 *
 * Previous transition zone experiment used OptimizedLinearScanImpl (WRONG).
 * This experiment uses ArrayBufferLinearScanImpl (TRUE sparse winner) to
 * find the CORRECT crossover points.
 *
 * Goal: Map where ArrayBufferLinearScan → RTree transition actually occurs.
 */

import ArrayBufferLinearScanImpl from '../src/implementations/superseded/arraybufferlinearscan.ts';
import RTreeImpl from '../../src/implementations/rtree.ts';

type GridRange = GoogleAppsScript.Sheets.Schema.GridRange;

const implementations = [
	{ name: 'ArrayBufferLinearScan', Class: ArrayBufferLinearScanImpl },
	{ name: 'RTree', Class: RTreeImpl },
];

// Focus on transition zone: 100-1000
const SIZES = [100, 150, 200, 300, 400, 500, 600, 700, 800, 1000];
const QUERY_COUNTS = [50, 500, 2000]; // Write-heavy, balanced, read-heavy

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
		const row = (i * 17) % 1000;
		const col = (i * 13) % 100;
		return {
			startRowIndex: row,
			endRowIndex: row + 20,
			startColumnIndex: col,
			endColumnIndex: col + 10,
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
			const queries = queryCount > 0 ? generateQueries(queryCount) : [];
			const workloadName = queryCount === 50 ? 'write-heavy' : queryCount === 500 ? 'balanced' : 'read-heavy';

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
