# Design Decision: Rectangle Decomposition

**Finding**: Rectangle decomposition with LWW semantics is the optimal approach for spreadsheet property storage.

## Result

**Chosen Algorithm**: Maintain non-overlapping rectangles via geometric set difference (A \ B → ≤4 fragments)

| Approach            | Match to Problem | Complexity | Status                |
| ------------------- | ---------------- | ---------- | --------------------- |
| Rectangle decomp    | Perfect          | Simple     | ✅ Chosen             |
| Quadtree            | Poor             | Complex    | ❌ Doesn't fit API    |
| Interval tree       | Poor             | Complex    | ❌ Point queries      |
| Sparse 2D array     | Poor             | Memory     | ❌ Space inefficient  |
| Vector-based (SIMD) | N/A              | N/A        | ❌ Not GAS-compatible |

**Impact**: Validated core algorithm choice; alternatives don't fit spreadsheet API pattern.

**Why rectangle decomposition works**:

- Directly produces `GridRange[]` output (API requirement)
- LWW semantics via overlap resolution (business logic)
- Efficient for both sparse and dense data (with appropriate storage)

**Storage strategies** (see [sparse-data-analysis.md](./sparse-data-analysis.md)):

- **Linear scan** (O(n)): Optimal for sparse data (n < 100)
- **R-tree** (O(log n)): Optimal for large data (n > 1000)

**See also**: [theoretical-foundation.md](../core/theoretical-foundation.md)

---

## ❌ Alternatives Considered (And Why They Didn't Work)

### 1. Quadtree / Region Quadtree

**Concept**: Recursively subdivide 2D space into quadrants

```
┌─────┬─────┐
│  A  │  B  │
├─────┼─────┤
│  C  │  D  │
└─────┴─────┘
```

**Pros**:

- O(log n) point queries
- Good for sparse data
- Spatial locality

**Cons**:

- ❌ "Get all ranges" requires full tree walk + reconstruction into rectangles
- ❌ Fragmentation at quad boundaries (not natural rectangle boundaries)
- ❌ Output format mismatch (quadrants ≠ GridRange)

**Verdict**: Doesn't fit. API expects rectangles, not quadrants.

---

### 2. Interval Tree (2D Segment Tree)

**Concept**: Two-level interval tree (rows × columns)

**Pros**:

- O(log² n + k) range queries
- Handles overlaps

**Cons**:

- ❌ Still O(n) for "get all ranges"
- ❌ Doesn't maintain non-overlapping invariant
- ❌ Output still needs decomposition step
- ❌ Complex construction (O(n log n))

**Verdict**: Adds complexity without solving the core problem.

---

### 3. Sparse 2D Array / HashMap

**Concept**: Store per-cell values in `Map<(row,col), T>`

**Pros**:

- O(1) point lookup
- Simple implementation

**Cons**:

- ❌ O(rows × cols) space for large ranges
- ❌ "Get all ranges" requires scanning ALL cells + grouping (expensive!)
- ❌ Large formatting range (e.g., entire column) = millions of entries

**Example**: Format column A (rows 0-1M) = 1 million HashMap entries vs 1 rectangle

**Verdict**: Unacceptable space complexity.

---

### 4. Vector-Based (SIMD)

**Concept**: Use SIMD operations for overlap detection

**Pros**:

- Potential speedup on overlap checks
- Modern hardware utilization

**Cons**:

- ❌ Still requires O(n) scan
- ❌ JavaScript/TypeScript has limited SIMD support
- ❌ Fragment generation doesn't parallelize well
- ❌ Modern V8 already optimizes array iteration

**Verdict**: Marginal gains, not worth the complexity.

---

### 5. Skip List / B-tree

**Concept**: 1D skip list or B-tree per row, then per column

**Pros**:

- O(log n) lookup within a row

**Cons**:

- ❌ 2D queries still require scanning multiple rows
- ❌ Doesn't maintain non-overlapping invariant
- ❌ Complex to maintain consistency across dimensions

**Verdict**: Designed for 1D data, awkward for 2D rectangles.

