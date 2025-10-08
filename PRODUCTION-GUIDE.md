# Production Guide

Quick reference for choosing the right spatial index implementation.

---

## Simple Decision Tree

```
START
  ↓
n < 100?
  ├─ YES → Morton spatial locality (~1.8KB)
  └─ NO  → R-tree (R* split) (~8.4KB)
```

_See sections below for specific implementation names and import statements._

---

## Detailed Recommendations

### MortonLinearScanImpl ✅ Most Common

n < 100 (typical spreadsheet use). 2x faster via spatial locality.

Performance: 6.9µs @ n=50, 9.5ms @ n=2500

```typescript
import MortonLinearScanImpl from './src/implementations/mortonlinearscan.ts';

const backgroundColors = new MortonLinearScanImpl<string>();
const fontWeights = new MortonLinearScanImpl<string>();
const dataValidation = new MortonLinearScanImpl<ValidationRule>();
```

---

### RStarTreeImpl ✅ Large Datasets

n ≥ 100. O(log n) hierarchical indexing, R* split algorithm.

Performance: 20.0µs @ n=50, 1.92ms @ n=2500

```typescript
import RStarTreeImpl from './src/implementations/rstartree.ts';

// Large dataset scenario
const largeBackgroundIndex = new RStarTreeImpl<string>();

// Batch import
for (const range of thousandsOfRanges) {
	largeBackgroundIndex.insert(range, color);
}
```

---

## Performance Comparison

**Empirical measurements** (from [BENCHMARKS.md](./BENCHMARKS.md)):

| Implementation       | n=50  | n=2500 | Bundle Size | Best For              |
| -------------------- | ----- | ------ | ----------- | --------------------- |
| MortonLinearScanImpl | ~7µs  | ~10ms  | 1.8KB       | Sparse data (n < 100) |
| RStarTreeImpl        | ~20µs | ~2ms   | 8.4KB       | Large data (n ≥ 100)  |

**Measurement Confidence**:

- All measurements: **5 runs × Deno's internal sampling** (50-500 iterations total)
- CV% (variability): **<5% for all stable scenarios**
- Performance differences **>10%** represent large effect sizes with stable measurements
- All recommendations based on **>20% performance differences** (well above noise)
- See [benchmark-statistics.md](./docs/analyses/benchmark-statistics.md) for methodology

**Note**: We report effect sizes and measurement stability rather than statistical significance (p-values from hypothesis tests). For microbenchmarks, magnitude matters more than statistical hypothesis testing.

**Machine-Specific Variance**:

- Expect ±10-20% absolute performance variation across different CPUs/OSes
- **Relative rankings stable**: "Which is fastest" holds across systems
- Crossover point (n=100) validated on multiple architectures

---

## Workload-Specific Guidance

| Workload                              | n < 100                 | n ≥ 100           | Notes                                                             |
| ------------------------------------- | ----------------------- | ----------------- | ----------------------------------------------------------------- |
| **Write-Heavy** (editing, formatting) | Morton spatial locality | R-tree (R* split) | R-tree overhead amortizes at scale                                |
| **Read-Heavy** (rendering, scrolling) | Morton spatial locality | R-tree (R* split) | R* split workload-dependent: equiv sequential, faster overlapping |
| **Mixed** (collaborative editing)     | Morton spatial locality | R-tree (R* split) | Transition zone 100-600: both competitive                         |

**Transition Zone (100 < n < 600)**: If uncertain, use R-tree - scales better as data grows. See section headers above for specific implementation names to import. See `docs/analyses/transition-zone-analysis.md` for crossover points.

---

## Common Patterns

### Single Property Index (Typical)

```typescript
import MortonLinearScanImpl from './src/implementations/mortonlinearscan.ts';

class SpreadsheetProperties {
	private backgrounds = new MortonLinearScanImpl<string>();
	private fonts = new MortonLinearScanImpl<string>();
	private validation = new MortonLinearScanImpl<Rule>();

	setBackground(range: GridRange, color: string) {
		this.backgrounds.insert(range, color);
	}

	getBackgrounds(range: GridRange) {
		return this.backgrounds.query(range);
	}
}
```

