/// <reference types="@types/google-apps-script" />

/**
 * R-tree Shootout: Pick THE Winner
 *
 * Tests all 3 R-tree implementations head-to-head to determine
 * which should be THE production recommendation for n > 1000.
 *
 * Goal: ONE clear winner across all scenarios.
 */

import RStarTreeImpl from '../../src/implementations/rstartree.ts';
import CompactRTreeImpl from '../src/implementations/failed-experiments/compactrtree.ts';
import ArrayBufferRTreeImpl from '../src/implementations/superseded/arraybufferrtree.ts';

type GridRange = GoogleAppsScript.Sheets.Schema.GridRange;

const implementations = [
	{ name: 'RStarTree (R*)', Class: RStarTreeImpl },
	{ name: 'ArrayBufferRTree (midpoint)', Class: ArrayBufferRTreeImpl },
	{ name: 'CompactRTree (minimal)', Class: CompactRTreeImpl },
];

const SIZES = [1000, 2500, 5000];
const QUERY_COUNTS = [0, 1000, 5000]; // Construction only, balanced, read-heavy

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
		const row = (i * 17) % 1000; // Pseudo-random
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
			const workloadName = queryCount === 0 ? 'write-only' : queryCount === 1000 ? 'balanced' : 'read-heavy';

			for (const { name, Class } of implementations) {
				Deno.bench(
					`${name} - ${patternName} (n=${n}) - ${workloadName}`,
					{ group: `${patternName}-n${n}-${workloadName}` },
					() => {
						const tree = new Class<string>();

						// Construction
						for (const d of data) {
							tree.insert(d.range, d.value);
						}

						// Queries
						for (const q of queries) {
							tree.query(q);
						}
					},
				);
			}
		}
	}
}