---

### 6. Other R-tree Variants (R*, Hilbert R-tree, STR)

**Concept**: Improved R-tree variants with better split heuristics or bulk loading

**Variants**:

- R*-tree: Optimized split algorithm (minimizes overlap + area + perimeter)
- **Hilbert R-tree**: Uses space-filling curves for better spatial locality
- **STR-tree**: Sort-Tile-Recursive bulk loading for static datasets

These variants provide better R-tree performance, but they're still O(log n) with hierarchical overhead. For n < 100, flat storage wins regardless. Worth exploring if extending to very large datasets (n > 10,000).

**Note**: My R-tree uses a simplified splitting strategy. Production systems targeting n > 10,000 should consider R*-tree or Hilbert R-tree.

---

## Why Rectangle Decomposition Wins

### Key Insight: API Shape Determines Data Structure

Google Sheets API signature:

```typescript
applyFormat(ranges: GridRange[], format: Format): void
getAllFormattedRanges(): Array<{gridRange: GridRange, format: Format}>
```

**API requirements**:

1. Output must be **rectangles** (not points or quadrants)
2. Output must be **minimal** (users don't want 1000 tiny ranges)
3. Output must be **non-overlapping** (API doesn't support precedence)

### Comparison Matrix

| Approach      | Insert   | Get All | Point Query | Space      | Output Format          |
| ------------- | -------- | ------- | ----------- | ---------- | ---------------------- |
| Flat Array    | O(n)     | O(n)    | O(n)        | O(n)       | ✅ GridRange[]         |
| R-tree        | O(log n) | O(n)    | O(log n)    | O(n log n) | ✅ GridRange[]         |
| Quadtree      | O(log n) | O(n)    | O(log n)    | O(n log n) | ❌ Needs conversion    |
| Interval Tree | O(log²n) | O(n)    | O(log²n)    | O(n log n) | ❌ Needs decomposition |
| HashMap       | O(r×c)   | O(r×c)  | O(1)        | O(r×c)     | ❌ Needs grouping      |

**Primary operation**: `query()` (all ranges) happens on every render, export, serialize, undo/redo\
**Secondary operation**: `insert()` happens during user edits\
**Rare operation**: Point queries (handled with linear scan, fast enough for n < 100)

### Real-World Validation

From `sparse-data-analysis.md`:

- Typical spreadsheet: n < 100 ranges per property
- Flat array: 0.01ms for n=100 (cache-friendly, V8-optimized)
- R-tree overhead only justified when n > 1000

---

## When Would Alternatives Win?

| Use Case                | Better Choice   | Why                                |
| ----------------------- | --------------- | ---------------------------------- |
| Point queries dominant  | Quadtree        | O(log n) point lookup vs O(n) scan |
| Millions of tiny ranges | Spatial hash    | Grid-based partitioning            |
| 3D+ dimensions          | KD-Tree, Octree | Generalizes to higher dimensions   |
| Dense, uniform grid     | 2D Array        | Direct indexing                    |

**But for spreadsheet property storage**: Rectangle decomposition is optimal.

---

## Conclusion

**Rectangle decomposition (flat + R-tree) is the right choice because**:

1. ✅ **Matches API requirements** - Query returns ranges directly
2. ✅ **Optimal for common case** - `query()` (all ranges) is O(n), can't do better
3. ✅ **Simple mental model** - Easy to reason about and maintain
4. ✅ **Performance validated** - [BENCHMARKS.md](../../BENCHMARKS.md) for empirical data
5. ✅ **Flexible** - Flat for sparse (n < 100), R-tree for dense (n > 1000)

**The key insight**: Let the API shape determine your data structure. When the API expects rectangles, store rectangles.

---

**See also**:

- [sparse-data-analysis.md](./sparse-data-analysis.md) - Why flat storage wins for typical spreadsheet usage
- [theoretical-foundation.md](../core/theoretical-foundation.md) - Mathematical foundation and complexity analysis
- [BENCHMARKS.md](../../BENCHMARKS.md) - Empirical performance measurements
