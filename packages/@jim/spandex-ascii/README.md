# @jim/spandex-ascii

[![JSR](https://jsr.io/badges/@jim/spandex-ascii)](https://jsr.io/@jim/spandex-ascii)
[![JSR Score](https://jsr.io/badges/@jim/spandex-ascii/score)](https://jsr.io/@jim/spandex-ascii/score)

ASCII rendering for spatial indexes. Visualize in terminals, logs, or anywhere text works.

**Requires**: [@jim/spandex](https://jsr.io/@jim/spandex) (core library)

## Install

```bash
deno add jsr:@jim/spandex jsr:@jim/spandex-ascii
```

## Quick Example

```typescript
import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
import { createA1Adapter } from '@jim/spandex/adapter/a1';
import { createRenderer } from '@jim/spandex-ascii';

const index = createMortonLinearScanIndex<'red' | 'blue'>();
const adapter = createA1Adapter(index);

adapter.insert('A1:C3', 'red');
adapter.insert('B2:D4', 'blue');

const { render } = createRenderer();
console.log(render(adapter, {
	legend: { R: 'red', B: 'blue' },
}));
```

**Output:**

```
    A   B   C   D
  ┏━━━┳━━━┳━━━┓   ·
1 ┃ R ┃ R ┃ R ┃
  ┣━━━╋━━━╋━━━╋━━━┓
2 ┃ R ┃ B ┃ B ┃ B ┃
  ┣━━━╋━━━╋━━━╋━━━┫
3 ┃ R ┃ B ┃ B ┃ B ┃
  ┗━━━╋━━━╋━━━╋━━━┫
4     ┃ B ┃ B ┃ B ┃
  ·   ┗━━━┻━━━┻━━━┛

B = "blue"
R = "red"
```

**Options**:

- `gridOnly`: `false` (default) - Render only the grid (no legend or infinity annotations)
- `includeOrigin`: `false` (default) - When true, shows absolute origin (0,0) even if outside viewport
- `strict`: `true` (default) - Validate all legend symbols are used in the index

```typescript
// Grid only mode (useful for progression rendering)
const grid = render(index, { legend, gridOnly: true });
// Output has no legend or infinity annotations footer
```

## Parsing

Round-trip support for testing or data import:

```typescript
import { parse } from '@jim/spandex-ascii';

const grid = `
    A   B   C
  ┏━━━┳━━━┳━━━┓
0 ┃ R ┃ R ┃ B ┃
  ┗━━━┻━━━┻━━━┛

R = "RED"
B = "BLUE"
`;

const result = parse<string>(grid);
// result.grids[0].results = [[[0, 0, 1, 0], "RED"], [[2, 0, 2, 0], "BLUE"]]
// result.legend = { 'R': 'RED', 'B': 'BLUE' }
```

## Progression Rendering

Visualize how an index changes over time:

```typescript
const { renderProgression } = createRenderer();

const output = renderProgression(
	createMortonLinearScanIndex<'horizontal' | 'vertical'>,
	[
		{ params: {}, action: (idx) => idx.insert([-Infinity, 1, Infinity, 1], 'horizontal') },
		{ params: {}, action: (idx) => idx.insert([1, -Infinity, 1, Infinity], 'vertical') },
	],
	{ legend: { H: 'horizontal', V: 'vertical' } },
);

console.log(output);
```

Great for test documentation and debugging insertion sequences.

## Why ASCII?

**Use when**: Logging, CI/CD output, terminal debugging, text-only docs

**Trade-offs**:

- ✅ Works everywhere (no dependencies)
- ✅ Copy/paste friendly
- ❌ No colors or interactivity
- ❌ Large grids get unwieldy

**Comparison**: For browser debugging with colors and large grids, use [@jim/spandex-html](https://jsr.io/@jim/spandex-html).

## Layout API

Compose multiple grids side-by-side:

```typescript
const { renderLayout } = createRenderer();

const output = renderLayout(
	[
		{ source: index1, params: { legend: legend1 } },
		{ source: index2, params: { legend: legend2 } },
	],
	{
		spacing: 5, // Characters between grids
	},
);
```

## Related

- **[@jim/spandex](https://jsr.io/@jim/spandex)** - Core library (required)
- **[@jim/spandex-html](https://jsr.io/@jim/spandex-html)** - HTML rendering backend
- **[GitHub Repository](https://github.com/jimisaacs/spandex)** - Full repository

## License

MIT
