# @jim/spandex-ascii

ASCII visualization for spatial indexes - render and parse spatial data as ASCII grids.

## Features

- **Render**: Convert spatial indexes to human-readable ASCII grids with borders, column/row labels, and legends
- **Parse**: Convert ASCII grids back to rectangles for testing and validation
- **Multi-State**: Show evolution of index through multiple insertions side-by-side
- **Unbounded Support**: Handles infinite coordinates with `∞` notation
- **Coordinate Systems**: Viewport-relative (default) or absolute positioning

## Usage

### Rendering

```typescript
import { MortonLinearScanImpl } from '@jim/spandex';
import { render } from '@jim/spandex-ascii';

const index = new MortonLinearScanImpl<string>();
index.insert([0, 0, 2, 1], 'RED');
index.insert([1, 0, 3, 1], 'BLUE');

const ascii = render(() => index.query(), {
	'R': 'RED',
	'B': 'BLUE',
	'X': 'OVERLAP',
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

- `coordinateSystem`: `'viewport'` (default) or `'absolute'` - Label rows/columns relative to data or origin
- `strict`: `false` (default) - Validate all legend symbols are used in the index
- `gridOnly`: `false` (default) - Render only the grid (no legend or infinity annotations)

```typescript
// Grid only mode (useful for progression rendering)
const grid = render(() => index.query(), legend, { gridOnly: true });
// Output has no legend or infinity annotations footer
```

### Parsing

```typescript
import { parseAscii, snapshotToRegions } from '@jim/spandex-ascii';

const ascii = `
    A   B   C
  +---+---+---+
0 | R | R | B |
  +---+---+---+

R = "RED"
B = "BLUE"
`;

const parsed = parseAscii(ascii);
const regions = snapshotToRegions(parsed);

// regions = [
//   { bounds: [0, 0, 1, 0], value: "RED" },
//   { bounds: [2, 0, 2, 0], value: "BLUE" }
// ]
```

### Progression Rendering

Show how an index evolves through cumulative operations:

```typescript
import { MortonLinearScanImpl } from '@jim/spandex';
import { renderProgression } from '@jim/spandex-ascii';

const result = renderProgression(
	() => new MortonLinearScanImpl<string>(),
	[
		{ name: 'Empty', action: () => {} },
		{ name: 'After H', action: (idx) => idx.insert([-Infinity, 1, Infinity, 1], 'HORIZONTAL') },
		{ name: 'After V', action: (idx) => idx.insert([1, -Infinity, 1, Infinity], 'VERTICAL') },
	],
	{ 'H': 'HORIZONTAL', 'V': 'VERTICAL' },
	{
		strict: false, // Validate all legend symbols are used (default: false)
		spacing: 3, // Space between grids (default: 3)
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

## Integration

This package is production-ready and used by:

- `@jim/spandex` - For adapter snapshot tests (A1, GridRange)
- `@local/spandex-testing` - For axiom visualization (geometry, visual tests)
