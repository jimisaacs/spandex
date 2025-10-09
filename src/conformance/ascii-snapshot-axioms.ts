/**
 * ASCII Snapshot Conformance Tests
 *
 * Visual regression tests using ASCII art snapshots. Fixtures are loaded from
 * docs/conformance-test-fixtures.md which serves as both human-readable
 * documentation and test data.
 */

import { assertEquals } from '@std/assert';
import {
	assertSnapshot,
	parseAscii,
	parseMarkdownFixtures,
	renderToAscii,
	snapshotToRegions,
} from './ascii-snapshot.ts';
import type { TestConfig } from './testsuite.ts';

// Load all fixtures from markdown documentation
const FIXTURES_FILE = '../../docs/fixtures/conformance-test.md';
const markdownContent = await Deno.readTextFile(new URL(FIXTURES_FILE, import.meta.url));
const allFixtures = parseMarkdownFixtures(markdownContent);

// Create a map for easy lookup by test name
const fixtureMap = new Map(allFixtures.map((f) => [f.name, f.snapshot]));

// Helper to load a fixture by name
function loadFixture(name: string): string {
	const fixture = fixtureMap.get(name);
	if (!fixture) {
		throw new Error(`Fixture not found: ${name}\nAvailable: ${[...fixtureMap.keys()].join(', ')}`);
	}
	return fixture;
}

/**
 * Run ASCII snapshot tests for a given implementation.
 * These tests validate rendering correctness across all implementations.
 */
