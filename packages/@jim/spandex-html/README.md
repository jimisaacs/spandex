# @jim/spandex-html

[![JSR](https://jsr.io/badges/@jim/spandex-html)](https://jsr.io/@jim/spandex-html)
[![JSR Score](https://jsr.io/badges/@jim/spandex-html/score)](https://jsr.io/@jim/spandex-html/score)

HTML rendering for spatial indexes. Rich browser visualization with colors, gradients, and smart infinite edge handling.

**Requires**: [@jim/spandex](https://jsr.io/@jim/spandex) (core library)

## Install

```bash
deno add jsr:@jim/spandex jsr:@jim/spandex-html
```

## Quick Example

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
});

document.body.innerHTML = html;
// Renders styled table with colors, gradients, and legend
```

**Options**:

- `showCoordinates`: `true` (default) - Show axis labels
- `cellWidth`/`cellHeight`: `40` (default) - Cell size in pixels
- `showGrid`: `true` (default) - Show border lines
- `gridOnly`: `false` (default) - Omit legend (grid only)
- `includeOrigin`: `false` (default) - Show absolute origin (0,0) even if outside viewport
- `strict`: `true` (default) - Validate all legend keys are used

```typescript
// Grid only mode (useful for progression rendering)
const html = render(index, { legend, gridOnly: true });
// Output has no legend
```

## Progression Rendering

Visualize how an index changes over time:

```typescript
const { renderProgression } = createRenderer<string>();

const html = renderProgression(
	createMortonLinearScanIndex<string>,
	[
		{ params: {}, action: (idx) => idx.insert([-Infinity, 1, Infinity, 1], 'horizontal') },
		{ params: {}, action: (idx) => idx.insert([1, -Infinity, 1, Infinity], 'vertical') },
	],
	{
		legend: {
			horizontal: { label: 'H', color: '#ff0000', value: 'horizontal' },
			vertical: { label: 'V', color: '#0000ff', value: 'vertical' },
		},
	},
);

document.body.innerHTML = html;
```

Great for test documentation and debugging insertion sequences.

## Layout API

Compose multiple grids side-by-side:

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

## Why HTML?

**Use when**: Browser debugging, rich documentation, interactive demos, large grids

**Trade-offs**:

- ✅ Colors and gradients
- ✅ Scales to any size
- ✅ Interactive hover states
- ❌ Requires rendering/browser
- ❌ Not copy/paste friendly

**Comparison**: For terminal output and CI/CD logs, use [@jim/spandex-ascii](https://jsr.io/@jim/spandex-ascii).

## Related

- **[@jim/spandex](https://jsr.io/@jim/spandex)** - Core library (required)
- **[@jim/spandex-ascii](https://jsr.io/@jim/spandex-ascii)** - ASCII rendering backend
- **[GitHub Repository](https://github.com/jimisaacs/spandex)** - Full repository

## License

MIT
