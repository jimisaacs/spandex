/**
 * LazyPartitionedSpatialIndexImpl - Geometry Snapshot Tests
 *
 * Visual validation of spatial join correctness via ASCII rendering.
 * Uses existing ASCII infrastructure with custom valueFormatter for merged attributes.
 */

import { createRenderer } from '@jim/spandex-ascii';
import createLazyPartitionedIndex from '@jim/spandex/index/lazypartitionedindex';
import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
import * as r from '@jim/spandex/r';
import { asciiStringCodec, createFixtureGroup } from '@local/snapmark';
import { validateRoundTrip } from '@local/spandex-testing/round-trip';
import { assertEquals } from '@std/assert';

Deno.test('LazyPartitionedSpatialIndexImpl - Geometry', async (t) => {
	const { render } = createRenderer();

	const { assertMatch, flush } = createFixtureGroup(asciiStringCodec(), {
		context: t,
		filePath: new URL('./fixtures/geometry-test.md', import.meta.url),
	});

	await t.step('Empty index', async (context) => {
		const index = createLazyPartitionedIndex<Record<string, string>>(
			createMortonLinearScanIndex,
		);

		const rendered = render(index, { legend: {} });
		await assertMatch(rendered, { context, name: 'empty' });
	});

	await t.step('Single partition - simple rectangle', async (context) => {
		const index = createLazyPartitionedIndex<Record<string, string>>(
			createMortonLinearScanIndex,
		);

		index.set([0, 0, 4, 4], 'background', 'red');

		const legend = { R: { background: 'red' } };
		const rendered = render(index, { legend });
		await assertMatch(rendered, { context, name: 'single-partition-simple' });
		validateRoundTrip(rendered, 1, { legend });
	});

	await t.step('Two partitions - same bounds', async (context) => {
		const index = createLazyPartitionedIndex<Record<string, string>>(
			createMortonLinearScanIndex,
		);

		index.set([0, 0, 4, 4], 'background', 'red');
		index.set([0, 0, 4, 4], 'fontColor', 'blue');

		const legend = { '@': { background: 'red', fontColor: 'blue' } };
		const rendered = render(index, { legend });
		await assertMatch(rendered, { context, name: 'two-partitions-same-bounds' });
		validateRoundTrip(rendered, 1, { legend });
	});

	await t.step('Two partitions - partial overlap', async (context) => {
		const index = createLazyPartitionedIndex<Record<string, string>>(
			createMortonLinearScanIndex,
		);

		// Background: top-left 5x5
		index.set([0, 0, 4, 4], 'background', 'red');
		// FontColor: bottom-right 5x5 (overlaps [2,2] to [4,4])
		index.set([2, 2, 6, 6], 'fontColor', 'blue');

		const legend = {
			'R': { background: 'red' },
			'B': { fontColor: 'blue' },
			'@': { background: 'red', fontColor: 'blue' },
		};
		const rendered = render(index, { legend });
		await assertMatch(rendered, { context, name: 'two-partitions-partial-overlap' });
		validateRoundTrip(rendered, 1, { legend });
	});

	await t.step('Two partitions - disjoint', async (context) => {
		const index = createLazyPartitionedIndex<Record<string, string>>(
			createMortonLinearScanIndex,
		);

		index.set([0, 0, 3, 3], 'background', 'red');
		index.set([5, 5, 8, 8], 'fontColor', 'blue');

		const legend = {
			'R': { background: 'red' },
			'B': { fontColor: 'blue' },
		};
		const rendered = render(index, { legend });
		await assertMatch(rendered, { context, name: 'two-partitions-disjoint' });
		validateRoundTrip(rendered, 1, { legend });
	});

	await t.step('Three partitions - complex overlap', async (context) => {
		const index = createLazyPartitionedIndex<Record<string, string>>(
			createMortonLinearScanIndex,
		);

		// Three overlapping rectangles
		index.set([0, 0, 6, 6], 'background', 'red'); // Large
		index.set([2, 2, 8, 8], 'fontColor', 'blue'); // Medium
		index.set([4, 4, 9, 9], 'fontSize', '12'); // Small

		const legend = {
			'R': { background: 'red' },
			'B': { fontColor: 'blue' },
			'#': { fontSize: '12' },
			'▒': { background: 'red', fontColor: 'blue' },
			'▓': { fontColor: 'blue', fontSize: '12' },
			'█': { background: 'red', fontColor: 'blue', fontSize: '12' },
		};
		const rendered = render(index, { legend });
		await assertMatch(rendered, { context, name: 'three-partitions-complex' });
		validateRoundTrip(rendered, 1, { legend });
	});

	await t.step('Four partitions - checkerboard pattern', async (context) => {
		const index = createLazyPartitionedIndex<Record<string, string>>(
			createMortonLinearScanIndex,
		);

		// Create checkerboard effect with 4 attributes
		index.set([0, 0, 4, 4], 'background', 'red');
		index.set([0, 0, 2, 2], 'fontColor', 'blue'); // Top-left quadrant
		index.set([3, 3, 4, 4], 'fontSize', '12'); // Bottom-right quadrant
		index.set([2, 0, 2, 4], 'borders', 'all'); // Vertical stripe

		const rendered = render(index, {
			legend: {
				'R': { background: 'red' },
				'░': { background: 'red', fontColor: 'blue' },
				'▓': { background: 'red', fontSize: '12' },
				'║': { background: 'red', borders: 'all' },
				'█': { background: 'red', fontColor: 'blue', borders: 'all' },
			},
		});
		await assertMatch(rendered, { context, name: 'four-partitions-checkerboard' });
	});

	await t.step('Spatial join - touching boundaries', async (context) => {
		const index = createLazyPartitionedIndex<Record<string, string>>(
			createMortonLinearScanIndex,
		);

		// Two rectangles that touch at x=4 boundary
		index.set([0, 0, 4, 4], 'background', 'red');
		index.set([5, 0, 9, 4], 'fontColor', 'blue');

		const rendered = render(index, {
			legend: {
				'R': { background: 'red' },
				'B': { fontColor: 'blue' },
			},
		});
		await assertMatch(rendered, { context, name: 'touching-boundaries' });

		// Verify they're separate (no merged region)
		const merged = Array.from(index.query([0, 0, 9, 9]))
			.filter(([, attrs]) => attrs['background'] && attrs['fontColor']);
		assertEquals(merged.length, 0, 'Touching boundaries should not merge');
	});

	await t.step('Fragment count validation - LWW decomposition', () => {
		const index = createLazyPartitionedIndex<Record<string, string>>(
			createMortonLinearScanIndex,
		);

		// LWW test with exact fragment validation
		index.set([0, 0, 5, 5], 'background', 'red');
		index.set([3, 3, 8, 8], 'background', 'green');

		const results = Array.from(index.query([0, 0, 9, 9]));

		// Underlying MortonLinearScan creates 7 fragments after LWW
		// Spatial join should preserve all 7 (same attribute key)
		assertEquals(results.length, 7, 'Expected 7 fragments from LWW decomposition');

		// Verify LWW correctness: each cell has only one background value
		for (const [, attrs] of results) {
			assertEquals(Object.keys(attrs).filter((k) => k === 'background').length, 1);
		}

		// Verify bounds are as expected
		const bounds = results.map(([r]) => r);
		const expected = [
			[0, 0, 2, 2],
			[3, 0, 5, 2],
			[0, 3, 2, 5],
			[3, 3, 5, 5],
			[6, 3, 8, 5],
			[3, 6, 5, 8],
			[6, 6, 8, 8],
		];

		assertEquals(bounds.length, expected.length);
		for (const exp of expected) {
			const found = bounds.find((b) => b[0] === exp[0] && b[1] === exp[1] && b[2] === exp[2] && b[3] === exp[3]);
			assertEquals(!!found, true, `Expected fragment [${exp}] not found`);
		}
	});

	await t.step('Complete coverage validation - overlapping partitions', async (context) => {
		const index = createLazyPartitionedIndex<Record<string, string>>(
			createMortonLinearScanIndex,
		);

		// Two overlapping 3x3 squares
		index.set([0, 0, 2, 2], 'background', 'red');
		index.set([1, 1, 3, 3], 'fontColor', 'blue');

		const rendered = render(index, {
			legend: {
				'R': { background: 'red' },
				'B': { fontColor: 'blue' },
				'@': { background: 'red', fontColor: 'blue' },
			},
		});
		await assertMatch(rendered, { context, name: 'complete-coverage' });

		const results = Array.from(index.query([0, 0, 3, 3]));

		// Build coverage map
		const coverage: Record<string, Set<string>> = {};
		for (const [[xmin, ymin, xmax, ymax], attrs] of results) {
			for (let y = ymin; y <= ymax; y++) {
				for (let x = xmin; x <= xmax; x++) {
					const key = `${x},${y}`;
					if (!coverage[key]) coverage[key] = new Set();
					for (const attr of Object.keys(attrs)) {
						coverage[key].add(attr);
					}
				}
			}
		}

		// Verify complete coverage of 4x4 grid
		for (let y = 0; y <= 3; y++) {
			for (let x = 0; x <= 3; x++) {
				const key = `${x},${y}`;
				const attrs = coverage[key] || new Set();

				// Check expected attributes per cell
				if (x <= 2 && y <= 2) {
					assertEquals(attrs.has('background'), true, `Cell ${key} should have background`);
				}
				if (x >= 1 && y >= 1 && x <= 3 && y <= 3) {
					assertEquals(attrs.has('fontColor'), true, `Cell ${key} should have fontColor`);
				}

				// Overlap region [1,1] to [2,2] should have both
				if (x >= 1 && y >= 1 && x <= 2 && y <= 2) {
					assertEquals(attrs.size, 2, `Cell ${key} should have exactly 2 attributes`);
				}
			}
		}
	});

	await t.step('Many partitions - attribute accumulation', async (context) => {
		const index = createLazyPartitionedIndex<Record<string, string>>(
			createMortonLinearScanIndex,
		);

		// Concentric squares adding attributes
		index.set([0, 0, 9, 9], 'background', 'white');
		index.set([1, 1, 8, 8], 'fontColor', 'black');
		index.set([2, 2, 7, 7], 'fontSize', '12');
		index.set([3, 3, 6, 6], 'fontWeight', 'bold');
		index.set([4, 4, 5, 5], 'textAlign', 'center');

		const legend = {
			'.': { background: 'white' },
			':': { background: 'white', fontColor: 'black' },
			'░': { background: 'white', fontColor: 'black', fontSize: '12' },
			'▒': { background: 'white', fontColor: 'black', fontSize: '12', fontWeight: 'bold' },
			'█': { background: 'white', fontColor: 'black', fontSize: '12', fontWeight: 'bold', textAlign: 'center' },
		} as const;
		const rendered = render(index, { legend });
		await assertMatch(rendered, { context, name: 'many-partitions-concentric' });

		const results = Array.from(index.query([0, 0, 9, 9]));

		// Center [4,4] to [5,5] should have all 5 attributes
		const centerResults = results.filter(([bounds]) => {
			const [xmin, ymin, xmax, ymax] = bounds;
			return xmin >= 4 && ymin >= 4 && xmax <= 5 && ymax <= 5;
		});

		// Should have at least one fragment in center with all attributes
		const fullAttrs = centerResults.find(([, attrs]) => Object.keys(attrs).length === 5);
		assertEquals(!!fullAttrs, true, 'Center should have fragment with all 5 attributes');
	});

	await t.step('Sparse partitions - scattered attributes', async (context) => {
		const index = createLazyPartitionedIndex<Record<string, string>>(
			createMortonLinearScanIndex,
		);

		// Four corners with different attributes
		index.set([0, 0, 2, 2], 'background', 'red'); // Top-left
		index.set([7, 0, 9, 2], 'fontColor', 'blue'); // Top-right
		index.set([0, 7, 2, 9], 'fontSize', '12'); // Bottom-left
		index.set([7, 7, 9, 9], 'borders', 'all'); // Bottom-right

		const legend = {
			'R': { background: 'red' },
			'B': { fontColor: 'blue' },
			'#': { fontSize: '12' },
			'□': { borders: 'all' },
		} as const;
		const rendered = render(index, { legend });
		await assertMatch(rendered, { context, name: 'sparse-partitions-corners' });

		const results = Array.from(index.query([0, 0, 9, 9]));

		// Should have exactly 4 regions (no overlaps, no merges)
		assertEquals(results.length, 4, 'Expected exactly 4 non-overlapping regions');

		// Each should have exactly 1 attribute
		for (const [, attrs] of results) {
			assertEquals(Object.keys(attrs).length, 1, 'Each corner should have exactly 1 attribute');
		}
	});

	await t.step('Real-world - progressive cell styling', async (context) => {
		const index = createLazyPartitionedIndex<Record<string, string>>(
			createMortonLinearScanIndex,
		);

		// Simulate progressive styling of a spreadsheet region
		// 1. Set background for entire range
		index.set([0, 0, 4, 4], 'background', '#FFFFFF');

		// 2. Apply header row formatting
		index.set([0, 0, 4, 0], 'fontWeight', 'bold');
		index.set([0, 0, 4, 0], 'fontSize', '14');

		// 3. Apply border to specific cell
		index.set([2, 2, 2, 2], 'borders', 'all');

		// 4. Highlight column
		index.set([1, 0, 1, 4], 'background', '#FFFFCC');

		const legend = {
			'·': { background: '#FFFFFF' },
			'▓': { background: '#FFFFCC' },
			'H': { background: '#FFFFFF', fontSize: '14', fontWeight: 'bold' },
			'■': { background: '#FFFFCC', fontSize: '14', fontWeight: 'bold' },
			'□': { background: '#FFFFFF', borders: 'all' },
		} as const;
		const rendered = render(index, { legend });
		await assertMatch(rendered, { context, name: 'real-world-cell-styling' });

		const results = Array.from(index.query([0, 0, 4, 4]));

		// Cell [1,0] should have: background (overwritten), fontWeight, fontSize
		const headerHighlight = results.find(([bounds]) =>
			bounds[0] === 1 && bounds[1] === 0 && bounds[2] === 1 && bounds[3] === 0
		);
		assertEquals(!!headerHighlight, true, 'Header highlight cell should exist');
		if (headerHighlight) {
			const attrs = headerHighlight[1];
			assertEquals(attrs['background'], '#FFFFCC', 'Background should be overwritten');
			assertEquals(attrs['fontWeight'], 'bold', 'Should have bold from header');
			assertEquals(attrs['fontSize'], '14', 'Should have fontSize from header');
		}

		// Cell [2,2] should have: background, borders
		const borderedCell = results.find(([bounds]) =>
			bounds[0] === 2 && bounds[1] === 2 && bounds[2] === 2 && bounds[3] === 2
		);
		assertEquals(!!borderedCell, true, 'Bordered cell should exist');
		if (borderedCell) {
			assertEquals(borderedCell[1]['borders'], 'all');
			assertEquals(borderedCell[1]['background'], '#FFFFFF');
		}
	});

	await t.step('Query bounds filtering', () => {
		const index = createLazyPartitionedIndex<Record<string, string>>(
			createMortonLinearScanIndex,
		);

		// Large region
		index.set([0, 0, 9, 9], 'background', 'white');
		index.set([2, 2, 7, 7], 'fontColor', 'black');

		// Query only top-left quadrant
		const quadrantResults = Array.from(index.query([0, 0, 4, 4]));

		// Should not include regions entirely outside query bounds
		for (const [[xmin, ymin, xmax, ymax]] of quadrantResults) {
			// At least some overlap with [0,0,4,4]
			const overlaps = !(xmin > 4 || ymin > 4 || xmax < 0 || ymax < 0);
			assertEquals(overlaps, true, `Fragment [${xmin},${ymin},${xmax},${ymax}] should overlap query`);
		}

		// Verify we have both attributes in overlap region
		const overlapRegion = quadrantResults.filter(([bounds, attrs]) =>
			bounds[0] >= 2 && bounds[1] >= 2 && attrs['background'] && attrs['fontColor']
		);
		assertEquals(overlapRegion.length > 0, true, 'Should have overlap region with both attributes');
	});

	await t.step('🇺🇸 American flag (for fun!)', async (context) => {
		const index = createLazyPartitionedIndex<Record<string, string>>(
			createMortonLinearScanIndex,
		);

		// Insert in order to get good symbol assignment:
		// 1. Blue canton (should get #)
		// 2. Red stripes (should get =)
		// 3. White stripes (should get -)
		// 4. Blue+red overlap (should get *)

		// Blue canton (union) - top-left corner
		index.set([0, 0, 3, 4], 'blue', '#3C3B6E');

		// Red stripes (full width for rows 0, 2, 4, 6, 8)
		index.set([0, 0, 9, 0], 'red', '#B22234');
		index.set([0, 2, 9, 2], 'red', '#B22234');
		index.set([0, 4, 9, 4], 'red', '#B22234');
		index.set([0, 6, 9, 6], 'red', '#B22234');
		index.set([0, 8, 9, 8], 'red', '#B22234');

		// White stripes (full width for rows 1, 3, 5, 7, 9)
		index.set([0, 1, 9, 1], 'white', '#FFFFFF');
		index.set([0, 3, 9, 3], 'white', '#FFFFFF');
		index.set([0, 5, 9, 5], 'white', '#FFFFFF');
		index.set([0, 7, 9, 7], 'white', '#FFFFFF');
		index.set([0, 9, 9, 9], 'white', '#FFFFFF');

		const legend = {
			'=': { red: '#B22234' },
			'-': { white: '#FFFFFF' },
			'*': { blue: '#3C3B6E', red: '#B22234' },
			'+': { blue: '#3C3B6E', white: '#FFFFFF' },
		} as const;
		const rendered = render(index, { legend });
		await assertMatch(rendered, { context, name: 'american-flag' });

		// Verify canton has blue
		const cantonResults = Array.from(index.query([0, 0, 3, 4]));
		const hasBlue = cantonResults.some(([, attrs]) => attrs['blue']);
		assertEquals(hasBlue, true, 'Canton should have blue field');

		// Verify stripes exist outside canton
		const stripesResults = Array.from(index.query([4, 0, 9, 9]));
		const hasRedAndWhite = stripesResults.some(([, attrs]) => attrs['red']) &&
			stripesResults.some(([, attrs]) => attrs['white']);
		assertEquals(hasRedAndWhite, true, 'Should have red and white stripes');
	});

	await t.step('😊 Smiley face (for fun!) - ASCII art', async (context) => {
		const index = createLazyPartitionedIndex<Record<string, string>>(
			createMortonLinearScanIndex,
		);

		// Face background
		index.set([0, 0, 9, 9], 'face', 'yellow');

		// Left eye
		index.set([2, 2, 3, 3], 'leftEye', 'blue');

		// Right eye
		index.set([6, 2, 7, 3], 'rightEye', 'blue');

		// Smile - curved at bottom
		index.set([2, 7, 7, 7], 'smile', 'red'); // Top of smile
		index.set([1, 8, 1, 8], 'smile', 'red'); // Left corner
		index.set([8, 8, 8, 8], 'smile', 'red'); // Right corner

		// Rosy cheeks
		index.set([0, 4, 1, 5], 'leftCheek', 'pink');
		index.set([8, 4, 9, 5], 'rightCheek', 'pink');

		const legend = {
			'o': { face: 'yellow' },
			'[': { face: 'yellow', leftEye: 'blue' },
			']': { face: 'yellow', rightEye: 'blue' },
			'U': { face: 'yellow', smile: 'red' },
			'(': { face: 'yellow', leftCheek: 'pink' },
			')': { face: 'yellow', rightCheek: 'pink' },
		};
		const rendered = render(index, { legend });
		await assertMatch(rendered, { context, name: 'smiley-face' });

		// Verify face has all parts
		const faceResults = Array.from(index.query([0, 0, 9, 9]));
		const hasFace = faceResults.some(([, attrs]) => attrs['face']);
		const hasEyes = faceResults.some(([, attrs]) => attrs['leftEye']) &&
			faceResults.some(([, attrs]) => attrs['rightEye']);
		const hasSmile = faceResults.some(([, attrs]) => attrs['smile']);
		const hasCheeks = faceResults.some(([, attrs]) => attrs['leftCheek']) &&
			faceResults.some(([, attrs]) => attrs['rightCheek']);

		assertEquals(hasFace, true, 'Should have face background');
		assertEquals(hasEyes, true, 'Should have both eyes');
		assertEquals(hasSmile, true, 'Should have smile');
		assertEquals(hasCheeks, true, 'Should have rosy cheeks');
	});

	await t.step('Infinite rectangles - finite extent auto-detection', async (context) => {
		const index = createLazyPartitionedIndex<Record<string, string>>(
			createMortonLinearScanIndex,
		);

		// Finite rectangle
		index.set([1, 1, 3, 3], 'background', 'red');
		// Infinite rectangle (extends beyond viewport)
		index.set([0, 0, r.posInf, r.posInf], 'fontColor', 'blue');

		const rendered = render(index, {
			legend: {
				'B': { fontColor: 'blue' },
				'@': { background: 'red', fontColor: 'blue' },
			},
		});

		await assertMatch(rendered, { context, name: 'infinite-finite-extent' });

		// Verify grid auto-sized to finite extent (not infinite)
		const lines = rendered.split('\n');
		const gridWidth = lines[0]?.match(/[A-Z]/g)?.length || 0;
		assertEquals(gridWidth < 10, true, 'Grid should be smaller than default (10) due to finite extent');
		// With extent merging: viewport captures union of finite and partial-infinity extents
		// Finite: [1,3], Infinite: [0,∞] → Merged: [0,3] = A B C D (4 columns)
		assertEquals(gridWidth, 4, 'Grid shows merged extent [0,3] (4 columns)');
	});

	await flush();
});
