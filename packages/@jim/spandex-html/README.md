# @jim/spandex-html

[![JSR](https://jsr.io/badges/@jim/spandex-html)](https://jsr.io/@jim/spandex-html)
[![JSR Score](https://jsr.io/badges/@jim/spandex-html/score)](https://jsr.io/@jim/spandex-html/score)

HTML rendering for spatial indexes. Rich browser visualization with colors, gradients, and smart infinite edge handling.

**Requires**: [@jim/spandex](https://jsr.io/@jim/spandex) (core library)

## Install

```bash
deno add jsr:@jim/spandex jsr:@jim/spandex-html
```

## Usage

```typescript
import { createRenderer } from '@jim/spandex-html';
import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';

const index = createMortonLinearScanIndex<string>();
index.insert([0, 0, 2, 2], 'red');
index.insert([1, 1, 3, 3], 'blue');

const { render } = createRenderer<string>();
const html = render(index, {
	legend: {
		red: { label: 'R', color: '#ff0000', value: 'red' },
		blue: { label: 'B', color: '#0000ff', value: 'blue' },
	},
	showCoordinates: true,
	cellWidth: 50,
	cellHeight: 50,
});

// Output HTML
console.log(html);
```

Renders:

```html
<table class="spatial-index-grid" style="...">
  <thead>
    <tr><th></th><th>0</th><th>1</th><th>2</th><th>3</th></tr>
  </thead>
  <tbody>
    <tr><th>0</th><td style="background-color: #ff0000;">R</td>...</tr>
    <tr><th>1</th><td style="background-color: #ff0000;">R</td>...</tr>
    <tr><th>2</th><td style="background-color: #0000ff;">B</td>...</tr>
    <tr><th>3</th><td style="background-color: #0000ff;">B</td>...</tr>
  </tbody>
</table>
```

## Features

- **Inline styles** - No external CSS required
- **Customizable** - Cell size, colors, grid lines, coordinates
- **Automatic contrast** - Text color adjusts to background
- **Infinite edge visualization** - Gradients, directional arrows, and infinity symbols
- **Escape-safe** - All user data is HTML-escaped
- **Composable** - Layout multiple renders side-by-side

## Options

```typescript
interface HTMLRenderParams<T> {
	className?: string; // CSS class (default: 'spatial-index-grid')
	legend?: Record<string, { label: string; color: string; value: T }>;
	showCoordinates?: boolean; // Show axis labels (default: true)
	cellWidth?: number; // Pixels (default: 40)
	cellHeight?: number; // Pixels (default: 40)
	showGrid?: boolean; // Border lines (default: true)
	includeOrigin?: boolean; // Show absolute origin (0,0) even if outside viewport (default: false)
}
```

## Infinite Edges

Rectangles with infinite bounds get special treatment: gradients fade toward infinity, directional arrows (⇡⇣⇠⇢) show direction, ∞ symbols appear in axis headers, and tooltips explain the bounds.

## Use Cases

### Web Debugging

```typescript
// Serve via HTTP
import { serve } from 'https://deno.land/std/http/server.ts';

serve((req) => {
	const html = render(index, { legend, showCoordinates: true });
	return new Response(
		`<!DOCTYPE html><html><head><title>Spatial Index</title></head><body>${html}</body></html>`,
		{ headers: { 'content-type': 'text/html' } },
	);
});
```

### Documentation Generation

```typescript
// Generate visual examples for docs
const examples = [
	{ name: 'Sequential', index: sequentialIndex },
	{ name: 'Overlapping', index: overlappingIndex },
	{ name: 'Grid', index: gridIndex },
];

for (const { name, index } of examples) {
	const html = render(index, { legend, cellWidth: 30, cellHeight: 30 });
	await Deno.writeTextFile(`docs/examples/${name}.html`, wrapHTML(html));
}
```

### Visual Regression Testing

```typescript
import { assertEquals } from 'jsr:@std/assert';

Deno.test('renders correctly', () => {
	const html = render(index, { legend, showCoordinates: false });
	assertEquals(html, expectedHTML); // Snapshot test
});
```

## Layout API

Compose multiple renders:

```typescript
const { renderLayout } = createRenderer<string>();

const html = renderLayout(
	[
		{ source: index1, params: { legend: legend1 } },
		{ source: index2, params: { legend: legend2 } },
	],
	{
		direction: 'horizontal',
		spacing: 20,
		title: 'Before vs After',
	},
);
```

## When to Use

**Use HTML when**: Browser debugging, rich documentation, interactive demos, large grids

**Use ASCII when**: Terminal output, CI/CD logs, text-only environments

| Feature        | [@jim/spandex-ascii](https://jsr.io/@jim/spandex-ascii) | @jim/spandex-html               |
| -------------- | ------------------------------------------------------- | ------------------------------- |
| Environment    | Terminal, logs, markdown                                | Browser, docs, tests            |
| Colors         | No                                                      | Yes (inline styles)             |
| Interactive    | No                                                      | Yes (hover states)              |
| Infinite edges | Text symbols (∞, →)                                     | Gradients + directional arrows  |
| Scalability    | Small grids (<50×50)                                    | Any size                        |
| Copy/paste     | Perfect                                                 | Requires rendering              |
| Best for       | CLI debugging, CI/CD                                    | Web debugging, rich docs, demos |

Both implement the same `RenderBackend` interface.

## Related

- **[@jim/spandex](https://jsr.io/@jim/spandex)** - Core library (required)
- **[@jim/spandex-ascii](https://jsr.io/@jim/spandex-ascii)** - ASCII rendering backend
- **[GitHub](https://github.com/jimisaacs/spandex)** - Full monorepo with research docs

## License

MIT
