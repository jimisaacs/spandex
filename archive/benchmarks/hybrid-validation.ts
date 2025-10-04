/// <reference types="@types/google-apps-script" />

/**
 * Hybrid R-tree Validation
 *
 * Quick test: Does Hybrid beat specialized implementations at critical points?
 *
 * Test points:
 * - n=100: Crossover point (ArrayBuffer vs RTree)
 * - n=1000: Large data baseline (RTree territory)
 *
 * Success criteria:
 * - Hybrid wins OR matches within 10% at EITHER point
 */

import ArrayBufferLinearScanImpl from '../src/implementations/superseded/arraybufferlinearscan.ts';
import RTreeImpl from '../../src/implementations/rtree.ts';
import HybridRTreeImpl from '../src/implementations/failed-experiments/hybridrtree.ts';

type GridRange = GoogleAppsScript.Sheets.Schema.GridRange;

const implementations = [
	{ name: 'ArrayBufferLinearScan', Class: ArrayBufferLinearScanImpl },
	{ name: 'HybridRTree', Class: HybridRTreeImpl },
	{ name: 'RTree', Class: RTreeImpl },
];

const SIZES = [100, 1000];
const QUERY_COUNT = 500; // Balanced workload

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

// Benchmark critical points
for (const n of SIZES) {
	const datasets = {
		sequential: generateSequential(n),
		grid: generateGrid(n),
		overlapping: generateOverlapping(n),
	};

	for (const [patternName, data] of Object.entries(datasets)) {
		const queries = generateQueries(QUERY_COUNT);

		for (const { name, Class } of implementations) {
			Deno.bench(
				`${name} - ${patternName} (n=${n})`,
				{ group: `${patternName}-n${n}` },
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
