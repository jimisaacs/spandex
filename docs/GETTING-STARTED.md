# Getting Started

@jim/spandex: Non-overlapping rectangles with last-writer-wins semantics.

**Use cases**: Spreadsheet formatting, GIS overlays, game collision, spatial databases.

## Installation

```bash
deno add jsr:@jim/spandex      # Deno
npx jsr add @jim/spandex       # Node.js
```

## Basic Usage

```typescript
import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';

const index = createMortonLinearScanIndex<string>();

// Closed intervals: [min, max] includes both endpoints
index.insert([0, 0, 10, 10], 'red'); // Includes point (10,10)
index.insert([5, 5, 15, 15], 'blue'); // Overlaps - blue wins

// Query all
for (const [bounds, value] of index.query()) {
	console.log(bounds, value);
}
```

**Output**:

```text
[0,0,10,4] red     (red top fragment)
[0,5,4,10] red     (red left fragment)  
[5,5,15,15] blue   (blue wins overlap)
```

**Algorithm selection**:

| Ranges | Use                           |
| ------ | ----------------------------- |
| <100   | `createMortonLinearScanIndex` |
| ≥100   | `createRStarTreeIndex`        |

See [PRODUCTION-GUIDE.md](../PRODUCTION-GUIDE.md) for details.

## Understanding Fragments

When you insert overlapping rectangles with last-writer-wins semantics, the library must split the old rectangle to preserve the **non-overlapping invariant** (no two rectangles can overlap):

**Example decomposition:**

```text
Before: Rectangle A [0,0,10,10] with value 'red'
Insert: Rectangle B [5,5,15,15] with value 'blue'

After (3 fragments):
  A-top    [0,0,10,4]   ← 'red' (old value preserved)
  A-left   [0,5,4,10]   ← 'red' (old value preserved)
  B        [5,5,15,15]  ← 'blue' (new value wins the overlap)
```

**Key insights:**

- Each overlap creates **at most 4 fragments** from the old rectangle (top, bottom, left, right)
- The new rectangle is stored intact
- This is why we say "≤4 fragments per overlap"

**Performance implications:**

- **Memory**: 100 inserts with typical overlap → ~230 stored rectangles (empirical average ~2.3x)
- **Queries**: More fragments = more items to scan/traverse
- **High overlap**: Use partitioned indexes when attributes change independently to avoid unnecessary fragmentation

**When to worry about fragments:**

- ✅ **Don't worry** for <100 ranges with typical overlap
- ⚠️ **Consider partitioning** if you have independent attributes updating at different times
- ⚠️ **Monitor** if fragment count grows >10x your insert count (query the index to check)

See [RECTANGLE-DECOMPOSITION-PRIMER.md](./RECTANGLE-DECOMPOSITION-PRIMER.md) for the three decomposition strategies.

## Common Patterns

### Spreadsheet Cells (A1 Notation)

```typescript
import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
import { createA1Adapter } from '@jim/spandex/adapter/a1';

const index = createMortonLinearScanIndex<string>();
const sheet = createA1Adapter(index);

sheet.insert('A1:C3', 'red');
sheet.insert('B2:D4', 'blue');

for (const [range, color] of sheet.query()) {
	console.log(`${range}: ${color}`);
}
```

**Output**:

```text
A1:C1 red
A2:A3 red
B2:D4 blue
```

### Multiple Attributes (Partitioned)

When you have multiple independent attributes (like cell backgrounds and fonts that change separately), you can use a **partitioned index**. This maintains a separate spatial index per attribute and combines them at query time, avoiding unnecessary fragmentation when only one attribute changes.

**Why use partitioned?** If you update background colors separately from font sizes, a standard index would create new fragments for every background change even if fonts don't change. Partitioning keeps each attribute's index separate until you query.

```typescript
import createLazyPartitionedIndex from '@jim/spandex/index/lazypartitionedindex';
import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
import { createA1Adapter } from '@jim/spandex/adapter/a1';

type CellProps = {
	background?: string;
	fontSize?: number;
};

const index = createLazyPartitionedIndex<CellProps>(createMortonLinearScanIndex);
const sheet = createA1Adapter(index);

sheet.set('A1:C3', 'background', 'red');
sheet.set('B2:D4', 'fontSize', 14);

for (const [range, attrs] of sheet.query()) {
	console.log(`${range}:`, attrs);
}
```

