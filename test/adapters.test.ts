/**
 * Google Sheets Adapter Tests
 *
 * Tests for A1 notation adapter. These run once (not per implementation)
 * since the adapter is implementation-agnostic.
 */

import { assertEquals } from '@std/assert';
import { createA1Adapter } from '../src/adapters/a1.ts';
import { assertSnapshot, parseMarkdownFixtures, renderToAscii } from '../src/conformance/ascii-snapshot.ts';
import MortonLinearScanImpl from '../src/implementations/mortonlinearscan.ts';

// Load fixtures from markdown
const FIXTURES_FILE = '../docs/fixtures/adapters-test.md';
const markdownContent = await Deno.readTextFile(new URL(FIXTURES_FILE, import.meta.url));
const allFixtures = parseMarkdownFixtures(markdownContent);
const fixtureMap = new Map(allFixtures.map((f) => [f.name, f.snapshot]));

function loadFixture(name: string): string {
	const fixture = fixtureMap.get(name);
	if (!fixture) {
		throw new Error(`Fixture not found: ${name}\nAvailable: ${[...fixtureMap.keys()].join(', ')}`);
	}
	return fixture;
}

Deno.test('A1 Notation - Cell Range (A1:C3)', () => {
	const index = createA1Adapter(new MortonLinearScanImpl<string>());

	// Insert using A1 notation - A1:C3 means cols A-C, rows 1-3 (converts to internal [0,0,2,2])
	index.insert('A1:C3', 'DATA');

	// Query and verify conversion
	const results = Array.from(index.query());
	assertEquals(results.length, 1);
	assertEquals(results[0][0], [0, 0, 2, 2]); // Verify A1→internal conversion

	// Render (displays with 0-indexed rows, which is the internal representation)
	const impl = new MortonLinearScanImpl<string>();
	impl.insert(results[0][0], results[0][1]);

	const actual = renderToAscii(impl, {
		width: 3,
		height: 3,
	});

	const expected = loadFixture('A1 Notation - Cell Range');
	assertSnapshot(actual, expected);
});

Deno.test('A1 Notation - Column Range (B:D)', () => {
	const index = createA1Adapter(new MortonLinearScanImpl<string>());

	// Insert column range
	index.insert('B:D', 'COLS');

	// Query limited viewport
	const impl = new MortonLinearScanImpl<string>();
	for (const [bounds, value] of index.query()) {
		// Limit to visible viewport
		const limited: typeof bounds = [
			Math.max(bounds[0], 0),
			Math.max(bounds[1], 0),
			Math.min(bounds[2], 4),
			Math.min(bounds[3], 2),
		];
		impl.insert(limited, value);
	}

	const actual = renderToAscii(impl, {
		width: 5,
		height: 3,
	});

	const expected = loadFixture('A1 Notation - Column Range');
	assertSnapshot(actual, expected);
});

Deno.test('A1 Notation - Row Range (2:4)', () => {
	const index = createA1Adapter(new MortonLinearScanImpl<string>());

	// Insert row range - "2:4" in A1 notation = rows 2-4 = converts to internal [-∞, 1, ∞, 3]
	index.insert('2:4', 'ROWS');

	// Query and limit to viewport
	const impl = new MortonLinearScanImpl<string>();
	for (const [bounds, value] of index.query()) {
		// Limit infinite columns to viewport [0-2] and show rows 0-3
		const limited: typeof bounds = [
			Math.max(bounds[0], 0),
			Math.max(bounds[1], 0), // Start from row 0
			Math.min(bounds[2], 2),
			Math.min(bounds[3], 3),
		];
		impl.insert(limited, value);
	}

	const actual = renderToAscii(impl, {
		width: 3,
		height: 4,
	});

	const expected = loadFixture('A1 Notation - Row Range');
	assertSnapshot(actual, expected);
});

Deno.test('A1 Notation - Overlapping Ranges (Last-Writer-Wins)', () => {
	const index = createA1Adapter(new MortonLinearScanImpl<number>());

	// Insert overlapping ranges - A1:B2 then B2:C3 (B2 overlaps, LWW applies)
	index.insert('A1:B2', 1);
	index.insert('B2:C3', 2);

	// Render (internal representation: rows 0-2)
	const impl = new MortonLinearScanImpl<number>();
	for (const [bounds, value] of index.query()) {
		impl.insert(bounds, value);
	}

	const actual = renderToAscii(impl, {
		width: 3,
		height: 3,
		valueFormatter: (v) => String(v),
	});

	const expected = loadFixture('A1 Notation - Overlapping Ranges');
	assertSnapshot(actual, expected);
});
