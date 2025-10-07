/// <reference types="@types/google-apps-script" />

/**
 * Hilbert Curve Validation
 *
 * Test: Does spatial locality from Hilbert curve ordering improve performance?
 */

import ArrayBufferLinearScanImpl from '../src/implementations/superseded/arraybufferlinearscan.ts';
import HilbertLinearScanImpl from '../src/implementations/superseded/hilbertlinearscan.ts';
import RTreeImpl from '../../src/implementations/rtree.ts';

type GridRange = GoogleAppsScript.Sheets.Schema.GridRange;

const implementations = [
	{ name: 'ArrayBufferLinearScan', Class: ArrayBufferLinearScanImpl },
	{ name: 'HilbertLinearScan', Class: HilbertLinearScanImpl },
	{ name: 'RTree', Class: RTreeImpl },
];

const SIZES = [100, 1000];
const QUERY_COUNT = 500;

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

for (const n of SIZES) {
	const data = generateGrid(n);
	const queries = generateQueries(QUERY_COUNT);

	for (const { name, Class } of implementations) {
		Deno.bench(`${name} - grid (n=${n})`, { group: `grid-n${n}` }, () => {
			const store = new Class<string>();
			for (const d of data) store.insert(d.range, d.value);
			for (const q of queries) store.query(q);
		});
	}
}
