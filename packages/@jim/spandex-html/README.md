# @jim/spandex-html

HTML rendering backend for 2D spatial indexes. Browser visualization with colors, gradients, and interactivity.

**Part of**: `@jim/spandex` monorepo

## Installation

**Deno:**

```typescript
import { createRenderer } from 'jsr:@jim/spandex-html@0.1';
```

**Node.js:**

```bash
npx jsr add @jim/spandex-html
```

```typescript
import { createRenderer } from '@jim/spandex-html';
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

Gradients fade toward infinite edges, directional arrows (⇡⇣⇠⇢), ∞ symbols in headers, tooltips.

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

## HTML vs ASCII

**HTML**: Browser, colors, large grids, interactive.
**ASCII** (`@jim/spandex-ascii`): Terminal, CI/CD, plain text.

## Comparison: ASCII vs HTML

| Feature         | ASCII                    | HTML                   |
| --------------- | ------------------------ | ---------------------- |
| **Environment** | Terminal, logs, markdown | Browser, docs, tests   |
| **Colors**      | No                       | Yes (inline styles)    |
| **Interactive** | No                       | Yes (tooltips, events) |
| **Scalability** | Small grids (<50x50)     | Any size               |
| **Copy/paste**  | Perfect (plain text)     | Requires rendering     |
| **File size**   | Tiny                     | Larger (HTML tags)     |
| **Best for**    | CLI debugging, CI/CD     | Web debugging, docs    |

Both backends implement the same `RenderBackend` interface from `@jim/spandex/render`.

## License

MIT