**Output**:

```text
A1:C1 { background: 'red' }
A2:A3 { background: 'red' }
B2:D4 { background: 'red', fontSize: 14 }
```

### GIS / Spatial Regions

```typescript
import createRStarTreeIndex from '@jim/spandex/index/rstartree';

interface Region {
	landuse: string;
	population: number;
}

const index = createRStarTreeIndex<Region>();

index.insert([0, 0, 1000, 1000], { landuse: 'residential', population: 5000 });
index.insert([500, 500, 1500, 1500], { landuse: 'commercial', population: 2000 });

// Query viewport
for (const [bounds, data] of index.query([400, 400, 1200, 1200])) {
	console.log(`${bounds}: ${data.landuse}`);
}
```

### Game Entities

```typescript
import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';

interface Entity {
	id: string;
	type: 'player' | 'enemy' | 'item';
}

const entities = createMortonLinearScanIndex<Entity>();

entities.insert([100, 100, 120, 150], { id: 'player1', type: 'player' });
entities.insert([200, 100, 220, 120], { id: 'enemy1', type: 'enemy' });

// Check collisions
for (const [bounds, entity] of entities.query([110, 110, 250, 130])) {
	if (entity.type === 'enemy') console.log(`Hit: ${entity.id}`);
}
```

**Output**:

```text
Hit: enemy1
```

## Visualization

```typescript
import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
import { createA1Adapter } from '@jim/spandex/adapter/a1';
import { createRenderer } from '@jim/spandex-ascii';

const index = createMortonLinearScanIndex<string>();
const adapter = createA1Adapter(index);

adapter.insert('A1:C3', 'red');
adapter.insert('B2:D4', 'blue');

const { render } = createRenderer();
console.log(render(adapter, { legend: { R: 'red', B: 'blue' } }));
```

Output will show the grid decomposition (exact format may vary by renderer version). See "Basic Usage" above for example output.

## Common Gotchas

### Closed Intervals (Not Half-Open)

The library uses **closed intervals** where both endpoints are **included**:

```text
[0, 0, 4, 4] means:
  x: 0, 1, 2, 3, 4  (all 5 values included)
  y: 0, 1, 2, 3, 4  (all 5 values included)
```

**Why closed?** Simpler geometric operations - no `+1/-1` adjustments when checking intersections or computing decompositions.

**Important differences from common APIs:**

- **Array slicing**: `arr.slice(0, 5)` → indices 0-4 (half-open `[0, 5)`, excludes 5)
- **Spandex**: `[0, 0, 4, 4]` → coordinates 0-4 (closed `[0, 4]`, includes 4)

**Common gotcha**: A 5×5 grid of cells is `[0, 0, 4, 4]` not `[0, 0, 5, 5]` (which would be 6×6).

**For spreadsheets**: Use the A1 or GridRange adapters - they handle conversions automatically:

```typescript
import { createA1Adapter } from '@jim/spandex/adapter/a1';
const sheet = createA1Adapter(index);
sheet.insert('A1:E5', 'value'); // Handles conversion for you
```

### Last-Writer-Wins

Overlapping inserts replace old data. New value completely overwrites old in overlap region.

### Algorithm Selection

Start with Morton (<100 ranges), switch to R*-tree when you grow (≥100 ranges).

## Advanced

For common patterns (deleting, resetting, switching implementations, diagnostics), see [PRODUCTION-GUIDE.md](../PRODUCTION-GUIDE.md#common-patterns).

## Next Steps

- **Performance matters?** [PRODUCTION-GUIDE.md](../PRODUCTION-GUIDE.md)
- **Hit an issue?** [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- **Full API?** [packages/@jim/spandex/README.md](../packages/@jim/spandex/README.md)
- **Curious?** [BENCHMARKS.md](../BENCHMARKS.md)
