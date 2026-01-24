# Troubleshooting

Common issues when using @jim/spandex.

## Performance

### Query Slow

**Check `n`**:

```typescript
const n = Array.from(index.query()).length;
console.log(`Fragments: ${n}`);
```

**Fix**:

- n < 100: Morton is fine
- n ≥ 100: Switch to R*-tree

```typescript
import createRStarTreeIndex from '@jim/spandex/index/rstartree';
const index = createRStarTreeIndex<T>();
```

### Insert Slow

**Check overlap**:

```typescript
const overlapping = Array.from(index.query([0, 0, 100, 100])).length;
console.log(`Overlaps: ${overlapping}`);
```

**Fix**:

- High overlap: Use R*-tree (handles decomposition better at scale)
- Many fragments: Reset index (snapshot, recreate, reimport)

### High Memory

**Expected fragmentation**:
- **Per overlap**: ≤4 fragments created when one rectangle overlaps another
- **Cumulative worst-case**: ≤4n rectangles after n inserts (theoretical maximum, rarely reached)
- **Empirical typical**: ~2.3n rectangles (validated via adversarial patterns)

**Example**: 100 inserts typically results in 230 stored rectangles, worst-case 400.

**Fix**:

```typescript
// For sparse attributes, use partitioned index
const index = createLazyPartitionedIndex(createMortonLinearScanIndex);
// Only allocates when attribute is set
```

## Error Handling

### Invalid Rectangle Coordinates

The library validates all inserted rectangles and throws `Error` for invalid coordinates:

```typescript
index.insert([10, 0, 5, 10], 'value');
// Error: Invalid rectangle: xmin (10) > xmax (5). Coordinates must satisfy xmin ≤ xmax.

index.insert([0, 10, 10, 5], 'value');
// Error: Invalid rectangle: ymin (10) > ymax (5). Coordinates must satisfy ymin ≤ ymax.
```

**When this happens**:
- Check coordinate order: `[xmin, ymin, xmax, ymax]`
- Ensure min ≤ max for both dimensions
- Use `±Infinity` for unbounded edges (allowed)

**Other operations never throw**: Query and extent operations are non-throwing.

## Correctness

### Data Missing After Insert

**Most common**: Last-writer-wins replaced it.

```typescript
index.insert([0, 0, 10, 10], 'first');
index.insert([0, 0, 10, 10], 'second'); // Replaces 'first' completely
// Query only returns 'second'
```

**Diagnostic**:

```typescript
// Check all fragments
Array.from(index.query()).forEach(([bounds, value]) => {
	console.log(`[${bounds}] = ${value}`);
});

// Check specific region
const found = Array.from(index.query([0, 0, 10, 10]));
console.log(`In region: ${found.length} fragments`);
```

**Example output**:

```text
[[0,0,10,4]] = red
[[0,5,4,10]] = red
[[5,5,15,15]] = blue
In region: 3 fragments
```

**Fix**:

- Last-writer-wins: Expected behavior. Use different keys for `LazyPartitionedIndex` if you need both values.
- Closed intervals: `[0, 0, 4, 4]` includes (4,4). Not like array `[0, 4)`.
- Query doesn't intersect: Verify your query bounds.

### Unexpected Overlaps

**This is a bug** - library guarantees disjoint results. Report it!

**Diagnostic**:

```typescript
const results = Array.from(index.query());
for (let i = 0; i < results.length; i++) {
	for (let j = i + 1; j < results.length; j++) {
		const [a] = results[i];
		const [b] = results[j];
		const noOverlap = a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3];
		if (!noOverlap) console.error('OVERLAP:', a, b);
	}
}
```

### More Fragments Than Expected

**Expected**: Each insert can create up to 4 fragments.

```typescript
index.insert([0, 0, 10, 10], 'A'); // 1 fragment
index.insert([5, 5, 15, 15], 'B'); // Up to 4 fragments total (A splits)
```

Not a bug - this is correct. See [RECTANGLE-DECOMPOSITION-PRIMER.md](./RECTANGLE-DECOMPOSITION-PRIMER.md).

## Type Errors

### Iterator Value Undefined

```typescript
// ❌ Wrong
const [bounds, value]: [Rectangle, string] = index.query().next().value;

// ✅ Right
for (const [bounds, value] of index.query()) {
	// value has correct type
}
```

### Cannot Import Subpath

