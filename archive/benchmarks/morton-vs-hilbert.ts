/// <reference types="@types/google-apps-script" />

/**
 * Focused benchmark: Morton vs Hilbert curve comparison
 *
 * Tests the hypothesis that Hilbert is 10-20% faster than Morton
 * due to superior locality preservation.
 */

import HilbertLinearScanImpl from '../src/implementations/superseded/hilbertlinearscan.ts';
import MortonLinearScanImpl from '../../src/implementations/mortonlinearscan.ts';

type GridRange = GoogleAppsScript.Sheets.Schema.GridRange;

const range = (r1?: number, r2?: number, c1?: number, c2?: number): GridRange => ({
	startRowIndex: r1,
	endRowIndex: r2,
	startColumnIndex: c1,
	endColumnIndex: c2,
});

// Test scenarios
const scenarios = {
	'sparse-sequential-n50': () => {
		const ops: Array<GridRange> = [];
		for (let i = 0; i < 50; i++) {
			ops.push(range(i * 10, i * 10 + 5, 0, 100));
		}
		return ops;
	},
	'sparse-grid-n60': () => {
		const ops: Array<GridRange> = [];
		for (let row = 0; row < 6; row++) {
			for (let col = 0; col < 10; col++) {
				ops.push(range(row * 10, row * 10 + 5, col * 10, col * 10 + 5));
			}
		}
		return ops;
	},
	'sparse-overlapping-n40': () => {
		const ops: Array<GridRange> = [];
		// Non-overlapping base
		for (let i = 0; i < 30; i++) {
			ops.push(range(i * 5, i * 5 + 4, 0, 100));
		}
		// Overlapping additions
		for (let i = 0; i < 10; i++) {
			ops.push(range(i * 15, i * 15 + 10, 20, 80));
		}
		return ops;
	},
	'medium-sequential-n100': () => {
		const ops: Array<GridRange> = [];
		for (let i = 0; i < 100; i++) {
			ops.push(range(i * 10, i * 10 + 5, 0, 100));
		}
		return ops;
	},
	'large-sequential-n500': () => {
		const ops: Array<GridRange> = [];
		for (let i = 0; i < 500; i++) {
			ops.push(range(i * 10, i * 10 + 5, 0, 100));
		}
		return ops;
	},
};

// Benchmark: HilbertLinearScan
for (const [name, genOps] of Object.entries(scenarios)) {
	Deno.bench({
		name: `Hilbert: ${name}`,
		fn: () => {
			const index = new HilbertLinearScanImpl<string>();
			const ops = genOps();
			for (const op of ops) {
				index.insert(op, 'value');
			}
		},
	});
}

// Benchmark: MortonLinearScan
for (const [name, genOps] of Object.entries(scenarios)) {
	Deno.bench({
		name: `Morton: ${name}`,
		fn: () => {
			const index = new MortonLinearScanImpl<string>();
			const ops = genOps();
			for (const op of ops) {
				index.insert(op, 'value');
			}
		},
	});
}