export function testAsciiSnapshotAxioms(config: TestConfig): void {
	const { implementation, name } = config;

	// ========================================================================
	// BASIC RENDERING TESTS
	// ========================================================================
	// Tests basic insert, render, and visual regression functionality

	Deno.test(`${name} - ASCII Snapshot - LWW Example (from docs)`, () => {
		const index = implementation<string>();

		// Step 1: Color A1:C2 Red
		index.insert([0, 1, 2, 2], 'RED');

		// Step 2: Color B0:D2 Blue (overlaps with red)
		index.insert([1, 0, 3, 2], 'BLUE');

		// Render to ASCII
		const actual = renderToAscii(index, {
			width: 4,
			height: 4,
			startCol: 0,
			startRow: 0,
			valueFormatter: (v) => String(v)[0],
		});

		const expected = loadFixture('LWW Example');
		assertSnapshot(actual, expected);
	});

	Deno.test(`${name} - ASCII Snapshot - Single Rectangle`, () => {
		const index = implementation<string>();
		index.insert([1, 1, 3, 2], 'TEST');

		const actual = renderToAscii(index, {
			width: 5,
			height: 4,
		});

		const expected = loadFixture('Single Rectangle');
		assertSnapshot(actual, expected);
	});

	Deno.test(`${name} - ASCII Snapshot - Adjacent Non-Overlapping`, () => {
		const index = implementation<string>();
		index.insert([0, 0, 1, 1], 'A');
		index.insert([2, 0, 3, 1], 'B');
		index.insert([0, 2, 1, 3], 'C');
		index.insert([2, 2, 3, 3], 'D');

		const actual = renderToAscii(index, {
			width: 4,
			height: 4,
			valueFormatter: (v) => String(v),
		});

		const expected = loadFixture('Adjacent Non-Overlapping');
		assertSnapshot(actual, expected);
	});

	Deno.test(`${name} - ASCII Snapshot - Viewport Offset`, () => {
		const index = implementation<string>();
		index.insert([5, 5, 7, 7], 'DATA');

		const actual = renderToAscii(index, {
			width: 4,
			height: 4,
			startCol: 5,
			startRow: 5,
			valueFormatter: (v) => String(v)[0],
		});

		const expected = loadFixture('Viewport Offset');
		assertSnapshot(actual, expected);
	});

	Deno.test(`${name} - ASCII Snapshot - Empty Index`, () => {
		const index = implementation<string>();

		const actual = renderToAscii(index, {
			width: 3,
			height: 3,
		});

		const expected = loadFixture('Empty Index');
		assertSnapshot(actual, expected);
	});

	Deno.test(`${name} - ASCII Snapshot - Round-Trip (Render → Parse → Render)`, () => {
		const index = implementation<string>();
		index.insert([0, 0, 1, 1], 'A');
		index.insert([2, 0, 3, 1], 'B');

		// Render to ASCII
		const rendered1 = renderToAscii(index, { width: 4, height: 2 });

		// Parse it
		const parsed = parseAscii(rendered1);

		// Create new index from parsed regions
		const index2 = implementation<string>();
		const regions = snapshotToRegions(parsed);
		for (const { bounds, value } of regions) {
			index2.insert(bounds, value);
		}

		// Render again
		const rendered2 = renderToAscii(index2, { width: 4, height: 2 });

		// Should match
		assertSnapshot(rendered2, rendered1);
	});

	Deno.test(`${name} - ASCII Snapshot - Stripes`, () => {
		const index = implementation<string>();

		// Vertical stripes
		index.insert([0, 0, 0, 3], 'A');
		index.insert([2, 0, 2, 3], 'B');
		index.insert([4, 0, 4, 3], 'C');

		const actual = renderToAscii(index, {
			width: 5,
			height: 4,
		});

		const expected = loadFixture('Horizontal Stripes');
		assertSnapshot(actual, expected);
	});

	// ========================================================================
	// NUMERIC VALUE TESTS
	// ========================================================================
	// Tests rendering with numeric values (not in standard conformance suite)

	Deno.test('Complex Fragmentation (number values)', () => {
		const index = implementation<number>();

		// Insert large rectangle
		index.insert([0, 0, 4, 4], 1);

		// Punch hole in middle
		index.insert([2, 2, 2, 2], 2);

		// Add corner overlay
		index.insert([3, 3, 4, 4], 3);

		const actual = renderToAscii(index, {
			width: 5,
			height: 5,
			valueFormatter: (v) => String(v),
		});

		const expected = loadFixture('Complex Fragmentation (numeric values)');
		assertSnapshot(actual, expected);
	});

	Deno.test('Diagonal Pattern (number values)', () => {
		const index = implementation<number>();

		// Create diagonal pattern
		for (let i = 0; i < 5; i++) {
			index.insert([i, i, i, i], i + 1);
		}

		const actual = renderToAscii(index, {
			width: 5,
			height: 5,
			valueFormatter: (v) => String(v),
		});

		const expected = loadFixture('Diagonal Pattern (numeric values)');
		assertSnapshot(actual, expected);
	});

	Deno.test('Progressive Overlap (number values)', () => {
		const index = implementation<number>();

		// Layer 3 rectangles with progressive overlaps
		index.insert([0, 0, 3, 2], 1);
		index.insert([2, 1, 4, 3], 2);
		index.insert([1, 2, 3, 4], 3);

		const actual = renderToAscii(index, {
			width: 5,
			height: 5,
			valueFormatter: (v) => String(v),
		});

		const expected = loadFixture('Progressive Overlap (numeric values)');
		assertSnapshot(actual, expected);
	});

	// ========================================================================
	// GEOMETRIC BEHAVIOR TESTS
	// ========================================================================
	// Tests visual representation of overlap resolution and fragmentation

	Deno.test(`${name} - ASCII Snapshot - Overlap Resolution`, () => {
		const index = implementation<string>();
		index.insert([1, 1, 4, 4], 'first');
		index.insert([2, 2, 3, 3], 'second');

		const actual = renderToAscii(index, {
			width: 5,
			height: 5,
			valueFormatter: (v) => String(v)[0],
		});

		const expected = loadFixture('Overlap Resolution');
		assertSnapshot(actual, expected);
	});

	Deno.test(`${name} - ASCII Snapshot - Last Writer Wins`, () => {
		const index = implementation<string>();
		index.insert([1, 1, 2, 2], 'first');
		index.insert([2, 2, 3, 3], 'second');

		const actual = renderToAscii(index, {
			width: 4,
			height: 4,
			valueFormatter: (v) => String(v)[0],
		});

		const expected = loadFixture('Last Writer Wins');
		assertSnapshot(actual, expected);
	});

	Deno.test(`${name} - ASCII Snapshot - Non-Overlapping Preservation`, () => {
		const index = implementation<string>();
		index.insert([1, 1, 2, 2], 'first');
		index.insert([5, 5, 6, 6], 'second');

		const actual = renderToAscii(index, {
			width: 8,
			height: 8,
			valueFormatter: (v) => String(v)[0],
		});

		const expected = loadFixture('Non-Overlapping Preservation');
		assertSnapshot(actual, expected);
	});

	Deno.test(`${name} - ASCII Snapshot - Fragment Generation (4-split)`, () => {
		const index = implementation<string>();
		index.insert([0, 0, 9, 9], 'base');
		index.insert([3, 3, 6, 6], 'center');

		const actual = renderToAscii(index, {
			width: 10,
			height: 10,
			valueFormatter: (v) => String(v)[0],
		});

		const expected = loadFixture('Fragment Generation (4-split)');
		assertSnapshot(actual, expected);
	});

	Deno.test(`${name} - ASCII Snapshot - L-Shaped Overlap`, () => {
		const index = implementation<string>();
		index.insert([0, 0, 9, 9], 'base');
		index.insert([5, 5, 14, 14], 'overlap');

		const actual = renderToAscii(index, {
			width: 15,
			height: 15,
			valueFormatter: (v) => String(v)[0],
		});

		const expected = loadFixture('L-Shaped Overlap');
		assertSnapshot(actual, expected);
	});

	// ========================================================================
	// BOUNDARY SEMANTICS TESTS (Half-Open Intervals)
	// ========================================================================
	// Tests half-open interval semantics and boundary precision

	Deno.test(`${name} - ASCII Snapshot - Adjacent Horizontal Ranges`, () => {
		const index = implementation<string>();
		// [0,5) and [5,10) share boundary at column 5 but don't overlap
		index.insert([0, 0, 4, 9], 'left');
		index.insert([5, 0, 9, 9], 'right');

		const actual = renderToAscii(index, {
			width: 10,
			height: 10,
			valueFormatter: (v) => String(v)[0],
		});

		const expected = loadFixture('Adjacent Horizontal Ranges');
		assertSnapshot(actual, expected);
	});

	Deno.test(`${name} - ASCII Snapshot - Adjacent Vertical Ranges`, () => {
		const index = implementation<string>();
		// [0,5) and [5,10) share boundary at row 5 but don't overlap
		index.insert([0, 0, 9, 4], 'top');
		index.insert([0, 5, 9, 9], 'bottom');

		const actual = renderToAscii(index, {
			width: 10,
			height: 10,
			valueFormatter: (v) => String(v)[0],
		});

		const expected = loadFixture('Adjacent Vertical Ranges');
		assertSnapshot(actual, expected);
	});

	Deno.test(`${name} - ASCII Snapshot - Adjacent Corner Ranges`, () => {
		const index = implementation<string>();
		// Four ranges that meet at point (5,5) but don't overlap
		index.insert([0, 0, 4, 4], 'A');
		index.insert([5, 0, 9, 4], 'B');
		index.insert([0, 5, 4, 9], 'C');
		index.insert([5, 5, 9, 9], 'D');

		const actual = renderToAscii(index, {
			width: 10,
			height: 10,
			valueFormatter: (v) => String(v),
		});

		const expected = loadFixture('Adjacent Corner Ranges');
		assertSnapshot(actual, expected);
	});

	Deno.test(`${name} - ASCII Snapshot - Global Range Override`, () => {
		const index = implementation<string>();
		// Insert some small ranges
		index.insert([1, 1, 1, 1], 'cell');
		index.insert([2, 1, 2, 1], 'adjacent');

		// Insert global range (infinite bounds) - overrides everything
		index.insert([
			Number.NEGATIVE_INFINITY,
			Number.NEGATIVE_INFINITY,
			Number.POSITIVE_INFINITY,
			Number.POSITIVE_INFINITY,
		], 'global');

		const actual = renderToAscii(index, {
			width: 5,
			height: 5,
			valueFormatter: (v) => String(v)[0].toUpperCase(),
		});

		const expected = loadFixture('Global Range Override');
		assertSnapshot(actual, expected);
	});

	Deno.test(`${name} - ASCII Snapshot - Query Boundary Precision`, () => {
		const index = implementation<string>();
		// Insert range [10,20)×[10,20) which occupies coordinates 10-19
		index.insert([10, 10, 19, 19], 'test');

		const actual = renderToAscii(index, {
			width: 14,
			height: 14,
			startCol: 8,
			startRow: 8,
			valueFormatter: (v) => String(v)[0].toUpperCase(),
		});

		const expected = loadFixture('Query Boundary Precision');
		assertSnapshot(actual, expected);
	});

	Deno.test(`${name} - ASCII Snapshot - Boundary Conditions`, () => {
		const index = implementation<string>();
		// Edge cases: point, horizontal, vertical, origin (distinct first letters)
		index.insert([5, 5, 5, 5], 'point'); // Single cell at (5,5)
		index.insert([0, 10, 99, 10], 'horizontal'); // Horizontal strip at row 10
		index.insert([6, 0, 6, 99], 'vertical'); // Vertical strip at column 6
		index.insert([0, 0, 4, 4], 'origin'); // Range starting at origin

		const actual = renderToAscii(index, {
			width: 13,
			height: 13,
			valueFormatter: (v) => String(v)[0].toUpperCase(),
		});

		const expected = loadFixture('Boundary Conditions');
		assertSnapshot(actual, expected);
	});

	Deno.test(`${name} - ASCII Snapshot - Infinite Ranges`, () => {
		const index = implementation<string>();
		// Infinite strips intersecting - demonstrates viewport clipping
		index.insert([4, 0, 6, Infinity], 'vertical'); // Columns 4-5, infinite rows
		index.insert([0, 5, Infinity, 7], 'horizontal'); // Infinite columns, rows 5-6

		const actual = renderToAscii(index, {
			width: 10,
			height: 10,
			valueFormatter: (v) => String(v)[0].toUpperCase(),
		});

		const expected = loadFixture('Infinite Ranges');
		assertSnapshot(actual, expected);
	});

	// ========================================================================
	// PARSING TESTS
	// ========================================================================
	// Tests ASCII parser functionality (fixture → data structure)

	Deno.test('ASCII Parse - Simple Grid', () => {
		const ascii = loadFixture('Simple Grid Parse');
		const parsed = parseAscii(ascii);

		assertEquals(parsed.grid, [
			['R', 'R', ' '],
			['R', 'B', 'B'],
		]);

		assertEquals(parsed.legend.get('R'), 'RED');
		assertEquals(parsed.legend.get('B'), 'BLUE');
		assertEquals(parsed.bounds, [0, 0, 2, 1]);
	});

	Deno.test('ASCII Parse - Offset Viewport', () => {
		const ascii = loadFixture('Offset Viewport Parse');
		const parsed = parseAscii(ascii);

		assertEquals(parsed.bounds, [4, 3, 6, 4]);
		assertEquals(parsed.grid[0][0], 'A');
		assertEquals(parsed.legend.get('A'), 'alpha');
	});

	Deno.test('Snapshot to Regions - Extract Rectangles', () => {
		const ascii = loadFixture('Extract Rectangles');
		const parsed = parseAscii(ascii);
		const regions = snapshotToRegions(parsed);

		// Should extract 2 rectangles
		assertEquals(regions.length, 2);

		// Find red and blue regions
		const red = regions.find((r) => r.value === 'RED');
		const blue = regions.find((r) => r.value === 'BLUE');

		assertEquals(red?.bounds, [0, 0, 1, 1]);
		assertEquals(blue?.bounds, [2, 1, 3, 1]);
	});
}
