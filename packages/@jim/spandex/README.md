# @jim/spandex

[![JSR](https://jsr.io/badges/@jim/spandex)](https://jsr.io/@jim/spandex)
[![JSR Score](https://jsr.io/badges/@jim/spandex/score)](https://jsr.io/@jim/spandex/score)

Fast 2D spatial indexing with last-writer-wins semantics. Insert overlapping rectangles, library decomposes into disjoint fragments (≤4 per overlap).

## Installation

**Deno:**

```bash
deno add jsr:@jim/spandex
```

```typescript
import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
```

**Node.js:**

```bash
npx jsr add @jim/spandex
```

```typescript
import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
```

## Quick Start

```typescript
import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
import { createA1Adapter } from '@jim/spandex/adapter/a1';

const index = createMortonLinearScanIndex<string>();
const adapter = createA1Adapter(index);

// Insert regions using A1 notation (spreadsheet style)
adapter.insert('A1:C3', 'red');
adapter.insert('B2:D4', 'blue'); // Overlaps! LWW: blue wins in overlap

// Query returns non-overlapping fragments (as rectangles)
for (const [bounds, value] of adapter.query()) {
	console.log(bounds, value);
}
// Output:
// [0, 0, 2, 0] 'red'   (top row of red region)
// [0, 1, 0, 2] 'red'   (left column of red region)
// [1, 1, 3, 3] 'blue'  (blue covers entire overlap)
```

## Algorithm Selection

| Rectangles  | Algorithm                     | Why                      |
| ----------- | ----------------------------- | ------------------------ |
| < 100       | `createMortonLinearScanIndex` | Fastest O(n)             |
| ≥ 100       | `createRStarTreeIndex`        | Scales O(log n)          |
| Partitioned | `createLazyPartitionedIndex`  | Independent spatial join |

```typescript
import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
import createRStarTreeIndex from '@jim/spandex/index/rstartree';
import createLazyPartitionedIndex from '@jim/spandex/index/lazypartitionedindex';

// Sparse data (< 100 rectangles)
const sparse = createMortonLinearScanIndex<string>();

// Large datasets (≥ 100 rectangles)
const large = createRStarTreeIndex<string>();

// Partitioned by attribute
const partitioned = createLazyPartitionedIndex<{ color: string; bold: boolean }>(
	createMortonLinearScanIndex,
);
```

## Core Interface

```typescript
interface SpatialIndex<T> {
	insert(bounds: Rectangle, value: T): void;
	query(bounds?: Rectangle): IterableIterator<[Rectangle, T]>;
	extent(): ExtentResult;
}

type Rectangle = readonly [xmin, ymin, xmax, ymax];
```

## Coordinate Semantics

**Closed intervals**: All endpoints inclusive. `[0, 0, 4, 4]` = `{(x,y) | 0 ≤ x ≤ 4, 0 ≤ y ≤ 4}`.

**Infinite bounds**: Use `±Infinity` for unbounded edges.

```typescript
index.insert([-Infinity, 0, Infinity, 0], 'horizontal'); // Infinite left/right
index.insert([5, -Infinity, 5, Infinity], 'vertical'); // Infinite up/down
```

## Adapters

```typescript
// Google Sheets GridRange (half-open → closed)
import { createGridRangeAdapter } from '@jim/spandex/adapter/gridrange';
createGridRangeAdapter(index).insert({ startRowIndex: 0, endRowIndex: 5, ... }, value);

// A1 notation ("A1:C3", "B:B", "5:10", "D4")
import { createA1Adapter } from '@jim/spandex/adapter/a1';
createA1Adapter(index).insert('A1:C3', value);
```

## Visualization

```typescript
// ASCII (terminal)
import { createRenderer } from '@jim/spandex-ascii';
console.log(createRenderer().render(index, { legend }));

// HTML (browser)
import { createRenderer } from '@jim/spandex-html';
const html = createRenderer().render(index, { legend, showCoordinates: true });
```

## Use Cases

| Domain       | Application                         |
| ------------ | ----------------------------------- |
| Spreadsheets | Cell properties, overlapping ranges |
| GIS          | Land parcels, zoning boundaries     |
| Games        | Collision, area-of-effect           |
| Databases    | 2D spatial queries                  |

## Performance

| n     | Algorithm | Performance                         |
| ----- | --------- | ----------------------------------- |
| < 100 | Morton    | 5-10x faster than R*-tree           |
| ≥ 100 | R*-tree   | 10-20x faster than Morton at n≈2500 |

Crossover n≈100. See [BENCHMARKS.md](https://github.com/jimisaacs/spandex/blob/main/BENCHMARKS.md) for current measurements.

## Implementation-Specific Methods

Diagnostic methods available on concrete types (not on `SpatialIndex<T>` interface):

```typescript
import createMortonLinearScanIndex, { type MortonLinearScanIndex } from '@jim/spandex/index/mortonlinearscan';
import createRStarTreeIndex, { type RStarTreeIndex } from '@jim/spandex/index/rstartree';
import createLazyPartitionedIndex, { type LazyPartitionedIndex } from '@jim/spandex/index/lazypartitionedindex';

const morton = createMortonLinearScanIndex<string>();
morton.size(); // Count of stored rectangles (O(1))

const rtree = createRStarTreeIndex<string>();
rtree.size(); // Count of stored rectangles (O(1))
rtree.getTreeQualityMetrics(); // { depth, overlapArea, deadSpace, nodeCount }

const partitioned = createLazyPartitionedIndex<{ color: string }>(createMortonLinearScanIndex);
partitioned.keys(); // Iterator of partition keys
partitioned.sizeOf('color'); // Count for specific partition
partitioned.isEmpty; // True if no partitions (getter)
partitioned.clear(); // Remove all partitions
```

## Common Patterns

```typescript
// "Deleting" regions (use Last-Writer-Wins)
index.insert([0, 0, 10, 10], null); // LWW overwrites previous values

// Resetting entire index
index = createMortonLinearScanIndex<T>(); // Create new instead of clear()
```

## Related

- **[@jim/spandex-ascii](https://jsr.io/@jim/spandex-ascii)** - ASCII visualization for terminal/logs
- **[@jim/spandex-html](https://jsr.io/@jim/spandex-html)** - HTML visualization for browser debugging
- **[Production Guide](https://github.com/jimisaacs/spandex/blob/main/PRODUCTION-GUIDE.md)** - Algorithm selection guide
- **[Benchmarks](https://github.com/jimisaacs/spandex/blob/main/BENCHMARKS.md)** - Performance data
- **[GitHub Repository](https://github.com/jimisaacs/spandex)** - Full repository

## License

MIT