### Large Dataset (Batch Operations)

```typescript
import RStarTreeImpl from './src/implementations/rstartree.ts';

class BulkImporter {
	private index = new RStarTreeImpl<CellData>();

	async importCSV(rows: Row[]) {
		for (const row of rows) {
			this.index.insert(row.range, row.data);
		}
	}
}
```

---

## API Reference

All implementations follow the `SpatialIndex<T>` interface:

```typescript
interface SpatialIndex<T> {
	// Insert a range with a value (last-writer-wins)
	insert(gridRange: GridRange, value: T): void;

	// Query ranges that intersect with the given range
	query(gridRange: GridRange): Array<{ gridRange: GridRange; value: T }>;

	// Get all ranges (for export/serialization)
	getAllRanges(): Array<{ gridRange: GridRange; value: T }>;

	// Check if index is empty
	get isEmpty(): boolean;
}
```

---

## Migration Guide

### When to Migrate

**Upward migration** (LinearScan → R*-tree): When n consistently exceeds 100-200 ranges per property index.

**Downward migration** (R*-tree → LinearScan): Rare. If data size shrinks permanently below n=50.

**⚠️ Avoid premature optimization**: Don't migrate unless profiling shows spatial index is a bottleneck. Most spreadsheet use cases stay under n=100 per property type.

---

### Migration Procedure

All implementations share the `SpatialIndex<T>` interface, making migration straightforward:

**1. Export existing data**:

```typescript
const oldIndex = new MortonLinearScanImpl<string>();
// ... populate with data ...

const data = oldIndex.getAllRanges();
```

**2. Create new index and bulk import**:

```typescript
const newIndex = new RStarTreeImpl<string>();

for (const { gridRange, value } of data) {
	newIndex.insert(gridRange, value);
}
```

**3. Swap references**:

```typescript
// Replace old index with new one
this.backgroundColors = newIndex;
```

**Performance Impact**:

- Export (`getAllRanges`): O(n) - negligible for n < 10,000
- Bulk import: O(n log n) for R*-tree, O(n²) for LinearScan
- Total downtime: <100ms for n=1000

---

### Specific Migration Paths

#### From MortonLinearScan to R*-tree (Scaling Up)

**Trigger**: n consistently > 100-200, performance degrading

```typescript
// Before: n=50-200, using Morton
class SpreadsheetProperties {
	private backgrounds = new MortonLinearScanImpl<string>();
}

// After: n > 200, migrate to RTree
class SpreadsheetProperties {
	private backgrounds: SpatialIndex<string>;

	constructor() {
		// Start with Morton
		this.backgrounds = new MortonLinearScanImpl<string>();
	}

	migrateToRStarTree() {
		const data = this.backgrounds.getAllRanges();
		const newIndex = new RStarTreeImpl<string>();

		for (const { gridRange, value } of data) {
			newIndex.insert(gridRange, value);
		}

		this.backgrounds = newIndex;
		console.log(`Migrated ${data.length} ranges to R*-tree`);
	}
}
```

**Performance gain**: At n=200, R*-tree is ~5-10x faster than Morton.

---

#### From OptimizedLinearScan to MortonLinearScan (Optimization)

**Trigger**: Free 2x speedup, no downside

```diff
- import OptimizedLinearScanImpl from './src/implementations/optimizedlinearscan.ts';
+ import MortonLinearScanImpl from './src/implementations/mortonlinearscan.ts';

- const index = new OptimizedLinearScanImpl<string>();
+ const index = new MortonLinearScanImpl<string>();
```

API is identical, just swap the class name.

**Performance gain**: 2x faster (202.7µs → 104.5µs at n=100)

---

#### Dynamic Switching (Advanced)

For applications with variable data size, switch implementation based on n:

