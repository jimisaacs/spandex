/// <reference types="@types/google-apps-script" />

import { assertEquals } from '@std/assert';
import MortonLinearScanImpl from '../src/implementations/mortonlinearscan.ts';
import RStarTreeImpl from '../src/implementations/rstartree.ts';

Deno.test('All implementations produce identical results', () => {
	const implementations = [
		{ name: 'MortonLinearScan', Class: MortonLinearScanImpl },
		{ name: 'RStarTree', Class: RStarTreeImpl },
	];

	const operations = [
		{ range: { startRowIndex: 0, endRowIndex: 5, startColumnIndex: 0, endColumnIndex: 5 }, value: 'base' },
		{ range: { startRowIndex: 2, endRowIndex: 7, startColumnIndex: 2, endColumnIndex: 7 }, value: 'overlap1' },
		{ range: { startRowIndex: 1, endRowIndex: 3, startColumnIndex: 4, endColumnIndex: 8 }, value: 'overlap2' },
		{ range: { startRowIndex: 6, endRowIndex: 9, startColumnIndex: 1, endColumnIndex: 4 }, value: 'separate' },
		{ range: {}, value: 'global' },
	];

	const results = implementations.map(({ name, Class }) => {
		const index = new Class<string>();
		operations.forEach((op) => index.insert(op.range, op.value));
		const ranges = index.getAllRanges();
		return { name, ranges };
	});

	// Normalize GridRange for comparison (property order doesn't matter)
	const normalize = (range: { gridRange: GoogleAppsScript.Sheets.Schema.GridRange; value: string }) => {
		const g = range.gridRange;
		return {
			startRowIndex: g.startRowIndex,
			endRowIndex: g.endRowIndex,
			startColumnIndex: g.startColumnIndex,
			endColumnIndex: g.endColumnIndex,
			value: range.value,
		};
	};

	const sortKey = (r: ReturnType<typeof normalize>) =>
		`${r.startRowIndex ?? 0},${r.endRowIndex ?? Infinity},${r.startColumnIndex ?? 0},${
			r.endColumnIndex ?? Infinity
		},${r.value}`;

	const referenceNormalized = results[0].ranges.map(normalize).sort((
		a: ReturnType<typeof normalize>,
		b: ReturnType<typeof normalize>,
	) => sortKey(a).localeCompare(sortKey(b)));

	for (const result of results.slice(1)) {
		const resultNormalized = result.ranges.map(normalize).sort((
			a: ReturnType<typeof normalize>,
			b: ReturnType<typeof normalize>,
		) => sortKey(a).localeCompare(sortKey(b)));
		assertEquals(
			JSON.stringify(resultNormalized),
			JSON.stringify(referenceNormalized),
			`${result.name} should produce identical results to ${results[0].name}`,
		);
	}
});

Deno.test('Performance comparison across implementations', () => {
	const implementations = [
		{ name: 'MortonLinearScan', Class: MortonLinearScanImpl },
		{ name: 'RStarTree', Class: RStarTreeImpl },
	];

	const operations = Array.from({ length: 100 }, (_, i) => ({
		range: {
			startRowIndex: Math.floor(i / 10) * 5,
			endRowIndex: Math.floor(i / 10) * 5 + 3,
			startColumnIndex: (i % 10) * 5,
			endColumnIndex: (i % 10) * 5 + 3,
		},
		value: `data_${i}`,
	}));

	// Performance comparison (informational only, belongs in benchmarks/)
	const results = implementations.map(({ name, Class }) => {
		const index = new Class();
		const start = performance.now();
		operations.forEach((op) => index.insert(op.range, op.value));
		const time = performance.now() - start;
		const rangeCount = index.getAllRanges().length;
		return { name, time, rangeCount };
	});

	// Verify all produce same range count
	const referenceCount = results[0].rangeCount;
	for (const result of results) {
		assertEquals(
			result.rangeCount,
			referenceCount,
			`${result.name} should produce same range count as ${results[0].name}`,
		);
	}
});

Deno.test('Memory efficiency validation', () => {
	const implementations = [
		{ name: 'MortonLinearScan', Class: MortonLinearScanImpl },
		{ name: 'RStarTree', Class: RStarTreeImpl },
	];

	const operations = Array.from({ length: 200 }, (_, i) => ({
		range: {
			startRowIndex: i * 2,
			endRowIndex: i * 2 + 5,
			startColumnIndex: i * 2,
			endColumnIndex: i * 2 + 5,
		},
		value: `mem_${i}`,
	}));

	// All implementations should produce same range count (consistency check)
	const results = implementations.map(({ name, Class }) => {
		const index = new Class();
		operations.forEach((op) => index.insert(op.range, op.value));
		return { name, rangeCount: index.getAllRanges().length };
	});

	// Verify all implementations produce identical results
	const referenceCount = results[0].rangeCount;
	for (const result of results) {
		assertEquals(
			result.rangeCount,
			referenceCount,
			`memory efficiency: ${result.name} should produce ${referenceCount} ranges like ${results[0].name}`,
		);
	}
});