**Fix**: Update package manager (Node 16+, npm 8+) to support subpath imports.

Modern import (recommended):
```typescript
import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
```

Or use direct file path:
```typescript
import createMortonLinearScanIndex from '@jim/spandex/src/index/mortonlinearscan.ts';
```

## Integration

### Google Sheets Coordinate Mismatch

**Problem**: Google Sheets uses half-open `[start, end)`, library uses closed `[min, max]`.

**Fix**: Use GridRange adapter (handles conversion):

```typescript
import { createGridRangeAdapter } from '@jim/spandex/adapter/gridrange';

const sheet = createGridRangeAdapter(createMortonLinearScanIndex<string>());
sheet.insert({ startRowIndex: 0, endRowIndex: 5, ... }, 'value');
// Correctly converts [0, 5) → [0, 4]
```

See [coordinate-system.md](./diagrams/coordinate-system.md).

### Large Bundle Size

**Use subpath imports** (tree-shaking):

```typescript
// Instead of:
import { createMortonLinearScanIndex } from '@jim/spandex';

// Use:
import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';
```

**Bundle sizes**: Morton ~2.3KB, R*-tree ~5.9KB.

## Development

### Tests Fail After Changes

```bash
# If you changed behavior intentionally:
UPDATE_FIXTURES=1 deno test -A

# Review changes:
git diff packages/@jim/spandex/test/**/fixtures/*.md
```

### Benchmarks Don't Match Docs

**Expected**: ±10-20% variance across machines. Relative rankings should match.

**If rankings differ**: Run statistical analysis:

```bash
deno task bench:analyze 5 /tmp/results.md
```

## Common Error Messages

### `Error: Invalid rectangle: xmin (10) > xmax (5)`

**Cause**: Coordinates are out of order or swapped.

**Fix**: Ensure rectangle format is `[xmin, ymin, xmax, ymax]` with `xmin ≤ xmax` and `ymin ≤ ymax`.

```typescript
// ❌ Wrong
index.insert([10, 0, 5, 10], 'value');  // xmin > xmax

// ✅ Right
index.insert([5, 0, 10, 10], 'value');  // xmin ≤ xmax
```

### `Error: Invalid rectangle: ymin (10) > ymax (5)`

**Cause**: Y-coordinates are out of order.

**Fix**: Same as above - ensure min ≤ max for both dimensions.

```typescript
// ❌ Wrong  
index.insert([0, 10, 10, 5], 'value');  // ymin > ymax

// ✅ Right
index.insert([0, 5, 10, 10], 'value');  // ymin ≤ ymax
```

### `TypeError: Cannot read property 'insert' of undefined`

**Cause**: Forgot to call the factory function (missing parentheses).

```typescript
// ❌ Wrong
const index = createMortonLinearScanIndex;  // Missing ()

// ✅ Right
const index = createMortonLinearScanIndex<string>();
```

### `TypeError: Cannot read property 'query' of undefined`

**Cause**: Variable name collision or forgot to initialize.

**Fix**: Ensure you're calling `.query()` on an initialized index instance.

### `Error: No such export 'MortonLinearScanImpl'`

**Cause**: Trying to import the class instead of the factory function.

```typescript
// ❌ Wrong
import { MortonLinearScanImpl } from '@jim/spandex/index/mortonlinearscan';

// ✅ Right (default export is factory function)
import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';

// ✅ Also right (if you need the type)
import createMortonLinearScanIndex, { type MortonLinearScanIndex } from '@jim/spandex/index/mortonlinearscan';
```

### `Error: Cannot find module '@jim/spandex/index/mortonlinearscan'`

**Cause**: Package manager doesn't support subpath imports (old npm/node version).

**Fix**: Update to Node 16+ and npm 8+, or use direct file path:

```typescript
// Modern (recommended)
import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';

// Fallback for older tooling
import createMortonLinearScanIndex from '@jim/spandex/src/index/mortonlinearscan.ts';
```

## More Help

- **Tutorial**: [GETTING-STARTED.md](./GETTING-STARTED.md)
- **Algorithm selection**: [PRODUCTION-GUIDE.md](../PRODUCTION-GUIDE.md)
- **Coordinates**: [diagrams/coordinate-system.md](./diagrams/coordinate-system.md)
- **Examples**: [packages/@jim/spandex/test/](../packages/@jim/spandex/test/)
