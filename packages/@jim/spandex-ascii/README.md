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
import { createRenderer } from '@jim/spandex-ascii';

const index = createMortonLinearScanIndex<string>();
index.insert([0, 0, 2, 1], 'RED');
index.insert([1, 0, 3, 1], 'BLUE');

const { render } = createRenderer();
console.log(render(index, {
	legend: { 'R': 'RED', 'B': 'BLUE' },
}));
```

**Output:**

```
    A   B   C   D
  +---+---+---+---+
0 | R | R | B | B |
  +---+---+---+---+
1 | R | R | B | B |
  +---+---+---+---+

B = "BLUE"
R = "RED"
```

**Options**:

- `includeOrigin`: `false` (default) - When true, shows absolute origin (0,0) even if outside viewport
- `strict`: `false` (default) - Validate all legend symbols are used in the index
- `gridOnly`: `false` (default) - Render only the grid (no legend or infinity annotations)

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
	createMortonLinearScanIndex<string>,
	[
		{ params: {}, action: (idx) => idx.insert([-Infinity, 1, Infinity, 1], 'H') },
		{ params: {}, action: (idx) => idx.insert([1, -Infinity, 1, Infinity], 'V') },
	],
	{ legend: { 'H': 'HORIZONTAL', 'V': 'VERTICAL' } },
);
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

## Related

- **[@jim/spandex](https://jsr.io/@jim/spandex)** - Core library (required)
- **[@jim/spandex-html](https://jsr.io/@jim/spandex-html)** - HTML rendering backend
- **[GitHub](https://github.com/jimisaacs/spandex)** - Full monorepo with research docs
