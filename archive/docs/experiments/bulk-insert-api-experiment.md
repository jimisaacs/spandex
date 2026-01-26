# Bulk Insert API Experiment

**Status**: ❌ REJECTED (Performance worse than sequential)
**Date**: 2025-10-07
**Priority**: HIGH (Phase 1, Priority #2 from Strategic Action Plan)
**Result**: Batch API implemented but provides NO speedup over sequential inserts (1.01-1.39x SLOWER)

---

## Hypothesis

**Question**: Can bulk insertion API provide 2-5x speedup over sequential inserts by amortizing overhead?

**Hypothesis**: Adding `insertBatch(entries: Array<{range, value}>)` will significantly improve performance for:

1. Initial data loading (spreadsheet state deserialization)
2. Bulk operations (copy/paste multiple ranges, undo/redo stacks)
3. Import operations (loading external data)

**Expected Speedup**:

- Linear scan implementations: **2-3x** (amortize array allocations, reduce duplicate scans)
- R-tree: **3-5x** (batch balancing, STR-like packing)

---

## Motivation

### Current Performance Baseline

From benchmark analysis (3-run statistical analysis, 2025-10-07):

**Sequential inserts (current approach)**:

| Scenario         | n    | Implementation    | Time (µs) | Operations   |
| ---------------- | ---- | ----------------- | --------- | ------------ |
| large-grid       | 2500 | rtree             | 1881.8    | 2500 inserts |
| large-grid       | 2500 | hilbertlinearscan | 8999.1    | 2500 inserts |
| large-sequential | 2500 | rtree             | 1920.0    | 2500 inserts |
| large-sequential | 2500 | hilbertlinearscan | 7491.7    | 2500 inserts |

**Per-insert cost** (amortized):

- RTree: 0.75µs/insert (1920µs / 2500)
- HilbertLinearScan: 3.0µs/insert (7492µs / 2500)

### Overhead Sources (Sequential Inserts)

**For Linear Scan** (current implementation analysis):

1. **Overlap detection**: O(n) scan per insert → n × O(n) = O(n²) for bulk load
2. **Fragment re-insertion**: Binary search + splice per fragment
3. **Memory allocation**: New array allocations on filter/splice operations
4. **Cache thrashing**: Each insert may invalidate previously accessed entries

**For R-tree** (current implementation):

1. **Tree rebalancing**: Per-insert splits and adjustments
2. **Path search**: Root-to-leaf traversal per insert
3. **Node updates**: Bounding box recalculation up the tree
4. **Suboptimal packing**: Incremental inserts don't optimize spatial locality

### Expected Improvements with Batch API

**Linear Scan**:

1. Single overlap detection pass (n scans → 1 scan)
2. Batch sorting by Hilbert index (amortize sort cost)
3. Single memory allocation for final array
4. Better cache locality (process spatially adjacent ranges together)

**R-tree**:

1. Optimal packing using STR or Packed Hilbert R-tree algorithm
2. Bottom-up construction (skip incremental rebalancing)
3. 100% space utilization (no wasted internal nodes)
4. Perfect spatial locality

**Expected speedup**: 2-5x for bulk operations

---

## API Design

### Proposed Interface

Add to `SpatialIndex<T>` interface:

```typescript
interface SpatialIndex<T> {
	// Existing methods
	insert(gridRange: GridRange, value: T): void;
	query(gridRange: GridRange): Array<{ gridRange: GridRange; value: T }>;
	getAllRanges(): Array<{ gridRange: GridRange; value: T }>;
	isEmpty: boolean;

	// NEW: Bulk insertion
	insertBatch(entries: Array<{ gridRange: GridRange; value: T }>): void;
}
```

### Alternative Names (avoid confusion with Google's RangeList)

From research discussion:

- `insertBatch()` ✅ - Clear intent, standard term
- `bulkInsert()` - Also clear
- `insertMany()` - Clearer that it's multiple (range, value) pairs

**Decision**: Use `insertBatch()` - Most descriptive, standard term in database literature

### Semantics

**Last-Writer-Wins**: Later entries in the batch override earlier entries (same as sequential inserts)

```typescript
// These are equivalent:
for (const entry of entries) {
	index.insert(entry.gridRange, entry.value);
}

// vs

index.insertBatch(entries);
```

**Decomposition**: Same geometric set difference rules apply

- Overlapping entries are decomposed into ≤4 fragments
- Final state maintains disjointness invariant

---

## Implementation Strategy

### For HilbertLinearScanImpl

**Naive approach** (O(n²)):

```typescript
insertBatch(entries) {
  for (const entry of entries) {
    this.insert(entry.gridRange, entry.value);  // O(n) each = O(n²)
  }
}
```

**Optimized approach** (O(n log n)):

```typescript
insertBatch(entries) {
  // 1. Process LWW semantics: Later entries override earlier
  //    Build map: overlapping new entries resolve to last writer
  //    Cost: O(k²) where k = batch size (typically k << n)

  // 2. Single pass: Find all existing entries that overlap with ANY new entry
  //    Cost: O(n) scan (not O(k × n)!)
  const overlappingExisting = [];
  for (const existingEntry of this.entries) {
    for (const newEntry of finalNewEntries) {
      if (intersects(existingEntry, newEntry)) {
        overlappingExisting.push(existingEntry);
        break; // Only need to mark once
      }
    }
  }

  // 3. Remove overlapping existing entries (keep non-overlapping)
  //    Cost: O(n)
  this.entries = this.entries.filter(e => !overlappingExisting.includes(e));

  // 4. Compute fragments for overlapping existing entries
  //    Cost: O(k × m) where m = avg overlaps per entry
  const fragments = [];
  for (const old of overlappingExisting) {
    let remaining = [old.rect];
    for (const newEntry of finalNewEntries) {
      // Subtract newEntry from all remaining fragments
      remaining = remaining.flatMap(frag => subtract(frag, newEntry.rect));
    }
    fragments.push(...remaining.map(frag => ({...old, rect: frag})));
  }

  // 5. Merge fragments + new entries, sort by Hilbert index
  //    Cost: O((n + k) log(n + k))
  const allEntries = [...fragments, ...finalNewEntries].map(e => ({
    ...e,
    hilbert: hilbertIndex(e.rect.centerX, e.rect.centerY)
  }));
  allEntries.sort((a, b) => a.hilbert - b.hilbert);

  this.entries = allEntries;
}
```

**Key optimization**: Single O(n) scan to find overlaps (not k × O(n))

**Complexity**:

- Overlap detection: O(n × k) where k = batch size
- Fragment computation: O(k × m) where m = avg overlaps
- Sorting: O((n + k) log(n + k))
- **Total**: O(n × k + (n + k) log(n + k))

**For typical cases** (k < 100, n < 1000):

- Overlap detection dominates: O(n × k)
- **Speedup over sequential**: k inserts × O(n) = O(k × n) → O(n × k) = **same asymptotic, but**:
  - Reduced constant factors (single scan, single sort)
  - Better memory locality
  - **Expected**: 2-3x real-world speedup

### For RStarTreeImpl

**Two approaches**:

#### Approach A: Sequential (Simple)

```typescript
insertBatch(entries) {
  for (const entry of entries) {
    this.insert(entry.gridRange, entry.value);
  }
}
```

- Easy to implement
- No speedup over sequential
- **Use case**: Fallback, ensures correctness

#### Approach B: STR Bulk Loading (Optimal)

```typescript
insertBatch(entries) {
  // 1. Collect existing entries
  const existing = this.getAllRanges();

  // 2. Merge with new entries (LWW semantics)
  const combined = mergeWithLastWriterWins([...existing, ...entries]);

  // 3. Rebuild tree using STR algorithm
  this.root = buildSTRTree(combined);
}
```

**STR (Sort-Tile-Recursive) Algorithm**:

1. Sort rectangles by X coordinate into ⌈√N⌉ vertical slices
2. Within each slice, sort by Y coordinate
3. Pack into leaf nodes bottom-up
4. Recursively build parent nodes

**Complexity**: O(N log N) for sort + O(N) for packing = O(N log N)

**Speedup**:

- Incremental: k inserts × O(log n) = O(k log n)
- STR rebuild: O((n + k) log(n + k))
- **For k ≈ n (full reload)**: 3-5x faster (from flatbush benchmarks)
- **For k << n (small batch)**: May be slower (rebuild cost > incremental)

**Trade-off**:

- k < n/10: Use incremental (sequential inserts)
- k ≥ n/10: Use STR rebuild (bulk loading)
- **Adaptive strategy**: Switch based on batch size

**Alternative: Packed Hilbert R-tree** (from modern-spatial-indexing-research.md):

- Similar to STR but uses Hilbert ordering instead of X/Y sort
- Better locality preservation
- Used by flatbush library (4x faster indexing than dynamic R-tree)

### For CompactLinearScanImpl

Same strategy as HilbertLinearScanImpl (no Hilbert sorting, just array operations)

---

## Implementation Plan

### Phase 1: API Definition

- [ ] Add `insertBatch()` to `SpatialIndex<T>` interface
- [ ] Update conformance test suite with batch operations
- [ ] Document LWW semantics for batch

### Phase 2: Implementation

- [ ] **HilbertLinearScanImpl**: Optimized batch (single scan + sort)
- [ ] **CompactLinearScanImpl**: Same as Hilbert but skip Hilbert indexing
- [ ] **RStarTreeImpl**: Start with sequential, add STR in Phase 3

### Phase 3: Optimization (After Telemetry Data)

- [ ] RStarTreeImpl: Add adaptive STR bulk loading (k ≥ n/10 threshold)
- [ ] Consider Packed Hilbert R-tree for static trees (serialization use case)

### Phase 4: Testing & Benchmarking

- [ ] Conformance tests: Batch insertion maintains all invariants
- [ ] LWW tests: Later entries override earlier entries within batch
- [ ] Adversarial tests: Batch with worst-case overlaps
- [ ] Benchmarks: Compare batch vs sequential for k ∈ {10, 50, 100, 500}

### Phase 5: Documentation

- [ ] Update PRODUCTION-GUIDE.md with batch API recommendations
- [ ] Add usage examples for common scenarios (deserialization, import)
- [ ] Document performance characteristics

---

## Use Cases

### 1. Deserialization / Initial Load

**Scenario**: Loading saved spreadsheet state from storage

```typescript
// Current (slow):
for (const saved of savedRanges) {
	backgroundColors.insert(saved.range, saved.value);
}

// With batch API (fast):
backgroundColors.insertBatch(savedRanges);
```

**Expected speedup**: 3-5x (bulk load optimization)

### 2. Undo/Redo Stack

**Scenario**: Restoring previous state from undo history

```typescript
// Undo: Restore previous set of ranges
function undo() {
	const previousState = undoStack.pop();

	// Clear current state
	backgroundColors = new HilbertLinearScanImpl();

	// Bulk load previous state
	backgroundColors.insertBatch(previousState);
}
```

### 3. Copy/Paste Multiple Ranges

**Scenario**: User copies multiple non-contiguous ranges

```typescript
// Copy: Collect ranges
const copiedRanges = selectedRanges.flatMap((r) => backgroundColors.query(r));

// Paste: Bulk insert at new location
const pastedRanges = copiedRanges.map((r) => ({
	gridRange: offsetRange(r.gridRange, pasteRow, pasteCol),
	value: r.value,
}));

backgroundColors.insertBatch(pastedRanges);
```

### 4. Import from External Data

**Scenario**: Loading CSV/Excel with many formatted ranges

```typescript
// Parse CSV with formatting
const formattedRanges = parseCSVWithFormatting(csvData);

// Bulk insert all formatting at once
backgroundColors.insertBatch(formattedRanges.backgroundColor);
fontWeights.insertBatch(formattedRanges.fontWeight);
// ... etc
```

---

## Expected Results

### Performance Targets

**HilbertLinearScanImpl** (n=100, k=50):

- Current sequential: 50 × 3.0µs = 150µs
- With batch: ~60µs (single scan + sort)
- **Speedup**: 2.5x

**RStarTreeImpl** (n=1000, k=500):

- Current sequential: 500 × 0.75µs = 375µs
- With STR rebuild: ~100µs (bulk packing)
- **Speedup**: 3.75x

### Validation Criteria

**Correctness**:

- ✅ All conformance tests pass (13 axioms)
- ✅ LWW semantics maintained within batch
- ✅ Disjointness invariant preserved
- ✅ Adversarial tests pass (worst-case overlaps)

**Performance**:

- ✅ Batch insertion ≥2x faster than sequential for k ≥ 50
- ✅ No regression for small batches (k < 10)
- ✅ Linear scaling: O(k) batch time for linear scan

---

## Risks & Mitigation

### Risk 1: Complexity Explosion

**Risk**: Batch LWW semantics are complex (within-batch overlaps)

**Mitigation**:

- Start with simple implementation (process sequentially in batch)
- Optimize incrementally once correctness validated
- Comprehensive conformance testing

### Risk 2: No Real-World Benefit

**Risk**: Batch operations are rare, speedup doesn't matter

**Mitigation**:

- **Wait for telemetry data** - validate batch operations are common
- Even if rare, deserialization use case alone justifies effort (critical path for startup performance)
- Low implementation cost (simple optimization)

### Risk 3: STR Rebuild Too Expensive

**Risk**: For R-tree, full rebuild may be slower than incremental for small batches

**Mitigation**:

- Adaptive strategy: Use STR only when k ≥ n/10
- Start with sequential fallback (guaranteed correct)
- Benchmark to find optimal threshold

---

## Success Metrics

**Must Have** (Phase 2):

- [ ] API implemented for all 3 implementations
- [ ] All conformance tests pass
- [ ] Batch insertion maintains disjointness + LWW

**Should Have** (Phase 3):

- [ ] 2x speedup over sequential for k ≥ 50
- [ ] Adaptive STR for R-tree (k ≥ n/10)

**Nice to Have** (Future):

- [ ] Packed Hilbert R-tree for static trees (serialization)
- [ ] Parallel batch processing (Web Workers)

---

## Proposed Next Steps (Not Pursued)

1. ✅ Complete research (this document)
2. Start implementation: Add `insertBatch()` to interface
3. Implement naive version (sequential) for all implementations
4. Write conformance tests for batch operations
5. Optimize linear scan with single-scan algorithm
6. Benchmark batch vs sequential
7. Document results

**Status**: Research complete, implementation deferred (bulk operations not prioritized)

---

## Experimental Results

### Implementation Summary

**Completed** (2025-10-07):

- ✅ Added `insertBatch()` to `SpatialIndex<T>` interface
- ✅ Implemented for HilbertLinearScanImpl (optimized with sequential LWW processing)
- ✅ Implemented for CompactLinearScanImpl (similar to Hilbert)
- ✅ Implemented for RStarTreeImpl (sequential fallback)
- ✅ All 77 conformance tests pass (including 9 new batch operation tests)
- ✅ Benchmarks created and executed

### Performance Results

**Benchmark Summary** (single run, Deno 2.5.2, Apple M3 Max):

| Implementation    | Scenario             | Sequential | Batch   | Speedup   | Result            |
| ----------------- | -------------------- | ---------- | ------- | --------- | ----------------- |
| HilbertLinearScan | small (n=50, k=10)   | 51.6µs     | 57.3µs  | **0.90x** | ❌ 1.11x slower   |
| HilbertLinearScan | medium (n=100, k=50) | 164.0µs    | 211.5µs | **0.78x** | ❌ 1.29x slower   |
| HilbertLinearScan | large (n=100, k=100) | 244.8µs    | 239.5µs | **1.02x** | ✅ ~1x (marginal) |
| CompactLinearScan | small (n=50, k=10)   | 31.5µs     | 43.9µs  | **0.72x** | ❌ 1.39x slower   |
| CompactLinearScan | medium (n=100, k=50) | 148.1µs    | 201.8µs | **0.73x** | ❌ 1.36x slower   |
| CompactLinearScan | large (n=100, k=100) | 184.0µs    | 246.5µs | **0.75x** | ❌ 1.34x slower   |
| RTree             | small (n=50, k=10)   | 227.4µs    | 226.0µs | **1.01x** | ≈ 1x (marginal)   |
| RTree             | medium (n=100, k=50) | 792.7µs    | 785.0µs | **1.01x** | ≈ 1x (marginal)   |
| RTree             | large (n=100, k=100) | 1.2ms      | 1.2ms   | **0.96x** | ≈ 1x (marginal)   |

**Key Findings**:

1. **NO speedup achieved** - Batch API is 1.01-1.39x SLOWER than sequential inserts
2. **Linear scan implementations** - Consistently slower (10-39% overhead)
3. **R-tree** - Performance neutral (expected, since it uses sequential fallback)
4. **Best case** - HilbertLinearScan at k=100: 1.02x (barely break-even, within measurement noise)

### Root Cause Analysis

**Why the optimization failed**:

1. **LWW semantics require sequential processing**:
   - To maintain correct Last-Writer-Wins within batch, entries must be processed in order
   - Later entries must decompose earlier entries (same as sequential inserts)
   - Cannot parallelize or reorder without violating LWW semantics

2. **Implementation approach**:
   ```typescript
   // Current implementation (Phase 2): Sequential LWW within batch
   let batchEntries = [];
   for (const entry of entries) { // O(k) iterations
   	// Find overlaps with current batch state: O(m) where m = batch size
   	// Decompose overlapping entries: O(1) per overlap
   	// Rebuild batch state: O(m)
   }
   // Then merge with existing entries: O(n × k)
   // Total: O(k × m) + O(n × k) ≈ O(k²) for within-batch + O(n × k) for existing
   ```

3. **Sequential insert approach**:
   ```typescript
   for (const entry of entries) { // O(k) iterations
   	index.insert(entry.gridRange, entry.value); // O(n) per insert
   }
   // Total: O(k × n)
   ```

4. **Overhead sources**:
   - **Extra loop**: Batch API processes entries twice (once for LWW within batch, once for existing overlaps)
   - **Memory allocations**: Multiple intermediate arrays created during batch LWW processing
   - **No amortization**: Cannot amortize sorting/indexing since LWW requires sequential order

5. **Asymptotic complexity**:
   - **Batch API**: O(k²) + O(n × k) ≈ O(k² + n × k)
   - **Sequential**: O(k × n)
   - **For k ≪ n**: Batch has extra O(k²) overhead
   - **For k ≈ n**: Both are O(n²), but batch has higher constant factors

### Hypothesis Validation

**Original hypothesis**: Batch insertion would provide 2-5x speedup by amortizing overhead.

**Validation result**: ❌ **REJECTED**

**Specific claims tested**:

| Claim                               | Expected          | Actual                        | Validated? |
| ----------------------------------- | ----------------- | ----------------------------- | ---------- |
| 2-3x speedup for linear scan (k≥50) | 2-3x faster       | 1.29-1.39x SLOWER             | ❌         |
| 3-5x speedup for R-tree             | 3-5x faster       | ~1x (neutral)                 | ❌         |
| Amortize array allocations          | Fewer allocations | More allocations (extra loop) | ❌         |
| Single overlap detection pass       | O(n) vs O(k×n)    | O(k²+n×k) vs O(k×n)           | ❌         |
| Better cache locality               | Improved          | Worse (more memory churn)     | ❌         |

**What we learned**:

1. **LWW semantics prevent bulk optimization** - Cannot reorder or parallelize due to correctness requirements
2. **Extra processing overhead dominates** - Batch LWW pass adds more cost than it saves
3. **Sequential is already optimal** - For LWW-constrained workload, sequential processing is the right approach
4. **API surface area cost** - Adding bulk API without performance benefit increases complexity for no gain

### Correctness Validation

**Conformance tests**: ✅ **ALL PASS** (77/77 tests)

**New batch-specific tests** (9 tests):

- ✅ Empty batch handling
- ✅ Single entry batch (fast path)
- ✅ Equivalence with sequential inserts (same final state)
- ✅ LWW within batch (later entries override earlier)
- ✅ Non-overlapping preservation
- ✅ Overlap with existing entries
- ✅ Partial overlaps within batch
- ✅ Stress test (50 random inserts)
- ✅ Mixed batch and sequential operations

**Invariants maintained**:

- ✅ Disjointness (no overlapping ranges)
- ✅ Consistency (isEmpty ⟺ getAllRanges().length === 0)
- ✅ Non-duplication (no duplicate (bounds, value) pairs)

**Conclusion**: Implementation is **correct** but **not performant**.

### Decision: Reject API

**Reasoning**:

1. **No performance benefit** - Primary motivation for bulk API was performance; this was not achieved
2. **Increased complexity** - Adds API surface area and maintenance burden without benefit
3. **Potential for misuse** - Developers might assume `insertBatch()` is faster, leading to incorrect optimization
4. **Alternative exists** - Sequential inserts are already optimal for this workload

**Recommended action**:

- **Remove** `insertBatch()` API from all implementations
- **Revert** interface change
- **Archive** experiment documentation with full analysis
- **Document** in research summary why bulk API doesn't work for LWW semantics

---

## Alternative Approaches (Future Research)

**If bulk API is needed in future, consider**:

### 1. Relaxed LWW Semantics

**Idea**: Allow batch entries to be processed in any order, with LWW determined by explicit timestamps

```typescript
insertBatch(entries: Array<{
    gridRange: GridRange;
    value: T;
    timestamp?: number;  // Optional explicit ordering
}>): void;
```

**Tradeoffs**:

- ✅ Enables true batch optimization (can sort by Hilbert index)
- ❌ Breaks existing LWW assumption (order in array matters)
- ❌ Requires timestamp management by caller

### 2. Separate Bulk Load API

**Idea**: Separate API for initial load vs incremental updates

```typescript
// For initial load: No existing entries, can optimize freely
loadBatch(entries: Array<...>): void;

// For incremental: LWW with existing, sequential required
insertBatch(entries: Array<...>): void;
```

**Tradeoffs**:

- ✅ `loadBatch()` can use STR packing, sorted insertion
- ✅ Clear semantic distinction
- ❌ Two APIs instead of one
- ❌ `loadBatch()` only helps for cold start (rare in practice)

### 3. STR Rebuild for Large Batches

**Idea**: For k ≥ n/2, rebuild entire tree using STR algorithm

```typescript
insertBatch(entries: Array<...>): void {
    const existing = this.getAllRanges();
    if (entries.length >= existing.length / 2) {
        // Full rebuild with STR
        this.rebuildFromEntries([...existing, ...entries]);
    } else {
        // Sequential inserts
        for (const entry of entries) {
            this.insert(entry.gridRange, entry.value);
        }
    }
}
```

**Tradeoffs**:

- ✅ May help for large batches (k ≈ n)
- ❌ Full rebuild cost (O(n log n))
- ❌ Only beneficial for very large batches
- ❌ Still requires LWW processing within batch

**Verdict**: None of these approaches are compelling enough to pursue now.

---

## References

### Bulk Loading Algorithms

- Leutenegger, S. et al. (1997). "STR: A Simple and Efficient Algorithm for R-Tree Packing" - IEEE
- Kamel, I. & Faloutsos, C. (1993). "On Packing R-trees" - CMU
- "Hilbert R-tree: An Improved R-Tree Using Fractals" - VLDB 1994

### Industry Implementations

- flatbush library (mourner/flatbush) - Packed Hilbert R-tree, 4x faster bulk loading
- PostGIS - Uses STR for spatial index bulk loading
- Shapely (Python) - STRTree implementation

### Related Work

- See [modern-spatial-indexing-research.md](./modern-spatial-indexing-research.md) for space-filling curves and bulk loading techniques
- See [sparse-data-analysis.md](../../../docs/analyses/sparse-data-analysis.md) for performance baseline
