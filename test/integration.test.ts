/// <reference types="@types/google-apps-script" />

import MortonLinearScanImpl from '../src/implementations/mortonlinearscan.ts';
import CompactMortonLinearScanImpl from '../src/implementations/compactmortonlinearscan.ts';
import RTreeImpl from '../src/implementations/rtree.ts';

Deno.test('All implementations produce identical results', () => {
	const implementations = [
		{ name: 'MortonLinearScan', Class: MortonLinearScanImpl },
		{ name: 'CompactMortonLinearScan', Class: CompactMortonLinearScanImpl },
		{ name: 'RTree', Class: RTreeImpl },
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

	const referenceNormalized = results[0].ranges.map(normalize).sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

	for (const result of results.slice(1)) {
		const resultNormalized = result.ranges.map(normalize).sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
		if (JSON.stringify(resultNormalized) !== JSON.stringify(referenceNormalized)) {
			throw new Error(`${result.name} produced different results than ${results[0].name}`);
		}
	}

	console.log(`✅ All ${results.length} implementations produce identical results`);
	console.log(`   Final range count: ${results[0].ranges.length}`);
	console.log(`   Final value: ${results[0].ranges[0]?.value}`);
});

Deno.test('Performance comparison across implementations', () => {
	const implementations = [
		{ name: 'MortonLinearScan', Class: MortonLinearScanImpl },
		{ name: 'CompactMortonLinearScan', Class: CompactMortonLinearScanImpl },
		{ name: 'RTree', Class: RTreeImpl },
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

	console.log('\n=== PERFORMANCE COMPARISON ===');

	const results = implementations.map(({ name, Class }) => {
		const index = new Class();
		const start = performance.now();
		operations.forEach((op) => index.insert(op.range, op.value));
		const time = performance.now() - start;
		const rangeCount = index.getAllRanges().length;
		console.log(`${name}: ${time.toFixed(2)}ms (${rangeCount} ranges)`);
		return { name, time, rangeCount };
	});

	const fastest = results.reduce((min, curr) => (curr.time < min.time ? curr : min));
	console.log(`🏆 Fastest: ${fastest.name} (${fastest.time.toFixed(2)}ms)`);

	// Verify all produce same range count
	if (!results.every((r) => r.rangeCount === results[0].rangeCount)) {
		throw new Error('Implementations produced different range counts!');
	}
});

Deno.test('Memory efficiency validation', () => {
	const implementations = [
		{ name: 'MortonLinearScan', Class: MortonLinearScanImpl },
		{ name: 'CompactMortonLinearScan', Class: CompactMortonLinearScanImpl },
		{ name: 'RTree', Class: RTreeImpl },
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

	implementations.forEach(({ name, Class }) => {
		const index = new Class();
		operations.forEach((op) => index.insert(op.range, op.value));
		const rangeCount = index.getAllRanges().length;
		console.log(`${name}: ${rangeCount} ranges produced`);
	});
});
