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

import { LazyPartitionedSpatialIndexImpl, MortonLinearScanImpl } from '@jim/spandex';
import * as rect from '@jim/spandex/rect';
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
		const index = new LazyPartitionedSpatialIndexImpl<CellProperties>(
			() => new MortonLinearScanImpl(),
		);

		assertEquals(index.isEmpty, true);
		assertEquals(Array.from(index.keys()).length, 0);
	});

	await t.step('should accept custom index factory', () => {
		let factoryCalled = 0;
		const index = new LazyPartitionedSpatialIndexImpl<CellProperties>(() => {
			factoryCalled++;
			return new MortonLinearScanImpl();
		});

		// Factory not called until first write
		assertEquals(factoryCalled, 0);

		index.set(rect.make(0, 0, 0, 0), 'background', 'red');

		// Factory called exactly once for 'background' partition
		assertEquals(factoryCalled, 1);
	});

	await t.step('should create partition on first write to attribute', () => {
		const index = new LazyPartitionedSpatialIndexImpl<CellProperties>(
			() => new MortonLinearScanImpl(),
		);

		assertEquals(Array.from(index.keys()).length, 0);

		index.set(rect.make(0, 0, 4, 4), 'background', 'red');

		assertEquals(Array.from(index.keys()).length, 1);
		assertEquals(Array.from(index.keys()).at(0), 'background');
	});

	await t.step('should create separate partitions for different attributes', () => {
		const index = new LazyPartitionedSpatialIndexImpl<CellProperties>(
			() => new MortonLinearScanImpl(),
		);

		index.set(rect.make(0, 0, 4, 4), 'background', 'red');
		index.set(rect.make(0, 0, 4, 4), 'fontColor', 'blue');
		index.set(rect.make(0, 0, 4, 4), 'fontSize', 12);

		assertEquals(Array.from(index.keys()).length, 3);
	});

	await t.step('should reuse existing partition for same attribute', () => {
		let factoryCalls = 0;
		const index = new LazyPartitionedSpatialIndexImpl<CellProperties>(() => {
			factoryCalls++;
			return new MortonLinearScanImpl();
		});

		const bounds = rect.make(0, 0, 4, 4);

		index.set(bounds, 'background', 'red');
		index.set(bounds, 'background', 'blue'); // Reuses partition

		assertEquals(factoryCalls, 1); // Only one partition created
		assertEquals(Array.from(index.keys()).length, 1);
	});

	await t.step('should apply LWW within each partition independently', () => {
		const index = new LazyPartitionedSpatialIndexImpl<CellProperties>(
			() => new MortonLinearScanImpl(),
		);

		// Insert red background for A1:C2
		index.set(rect.make(0, 1, 2, 2), 'background', 'red');

		// Overwrite with green background for B0:D2 (overlaps)
		index.set(rect.make(1, 0, 3, 2), 'background', 'green');

		// Query overlap region B1:C2
		const results = Array.from(index.query(rect.make(1, 1, 2, 2)));

		// Should have green background (LWW within background partition)
		const bgResults = results.filter(([, attributes]) => attributes.background);
		assertEquals(bgResults.length > 0, true);
		assertEquals(bgResults.at(0)![1].background, 'green');
	});

	await t.step('should not affect other partitions when writing to one', () => {
		const index = new LazyPartitionedSpatialIndexImpl<CellProperties>(
			() => new MortonLinearScanImpl(),
		);

		const bounds = rect.make(0, 0, 4, 4);

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
		const index = new LazyPartitionedSpatialIndexImpl<CellProperties>(
			() => new MortonLinearScanImpl(),
		);

		const results = Array.from(index.query(rect.make(0, 0, 9, 9)));

		assertEquals(results.length, 0);
	});

	await t.step('should return single attribute from single partition', () => {
		const index = new LazyPartitionedSpatialIndexImpl<CellProperties>(
			() => new MortonLinearScanImpl(),
		);

		index.set(rect.make(0, 0, 4, 4), 'background', 'red');

		const results = Array.from(index.query(rect.make(0, 0, 4, 4)));

		assertEquals(results.length, 1);
		assertEquals(results.at(0)![1].background, 'red');
	});

	await t.step('should merge attributes from multiple partitions at same location', () => {
		const index = new LazyPartitionedSpatialIndexImpl<CellProperties>(
			() => new MortonLinearScanImpl(),
		);

		const bounds = rect.make(0, 0, 4, 4);

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
		const index = new LazyPartitionedSpatialIndexImpl<CellProperties>(
			() => new MortonLinearScanImpl(),
		);

		// Background for A1:C2
		index.set(rect.make(0, 1, 2, 2), 'background', 'red');

		// Font color for B0:D2 (overlaps)
		index.set(rect.make(1, 0, 3, 2), 'fontColor', 'blue');

		// Query entire region
		const results = Array.from(index.query(rect.make(0, 0, 3, 2)));

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
		const index = new LazyPartitionedSpatialIndexImpl<CellProperties>(
			() => new MortonLinearScanImpl(),
		);

		// Background for top-left
		index.set(rect.make(0, 0, 4, 4), 'background', 'red');

		// Font color for bottom-right (disjoint)
		index.set(rect.make(5, 5, 9, 9), 'fontColor', 'blue');

		// Query entire region
		const results = Array.from(index.query(rect.make(0, 0, 9, 9)));

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
		const index = new LazyPartitionedSpatialIndexImpl<CellProperties>(
			() => new MortonLinearScanImpl(),
		);

		const bounds = rect.make(0, 0, 4, 4);

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
		const index = new LazyPartitionedSpatialIndexImpl<CellProperties>(
			() => new MortonLinearScanImpl(),
		);

		assertEquals(index.sizeOf('background'), 0);

		index.set(rect.make(0, 0, 4, 4), 'background', 'red');

		assertEquals(index.sizeOf('background'), 1);
	});

	await t.step('should clear all partitions', () => {
		const index = new LazyPartitionedSpatialIndexImpl<CellProperties>(
			() => new MortonLinearScanImpl(),
		);

		index.set(rect.make(0, 0, 4, 4), 'background', 'red');
		index.set(rect.make(0, 0, 4, 4), 'fontColor', 'blue');

		assertEquals(index.isEmpty, false);

		index.clear();

		assertEquals(index.isEmpty, true);
		assertEquals(Array.from(index.keys()).length, 0);
	});

	await t.step('should handle non-overlapping query range', () => {
		const index = new LazyPartitionedSpatialIndexImpl<CellProperties>(
			() => new MortonLinearScanImpl(),
		);

		index.set(rect.make(0, 0, 4, 4), 'background', 'red');

		// Query non-overlapping region [10,14] × [10,14]
		const results = Array.from(index.query(rect.make(10, 10, 14, 14)));

		assertEquals(results.length, 0);
	});

	await t.step('should handle query with no overlapping partitions', () => {
		const index = new LazyPartitionedSpatialIndexImpl<CellProperties>(
			() => new MortonLinearScanImpl(),
		);

		index.set(rect.make(0, 0, 4, 4), 'background', 'red');

		// Query disjoint region
		const results = Array.from(index.query(rect.make(10, 10, 14, 14)));

		assertEquals(results.length, 0);
	});

	// Additional edge case tests

	await t.step('should return empty array after clear', () => {
		const index = new LazyPartitionedSpatialIndexImpl<CellProperties>(
			() => new MortonLinearScanImpl(),
		);

		index.set(rect.make(0, 0, 4, 4), 'background', 'red');
		index.clear();

		const results = Array.from(index.query(rect.make(0, 0, 9, 9)));
		assertEquals(results.length, 0);
		assertEquals(index.isEmpty, true);
	});

	await t.step('should handle touching boundaries correctly', () => {
		const index = new LazyPartitionedSpatialIndexImpl<CellProperties>(
			() => new MortonLinearScanImpl(),
		);

		// Two ranges that touch at boundary [4]
		index.set(rect.make(0, 0, 4, 4), 'background', 'red');
		index.set(rect.make(5, 0, 9, 4), 'background', 'blue');

		// Query first range
		const results1 = Array.from(index.query(rect.make(0, 0, 4, 4)));
		assertEquals(results1.length, 1);
		assertEquals(results1[0][1].background, 'red');

		// Query second range
		const results2 = Array.from(index.query(rect.make(5, 0, 9, 4)));
		assertEquals(results2.length, 1);
		assertEquals(results2[0][1].background, 'blue');

		// Query spanning both (should get both separately)
		const results3 = Array.from(index.query(rect.make(0, 0, 9, 4)));
		assertEquals(results3.length, 2);
	});

	await t.step('should handle single-cell ranges', () => {
		const index = new LazyPartitionedSpatialIndexImpl<CellProperties>(
			() => new MortonLinearScanImpl(),
		);

		// Single cell at [2, 2]
		index.set(rect.make(2, 2, 2, 2), 'background', 'red');

		const results = Array.from(index.query(rect.make(0, 0, 9, 9)));
		assertEquals(results.length, 1);
		assertEquals(results[0][0], rect.make(2, 2, 2, 2));
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

		const index = new LazyPartitionedSpatialIndexImpl<ManyProps>(
			() => new MortonLinearScanImpl(),
		);

		// Write to 10 different partitions
		const bounds = rect.make(0, 0, 4, 4);
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
		assertEquals(Object.keys(results[0][1]).length, 10);
	});

	await t.step('should handle complex object values', () => {
		type ComplexProps = {
			style?: {
				color: string;
				weight: number;
				underline: boolean;
			};
		};

		const index = new LazyPartitionedSpatialIndexImpl<ComplexProps>(
			() => new MortonLinearScanImpl(),
		);

		const complexValue = {
			color: 'blue',
			weight: 700,
			underline: true,
		};

		index.set(rect.make(0, 0, 4, 4), 'style', complexValue);

		const results = Array.from(index.query(rect.make(0, 0, 4, 4)));
		assertEquals(results.length, 1);
		assertEquals(results[0][1].style, complexValue);
	});

	await t.step('should handle partial overlaps from multiple partitions', () => {
		const index = new LazyPartitionedSpatialIndexImpl<CellProperties>(
			() => new MortonLinearScanImpl(),
		);

		// Three overlapping rectangles from different partitions
		index.set(rect.make(0, 0, 6, 6), 'background', 'red'); // Large
		index.set(rect.make(2, 2, 8, 8), 'fontColor', 'blue'); // Medium, overlaps right-bottom
		index.set(rect.make(4, 4, 10, 10), 'fontSize', 12); // Small, overlaps far right-bottom

		// Query region that includes all overlaps
		const results = Array.from(index.query(rect.make(0, 0, 10, 10)));

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
		const index = new LazyPartitionedSpatialIndexImpl<CellProperties>(() => {
			return new MortonLinearScanImpl();
		});

		// Write attributes in a specific order
		index.set(rect.make(0, 0, 4, 4), 'fontSize', 12);
		index.set(rect.make(0, 0, 4, 4), 'background', 'red');
		index.set(rect.make(0, 0, 4, 4), 'fontColor', 'blue');

		assertEquals(Array.from(index.keys()).length, 3);

		// Query should merge correctly regardless of creation order
		const results = Array.from(index.query(rect.make(0, 0, 4, 4)));
		assertEquals(results.length, 1);
		assertEquals(results[0][1].fontSize, 12);
		assertEquals(results[0][1].background, 'red');
		assertEquals(results[0][1].fontColor, 'blue');
	});

	await t.step('should handle empty partition after overwrite', () => {
		const index = new LazyPartitionedSpatialIndexImpl<CellProperties>(
			() => new MortonLinearScanImpl(),
		);

		// Write then completely overwrite
		index.set(rect.make(0, 0, 4, 4), 'background', 'red');
		index.set(rect.make(0, 0, 4, 4), 'background', 'blue'); // Complete overwrite

		const results = Array.from(index.query(rect.make(0, 0, 4, 4)));
		assertEquals(results.length, 1);
		assertEquals(results[0][1].background, 'blue');
	});
});