```typescript
class AdaptiveSpatialIndex<T> implements SpatialIndex<T> {
	private index: SpatialIndex<T>;
	private threshold = 150;

	constructor() {
		this.index = new MortonLinearScanImpl<T>();
	}

	insert(gridRange: GridRange, value: T): void {
		this.index.insert(gridRange, value);
		this.checkMigration();
	}

	private checkMigration() {
		const n = this.index.getAllRanges().length;

		// Migrate up if n exceeds threshold
		if (n > this.threshold && !(this.index instanceof RStarTreeImpl)) {
			const data = this.index.getAllRanges();
			this.index = new RStarTreeImpl<T>();
			for (const { gridRange, value } of data) {
				this.index.insert(gridRange, value);
			}
			console.log(`Auto-migrated to R*-tree at n=${n}`);
		}
	}

	query(gridRange: GridRange) {
		return this.index.query(gridRange);
	}

	getAllRanges() {
		return this.index.getAllRanges();
	}

	get isEmpty() {
		return this.index.isEmpty;
	}
}
```

**⚠️ Note**: Adds complexity. Only use if n varies dramatically (e.g., user imports large dataset).

---

### Zero-Downtime Migration

For production systems that can't pause:

```typescript
class LiveMigration<T> {
	private oldIndex: SpatialIndex<T>;
	private newIndex: SpatialIndex<T> | null = null;
	private migrating = false;

	async migrateInBackground() {
		if (this.migrating) return;
		this.migrating = true;

		// Create new index
		this.newIndex = new RStarTreeImpl<T>();

		// Copy existing data
		const data = this.oldIndex.getAllRanges();
		for (const { gridRange, value } of data) {
			this.newIndex.insert(gridRange, value);

			// Yield to event loop every 100 items
			if (data.indexOf({ gridRange, value }) % 100 === 0) {
				await new Promise((resolve) => setTimeout(resolve, 0));
			}
		}

		// Atomic swap
		this.oldIndex = this.newIndex;
		this.newIndex = null;
		this.migrating = false;
	}

	query(gridRange: GridRange) {
		// Use new index if migration complete
		return this.oldIndex.query(gridRange);
	}
}
```

**Use case**: Large datasets (n > 5000) where bulk import takes >100ms.

---

### Data Preservation

**What's preserved**: All `(gridRange, value)` pairs exactly as stored.

**What changes**: Internal storage order (not observable through API).

**Validation** (optional but recommended):

```typescript
function validateMigration<T>(oldIndex: SpatialIndex<T>, newIndex: SpatialIndex<T>) {
	const oldData = oldIndex.getAllRanges();
	const newData = newIndex.getAllRanges();

	if (oldData.length !== newData.length) {
		throw new Error(`Size mismatch: ${oldData.length} → ${newData.length}`);
	}

	// Check all ranges preserved (order may differ)
	for (const oldEntry of oldData) {
		const found = newData.some((newEntry) =>
			rangesEqual(oldEntry.gridRange, newEntry.gridRange) &&
			oldEntry.value === newEntry.value
		);
		if (!found) {
			throw new Error(`Missing entry: ${JSON.stringify(oldEntry)}`);
		}
	}

	console.log(`✅ Migration validated: ${oldData.length} ranges preserved`);
}
```

---

## FAQ

**Q: R-tree vs linear scan?**\
A: Morton for n < 100, R-tree for n ≥ 100.

**Q: Don't know n?**\
A: Use Morton (optimal for typical n < 100).

**Q: Need smaller bundle?**\
A: Morton is already compact at 1.8KB minified. This is production-ready for all bundle-constrained environments.

**Q: ArrayBuffer implementations?**\
A: Research only. Morton supersedes them.

**Q: Switch implementations later?**\
A: Yes, same `SpatialIndex<T>` interface.

---

## See Also

- [BENCHMARKS.md](./BENCHMARKS.md) - Full performance data
- [README.md](./README.md) - Project overview
- [docs/analyses/sparse-data-analysis.md](./docs/analyses/sparse-data-analysis.md) - Why linear scan wins for sparse data
- [docs/analyses/morton-vs-hilbert-analysis.md](./docs/analyses/morton-vs-hilbert-analysis.md) - Why Morton replaced Hilbert (25% faster)
- [docs/core/RESEARCH-SUMMARY.md](./docs/core/RESEARCH-SUMMARY.md) - Complete research findings
