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
import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
import { createA1Adapter } from '@jim/spandex/adapter/a1';
import { createRenderer } from '@jim/spandex-html';

const index = createMortonLinearScanIndex<string>();
const adapter = createA1Adapter(index);

adapter.insert('A1:C3', 'red');
adapter.insert('B2:D4', 'blue');

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

// Output HTML with styled table, gradients, and legend
document.body.innerHTML = html;
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
	gridOnly?: boolean; // Omit legend (default: false)
	includeOrigin?: boolean; // Show absolute origin (0,0) even if outside viewport (default: false)
}
```

## Infinite Edges

Rectangles with infinite bounds get special treatment: gradients fade toward infinity, directional arrows (⇡⇣⇠⇢) show direction, ∞ symbols appear in axis headers, and tooltips explain the bounds.

## Use Cases

**Browser debugging** - Rich visualization with colors and interactive hover states

**Documentation** - Generate visual examples for markdown, HTML docs, or static sites

**Regression testing** - Snapshot test HTML output for visual consistency

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
- **[GitHub Repository](https://github.com/jimisaacs/spandex)** - Full repository

## License

MIT
