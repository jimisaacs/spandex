# @jim/spandex-ascii

ASCII rendering backend for 2D spatial indexes. Terminal/log visualization with round-trip parsing.

**Part of**: `@jim/spandex` monorepo

## Usage

### Rendering

```typescript
import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
import { createRenderer } from '@jim/spandex-ascii';

const index = createMortonLinearScanIndex<string>();
index.insert([0, 0, 2, 1], 'RED');
index.insert([1, 0, 3, 1], 'BLUE');

const { render } = createRenderer();
const ascii = render(index, {
	legend: {
		'R': 'RED',
		'B': 'BLUE',
		'X': 'OVERLAP',
	},
});

console.log(ascii);
// Output:
//     A   B   C   D
//   +---+---+---+---+
// 0 | R | X | B | B |
//   +---+---+---+---+
// 1 | R | X | B | B |
//   +---+---+---+---+
//
// B = "BLUE"
// R = "RED"
// X = "OVERLAP"
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

### Parsing

```typescript
import { parse } from '@jim/spandex-ascii';

const ascii = `
    A   B   C
  ┏━━━┳━━━┳━━━┓
0 ┃ R ┃ R ┃ B ┃
  ┗━━━┻━━━┻━━━┛

R = "RED"
B = "BLUE"
`;

const result = parse<string>(ascii);

// result.grids[0].results = [
//   [[0, 0, 1, 0], "RED"],
//   [[2, 0, 2, 0], "BLUE"]
// ]
// result.legend = { 'R': 'RED', 'B': 'BLUE' }
```

### Progression Rendering

Show how an index evolves through cumulative operations:

```typescript
import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
import { createRenderer } from '@jim/spandex-ascii';

const { renderProgression } = createRenderer();
const result = renderProgression(
	createMortonLinearScanIndex<string>,
	[
		{ name: 'Empty', action: () => {} },
		{ name: 'After H', action: (idx) => idx.insert([-Infinity, 1, Infinity, 1], 'HORIZONTAL') },
		{ name: 'After V', action: (idx) => idx.insert([1, -Infinity, 1, Infinity], 'VERTICAL') },
	],
	{
		legend: { 'H': 'HORIZONTAL', 'V': 'VERTICAL' },
		spacing: 3,
	},
);

console.log(result);
// Output:
//  Empty        After H               After V
//
//     A         ∞   A   ∞         ∞   A   B   C   ∞
//   +---+      ---+---+---    ∞     |   | V |   |
// 0 |   |   1   H | H | H        ---+---+---+---+---
//   +---+      ---+---+---    1   H | H | V | H | H
//                                ---+---+---+---+---
//                             ∞     |   | V |   |
//
// H = "HORIZONTAL"
// V = "VERTICAL"
```

## Testing

The package includes test utilities for validating rendering and parsing behavior:

```bash
deno test packages/@jim/spandex-ascii/
```

Manual verification scripts in `test/test-*.ts` can be run directly:

```bash
deno run packages/@jim/spandex-ascii/test/test-unbounded-cross.ts
```

## Architecture

- **render.ts**: Three-phase rendering pipeline (analyze → build grid → format)
- **parse.ts**: ASCII grid parser with legend support
- **Internal utilities**: Column letter conversion, coordinate mapping

## Why ASCII?

**Best for**: Terminal output, CI/CD logs, command-line debugging, text-based documentation.

**Comparison to HTML**:

- ✅ Copy/paste friendly (plain text)
- ✅ Tiny file size
- ✅ Works anywhere (terminal, logs, markdown)
- ❌ No colors or interactive features
- ❌ Limited to small grids

**Use HTML backend** (`@jim/spandex-html`) for:

- Browser-based debugging
- Rich documentation with colors
- Interactive visualizations
- Large grids

Works with any `SpatialIndex<T>`. Used by spandex tests, axioms, and research docs.
