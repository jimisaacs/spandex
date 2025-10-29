/** HTML render tests - backend-specific features */

import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
import { assertEquals, assertStringIncludes, assertThrows } from '@std/assert';
import { createRenderer } from '../src/mod.ts';

Deno.test('HTML renderer - custom cell size', () => {
	const index = createMortonLinearScanIndex<string>();
	index.insert([0, 0, 0, 0], 'test');

	const { render } = createRenderer();
	const html = render(index, {
		legend: { test: { label: 'T', color: '#00ff00', value: 'test' } },
		cellWidth: 100,
		cellHeight: 50,
	});

	assertStringIncludes(html, 'width: 100px');
	assertStringIncludes(html, 'height: 50px');
});

Deno.test('HTML renderer - no coordinates', () => {
	const index = createMortonLinearScanIndex<string>();
	index.insert([0, 0, 0, 0], 'test');

	const { render } = createRenderer();
	const html = render(index, {
		legend: { test: { label: 'T', color: '#00ff00', value: 'test' } },
		showCoordinates: false,
	});

	assertEquals(html.includes('<thead>'), false);
});

Deno.test('HTML renderer - layout horizontal', () => {
	const index1 = createMortonLinearScanIndex<string>();
	index1.insert([0, 0, 0, 0], 'red');

	const index2 = createMortonLinearScanIndex<string>();
	index2.insert([0, 0, 0, 0], 'blue');

	const { renderLayout } = createRenderer();
	const html = renderLayout(
		[
			{ source: index1, params: { legend: { red: { label: 'R', color: '#ff0000', value: 'red' } } } },
			{ source: index2, params: { legend: { blue: { label: 'B', color: '#0000ff', value: 'blue' } } } },
		],
		{ direction: 'horizontal', spacing: 20, title: 'Test Layout' },
	);

	assertStringIncludes(html, '<h3');
	assertStringIncludes(html, 'Test Layout');
	assertStringIncludes(html, 'display: flex');
	assertStringIncludes(html, 'gap: 20px');

	const tableCount = (html.match(/<table/g) || []).length;
	assertEquals(tableCount, 2);
});

Deno.test('HTML renderer - HTML escaping', () => {
	const index = createMortonLinearScanIndex<string>();
	index.insert([0, 0, 0, 0], '<script>alert("xss")</script>');

	const { render } = createRenderer();
	const html = render(index, {
		legend: { xss: { label: '<b>test</b>', color: '#ff0000', value: '<script>alert("xss")</script>' } },
		strict: false, // Allow unused legend key
	});

	assertStringIncludes(html, '&lt;b&gt;test&lt;/b&gt;');
	assertEquals(html.includes('<script>'), false);
});

Deno.test('HTML renderer - Legend validation: Unused keys allowed by default', () => {
	const { render } = createRenderer();

	const index = createMortonLinearScanIndex<string>();
	index.insert([0, 0, 1, 0], 'red');

	// Should NOT throw (unused legend keys allowed by default)
	const result = render(index, {
		legend: {
			red: { label: 'R', color: '#ff0000', value: 'red' },
			blue: { label: 'B', color: '#0000ff', value: 'blue' }, // Unused but allowed
		},
		strict: false,
	});

	assertStringIncludes(result, 'R');
});

Deno.test('HTML renderer - Legend validation: Missing key throws', () => {
	const { render } = createRenderer();

	const index = createMortonLinearScanIndex<string>();
	index.insert([0, 0, 1, 0], 'red');
	index.insert([2, 0, 2, 0], 'blue');

	assertThrows(
		() => {
			render(index, { legend: { red: { label: 'R', color: '#ff0000', value: 'red' } } });
		},
		Error,
		'Missing legend entry for value "blue"',
	);
});

Deno.test('HTML renderer - Strict mode: Unused keys throw', () => {
	const { render } = createRenderer();

	const index = createMortonLinearScanIndex<string>();
	index.insert([0, 0, 1, 0], 'red');

	assertThrows(
		() => {
			render(index, {
				legend: {
					red: { label: 'R', color: '#ff0000', value: 'red' },
					blue: { label: 'B', color: '#0000ff', value: 'blue' }, // Unused
				},
				strict: true,
			});
		},
		Error,
		'unused legend key',
	);
});

Deno.test('HTML renderer - Strict mode: All used passes', () => {
	const { render } = createRenderer();

	const index = createMortonLinearScanIndex<string>();
	index.insert([0, 0, 1, 0], 'red');
	index.insert([2, 0, 2, 0], 'blue');

	// Should not throw
	const result = render(index, {
		legend: {
			red: { label: 'R', color: '#ff0000', value: 'red' },
			blue: { label: 'B', color: '#0000ff', value: 'blue' },
		},
		strict: true,
	});

	assertStringIncludes(result, 'R');
	assertStringIncludes(result, 'B');
});
