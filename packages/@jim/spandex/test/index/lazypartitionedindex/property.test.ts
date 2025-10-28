/**
 * Tests for LazyPartitionedSpatialIndexImpl
 *
 * Validates:
 * - Interface compliance with PartitionedSpatialIndex
 * - Type safety (compile-time only)
 * - Lazy partition instantiation (created on first write)
 * - Independent partition behavior (LWW within each)
 * - Spatial join correctness
 * - Edge cases (empty, overlaps, disjoint regions)
 */

import createLazyPartitionedIndex from '@jim/spandex/index/lazypartitionedindex';
import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
import * as r from '@jim/spandex/r';
import { assertEquals, assertExists } from '@std/assert';

// Test type definition
type CellProperties = {
	background?: string;
	fontColor?: string;
	fontSize?: number;
	borders?: { top: boolean; bottom: boolean };
};

Deno.test('LazyPartitionedSpatialIndexImpl', async (t) => {
	await t.step('should create empty index with no partitions', () => {
		const index = createLazyPartitionedIndex<CellProperties>(
			createMortonLinearScanIndex,
		);

		assertEquals(index.isEmpty, true);
		assertEquals(Array.from(index.keys()).length, 0);
	});

	await t.step('should accept custom index factory', () => {
		let factoryCalled = 0;
		const index = createLazyPartitionedIndex<CellProperties>(() => {
			factoryCalled++;
			return createMortonLinearScanIndex();
		});

		// Factory not called until first write
		assertEquals(factoryCalled, 0);

		index.set(r.make(0, 0, 0, 0), 'background', 'red');

		// Factory called exactly once for 'background' partition
		assertEquals(factoryCalled, 1);
	});

	await t.step('should create partition on first write to attribute', () => {
		const index = createLazyPartitionedIndex<CellProperties>(
			createMortonLinearScanIndex,
		);

		assertEquals(Array.from(index.keys()).length, 0);

		index.set(r.make(0, 0, 4, 4), 'background', 'red');

		assertEquals(Array.from(index.keys()).length, 1);
		assertEquals(Array.from(index.keys()).at(0), 'background');
	});

	await t.step('should create separate partitions for different attributes', () => {
		const index = createLazyPartitionedIndex<CellProperties>(
			createMortonLinearScanIndex,
		);

		index.set(r.make(0, 0, 4, 4), 'background', 'red');
		index.set(r.make(0, 0, 4, 4), 'fontColor', 'blue');
		index.set(r.make(0, 0, 4, 4), 'fontSize', 12);

		assertEquals(Array.from(index.keys()).length, 3);
	});

	await t.step('should reuse existing partition for same attribute', () => {
		let factoryCalls = 0;
		const index = createLazyPartitionedIndex<CellProperties>(() => {
			factoryCalls++;
			return createMortonLinearScanIndex();
		});

		const bounds = r.make(0, 0, 4, 4);

		index.set(bounds, 'background', 'red');
		index.set(bounds, 'background', 'blue'); // Reuses partition

		assertEquals(factoryCalls, 1); // Only one partition created
		assertEquals(Array.from(index.keys()).length, 1);
	});

	await t.step('should apply LWW within each partition independently', () => {
		const index = createLazyPartitionedIndex<CellProperties>(
			createMortonLinearScanIndex,
		);

		// Insert red background for A1:C2
		index.set(r.make(0, 1, 2, 2), 'background', 'red');

		// Overwrite with green background for B0:D2 (overlaps)
		index.set(r.make(1, 0, 3, 2), 'background', 'green');

		// Query overlap region B1:C2
		const results = Array.from(index.query(r.make(1, 1, 2, 2)));

		// Should have green background (LWW within background partition)
		const bgResults = results.filter(([, attributes]) => attributes.background);
		assertEquals(bgResults.length > 0, true);
		assertEquals(bgResults.at(0)![1].background, 'green');
	});

	await t.step('should not affect other partitions when writing to one', () => {
		const index = createLazyPartitionedIndex<CellProperties>(
			createMortonLinearScanIndex,
		);

		const bounds = r.make(0, 0, 4, 4);

		// Set background
		index.set(bounds, 'background', 'red');

		// Set fontColor (should not affect background)
		index.set(bounds, 'fontColor', 'blue');

		const results = Array.from(index.query(bounds));

		// Both attributes should be present
		assertEquals(results.length > 0, true);
		const merged = results.at(0)![1];
		assertEquals(merged.background, 'red');
		assertEquals(merged.fontColor, 'blue');
	});

	await t.step('should return empty array for empty index', () => {
		const index = createLazyPartitionedIndex<CellProperties>(
			createMortonLinearScanIndex,
		);

		const results = Array.from(index.query(r.make(0, 0, 9, 9)));

		assertEquals(results.length, 0);
	});

	await t.step('should return single attribute from single partition', () => {
		const index = createLazyPartitionedIndex<CellProperties>(
			createMortonLinearScanIndex,
		);

		index.set(r.make(0, 0, 4, 4), 'background', 'red');

		const results = Array.from(index.query(r.make(0, 0, 4, 4)));

		assertEquals(results.length, 1);
		assertEquals(results.at(0)![1].background, 'red');
	});

	await t.step('should merge attributes from multiple partitions at same location', () => {
		const index = createLazyPartitionedIndex<CellProperties>(
			createMortonLinearScanIndex,
		);

		const bounds = r.make(0, 0, 4, 4);

		index.set(bounds, 'background', 'red');
		index.set(bounds, 'fontColor', 'blue');
		index.set(bounds, 'fontSize', 12);

		const results = Array.from(index.query(bounds));

		assertEquals(results.length, 1);
		const attrs = results.at(0)![1];
		assertEquals(attrs.background, 'red');
		assertEquals(attrs.fontColor, 'blue');
		assertEquals(attrs.fontSize, 12);
	});

	await t.step('should handle overlapping ranges from different partitions', () => {
		const index = createLazyPartitionedIndex<CellProperties>(
			createMortonLinearScanIndex,
		);

		// Background for A1:C2
		index.set(r.make(0, 1, 2, 2), 'background', 'red');

		// Font color for B0:D2 (overlaps)
		index.set(r.make(1, 0, 3, 2), 'fontColor', 'blue');

		// Query entire region
		const results = Array.from(index.query(r.make(0, 0, 3, 2)));

		// Should have results with:
		// - Only background (A1:A2)
		// - Only font color (B0:D0)
		// - Both background and font color (B1:C2)
		// - Only font color (D1:D2)

		// At least one region should have both attributes
		const bothAttrs = results.filter(([, attributes]) => attributes.background && attributes.fontColor);
		assertEquals(bothAttrs.length > 0, true);

		// At least one region should have only background
		const onlyBg = results.filter(([, attributes]) => attributes.background && !attributes.fontColor);
		assertEquals(onlyBg.length > 0, true);

		// At least one region should have only font color
		const onlyFont = results.filter(([, attributes]) => !attributes.background && attributes.fontColor);
		assertEquals(onlyFont.length > 0, true);
	});

	await t.step('should handle disjoint ranges from different partitions', () => {
		const index = createLazyPartitionedIndex<CellProperties>(
			createMortonLinearScanIndex,
		);

		// Background for top-left
		index.set(r.make(0, 0, 4, 4), 'background', 'red');

		// Font color for bottom-right (disjoint)
		index.set(r.make(5, 5, 9, 9), 'fontColor', 'blue');

		// Query entire region
		const results = Array.from(index.query(r.make(0, 0, 9, 9)));

		// Should have two separate regions
		assertEquals(results.length, 2);

		// One with only background
		const bgRegion = results.find(([, attributes]) => attributes.background);
		assertExists(bgRegion);
		assertEquals(bgRegion[1].fontColor, undefined);

		// One with only font color
		const fontRegion = results.find(([, attributes]) => attributes.fontColor);
		assertExists(fontRegion);
		assertEquals(fontRegion[1].background, undefined);
	});

	await t.step('type safety compile-time check', () => {
		const index = createLazyPartitionedIndex<CellProperties>(
			createMortonLinearScanIndex,
		);

		const bounds = r.make(0, 0, 4, 4);

		// These should compile (correct types)
		index.set(bounds, 'background', 'red'); // string
		index.set(bounds, 'fontSize', 12); // number
		index.set(bounds, 'borders', { top: true, bottom: false }); // object

		// Query results are also type-safe
		const results = Array.from(index.query(bounds));
		const attrs = results[0]?.[1];

		// TypeScript knows these types:
		const _bg: string | undefined = attrs?.background;
		const _fontSize: number | undefined = attrs?.fontSize;
		const _borders: { top: boolean; bottom: boolean } | undefined = attrs?.borders;

		assertEquals(true, true); // Test passes (compile-time check)
	});

	await t.step('should track partition size', () => {
		const index = createLazyPartitionedIndex<CellProperties>(
			createMortonLinearScanIndex,
		);

		assertEquals(index.sizeOf('background'), 0);

		index.set(r.make(0, 0, 4, 4), 'background', 'red');

		assertEquals(index.sizeOf('background'), 1);
	});

	await t.step('should clear all partitions', () => {
		const index = createLazyPartitionedIndex<CellProperties>(
			createMortonLinearScanIndex,
		);

		index.set(r.make(0, 0, 4, 4), 'background', 'red');
		index.set(r.make(0, 0, 4, 4), 'fontColor', 'blue');

		assertEquals(index.isEmpty, false);

		index.clear();

		assertEquals(index.isEmpty, true);
		assertEquals(Array.from(index.keys()).length, 0);
	});

	await t.step('should handle non-overlapping query range', () => {
		const index = createLazyPartitionedIndex<CellProperties>(
			createMortonLinearScanIndex,
		);

		index.set(r.make(0, 0, 4, 4), 'background', 'red');

		// Query non-overlapping region [10,14] × [10,14]
		const results = Array.from(index.query(r.make(10, 10, 14, 14)));

		assertEquals(results.length, 0);
	});

	await t.step('should handle query with no overlapping partitions', () => {
		const index = createLazyPartitionedIndex<CellProperties>(
			createMortonLinearScanIndex,
		);

		index.set(r.make(0, 0, 4, 4), 'background', 'red');

		// Query disjoint region
		const results = Array.from(index.query(r.make(10, 10, 14, 14)));

		assertEquals(results.length, 0);
	});

	// Additional edge case tests

	await t.step('should return empty array after clear', () => {
		const index = createLazyPartitionedIndex<CellProperties>(
			createMortonLinearScanIndex,
		);

		index.set(r.make(0, 0, 4, 4), 'background', 'red');
		index.clear();

		const results = Array.from(index.query(r.make(0, 0, 9, 9)));
		assertEquals(results.length, 0);
		assertEquals(index.isEmpty, true);
	});

	await t.step('should handle touching boundaries correctly', () => {
		const index = createLazyPartitionedIndex<CellProperties>(
			createMortonLinearScanIndex,
		);

		// Two ranges that touch at boundary [4]
		index.set(r.make(0, 0, 4, 4), 'background', 'red');
		index.set(r.make(5, 0, 9, 4), 'background', 'blue');

		// Query first range
		const results1 = Array.from(index.query(r.make(0, 0, 4, 4)));
		assertEquals(results1.length, 1);
		assertEquals(results1[0]![1].background, 'red');

		// Query second range
		const results2 = Array.from(index.query(r.make(5, 0, 9, 4)));
		assertEquals(results2.length, 1);
		assertEquals(results2[0]![1].background, 'blue');

		// Query spanning both (should get both separately)
		const results3 = Array.from(index.query(r.make(0, 0, 9, 4)));
		assertEquals(results3.length, 2);
	});

	await t.step('should handle single-cell ranges', () => {
		const index = createLazyPartitionedIndex<CellProperties>(
			createMortonLinearScanIndex,
		);

		// Single cell at [2, 2]
		index.set(r.make(2, 2, 2, 2), 'background', 'red');

		const results = Array.from(index.query(r.make(0, 0, 9, 9)));
		assertEquals(results.length, 1);
		assertEquals(results[0]![0], r.make(2, 2, 2, 2));
	});

	await t.step('should handle many partitions', () => {
		type ManyProps = {
			p1?: string;
			p2?: string;
			p3?: string;
			p4?: string;
			p5?: string;
			p6?: string;
			p7?: string;
			p8?: string;
			p9?: string;
			p10?: string;
		};

		const index = createLazyPartitionedIndex<ManyProps>(
			createMortonLinearScanIndex,
		);

		// Write to 10 different partitions
		const bounds = r.make(0, 0, 4, 4);
		index.set(bounds, 'p1', 'v1');
		index.set(bounds, 'p2', 'v2');
		index.set(bounds, 'p3', 'v3');
		index.set(bounds, 'p4', 'v4');
		index.set(bounds, 'p5', 'v5');
		index.set(bounds, 'p6', 'v6');
		index.set(bounds, 'p7', 'v7');
		index.set(bounds, 'p8', 'v8');
		index.set(bounds, 'p9', 'v9');
		index.set(bounds, 'p10', 'v10');

		assertEquals(Array.from(index.keys()).length, 10);

		const results = Array.from(index.query(bounds));
		assertEquals(results.length, 1);
		assertEquals(Object.keys(results[0]![1]).length, 10);
	});

	await t.step('should handle complex object values', () => {
		type ComplexProps = {
			style?: {
				color: string;
				weight: number;
				underline: boolean;
			};
		};

		const index = createLazyPartitionedIndex<ComplexProps>(
			createMortonLinearScanIndex,
		);

		const complexValue = {
			color: 'blue',
			weight: 700,
			underline: true,
		};

		index.set(r.make(0, 0, 4, 4), 'style', complexValue);

		const results = Array.from(index.query(r.make(0, 0, 4, 4)));
		assertEquals(results.length, 1);
		assertEquals(results[0]![1].style, complexValue);
	});

	await t.step('should handle partial overlaps from multiple partitions', () => {
		const index = createLazyPartitionedIndex<CellProperties>(
			createMortonLinearScanIndex,
		);

		// Three overlapping rectangles from different partitions
		index.set(r.make(0, 0, 6, 6), 'background', 'red'); // Large
		index.set(r.make(2, 2, 8, 8), 'fontColor', 'blue'); // Medium, overlaps right-bottom
		index.set(r.make(4, 4, 10, 10), 'fontSize', 12); // Small, overlaps far right-bottom

		// Query region that includes all overlaps
		const results = Array.from(index.query(r.make(0, 0, 10, 10)));

		// Should have regions with different combinations of attributes
		const withAll3 = results.filter(([, attributes]) =>
			attributes.background && attributes.fontColor && attributes.fontSize
		);
		assertEquals(withAll3.length > 0, true);

		const withBgOnly = results.filter(([, attributes]) =>
			attributes.background && !attributes.fontColor && !attributes.fontSize
		);
		assertEquals(withBgOnly.length > 0, true);

		const withFontSizeOnly = results.filter(([, attributes]) =>
			!attributes.background && !attributes.fontColor && attributes.fontSize
		);
		assertEquals(withFontSizeOnly.length > 0, true);
	});

	await t.step('lazy instantiation should work regardless of access order', () => {
		const index = createLazyPartitionedIndex<CellProperties>(() => {
			return createMortonLinearScanIndex();
		});

		// Write attributes in a specific order
		index.set(r.make(0, 0, 4, 4), 'fontSize', 12);
		index.set(r.make(0, 0, 4, 4), 'background', 'red');
		index.set(r.make(0, 0, 4, 4), 'fontColor', 'blue');

		assertEquals(Array.from(index.keys()).length, 3);

		// Query should merge correctly regardless of creation order
		const results = Array.from(index.query(r.make(0, 0, 4, 4)));
		assertEquals(results.length, 1);
		assertEquals(results[0]![1].fontSize, 12);
		assertEquals(results[0]![1].background, 'red');
		assertEquals(results[0]![1].fontColor, 'blue');
	});

	await t.step('should handle empty partition after overwrite', () => {
		const index = createLazyPartitionedIndex<CellProperties>(
			createMortonLinearScanIndex,
		);

		// Write then completely overwrite
		index.set(r.make(0, 0, 4, 4), 'background', 'red');
		index.set(r.make(0, 0, 4, 4), 'background', 'blue'); // Complete overwrite

		const results = Array.from(index.query(r.make(0, 0, 4, 4)));
		assertEquals(results.length, 1);
		assertEquals(results[0]![1].background, 'blue');
	});
});
