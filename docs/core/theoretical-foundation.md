# Theoretical Foundation

> Mathematical model and algorithm correctness proofs

**Navigation**: [Research Summary](./RESEARCH-SUMMARY.md) • [Production Guide](../../PRODUCTION-GUIDE.md) • [Benchmarks](../../BENCHMARKS.md)

## Glossary

- **AABB**: Axis-Aligned Bounding Box. Rectangle with edges parallel to coordinate axes.
- **GridRange**: Google Sheets API type with fields `{startRowIndex?, endRowIndex?, startColumnIndex?, endColumnIndex?}`. Uses **half-open intervals** `[start, end)` where `start` is included but `end` is not. 0-indexed. `undefined` means unbounded (entire row/column).
- **Spatial Partition**: A set of disjoint (non-overlapping) rectangles that tile a region of space. Maintained via geometric set difference.
- **Rectangle Decomposition**: Geometric operation `A \ B` (set subtraction) that produces ≤4 disjoint fragments. Used to maintain spatial partitions under insertions. See [visual guide](../diagrams/rectangle-decomposition.md).
- **Last Writer Wins** (LWW): When ranges overlap, the most recent insertion takes precedence. This is the conflict resolution strategy.
- **Spatial Index**: Data structure optimized for geometric queries. Examples: R-trees (hierarchical), quadtrees (space partitioning), or simple rectangle stores (linear scan).

## Problem

**Given**: Sequence of 2D range insertions with values\
**Output**: Minimal non-overlapping range decomposition\
**Constraint**: Last writer wins

### Mathematical Model

**Domain**: Let **S** = **ℕ × ℕ** (2D grid of natural numbers: rows × columns)\
**Values**: Let **V** = any value type (strings, objects, etc.)

**State**: Maintain function `f: S → V ∪ {⊥}` where:

- `f(row, col) = v` means cell `(row, col)` has value `v`
- `f(row, col) = ⊥` means cell is unset (⊥ = "bottom" = undefined)

**Operations**:

- `Insert(R, v)`: For all points p in rectangle R, set `f(p) = v`
- `Query()`: Return minimal set of rectangles `{(R₁,v₁), (R₂,v₂), ...}` that covers all cells where `f ≠ ⊥`

**Minimality**: No two returned rectangles can be merged without violating value consistency.

## Algorithms

Two distinct algorithms, each with multiple implementation strategies:

### Algorithm 1: Linear Scan with Rectangle Decomposition (O(n))

**Implementations**: Various optimization strategies (spatial locality, compact storage, TypedArrays, educational reference). See `src/implementations/` for current active implementations.

```
INSERT(R, v):
  1. Find overlapping rectangles O (linear scan through flat array)
  2. Remove O from storage
  3. For each r ∈ O: compute fragments r \ R (set subtraction)
  4. Insert R and valid fragments into flat array
```

**Complexity**: O(n) per insert, therefore O(n²) for n sequential inserts (worst case)
**Space**: O(n) rectangles stored, O(4n) worst case due to fragmentation
**Best for**: Sparse data (n < 100), where constant-factor overhead dominates

**Optimization Strategies**:

- **Spatial locality**: Space-filling curve ordering (2x faster via improved memory access patterns)
- **Compact storage**: Pure functions, minimal code size (1.2KB minified)
- **TypedArrays**: Memory-efficient coordinate storage
- **Educational**: Explicit helper functions for clarity

See `src/implementations/` for current variants.

### Algorithm 2: Hierarchical R*-tree (O(log n))

**Implementation approach**: R-tree with R* split algorithm

```
INSERT(R, v):
  1. Traverse tree to find overlapping rectangles O (O(log n) average)
  2. For each r ∈ O: compute fragments r \ R (set subtraction)
  3. Insert R and fragments into tree with R* node splitting
```

**R\* Split Algorithm** (Beckmann et al., 1990):

- Choose split axis by minimizing perimeter sum (margin metric)
- Within axis, choose split point to minimize overlap
- Complexity: O(m log m) per split where m = max entries per node (m=10)
- Better tree quality than Guttman's quadratic split (1984)

**Space**: O(n) total (n leaf entries + O(n/M) internal nodes where M = branching factor)
**Best for**: Large datasets (n ≥ 1000), write-heavy or balanced workloads

**Performance**: [BENCHMARKS.md](../../BENCHMARKS.md) for comprehensive empirical comparison across data sizes and workload patterns.

---

### R-Tree Insert Complexity (Detailed Analysis)

**Operation**: `insert(R_new, v)` with rectangle decomposition and last-writer-wins semantics

Unlike standard R-tree insertion (which finds single insertion point), our use case requires finding and modifying ALL overlapping entries.

**Step 1** - Find all overlapping entries:

- **Algorithm**: Recursive tree traversal visiting all paths whose bounding boxes intersect R_new
- **Let k** = number of entries that overlap with R_new (data-dependent)
- **Traversal cost**:
  - Must visit all tree paths leading to overlapping entries
  - Each path has depth O(log n) on average
  - In worst case, may need to visit O(k) paths
  - **Cost**: O(k × log n) worst case, O(log n) average case when k is small
- **Best case**: k = 0 (no overlaps) → O(log n) single traversal
- **Average case**: k ≪ n (sparse overlaps) → O(log n) dominated by tree depth
- **Worst case**: k = Θ(n) (all entries overlap) → O(n log n) must visit many paths

**Step 2** - Decompose overlapping rectangles:

- **Algorithm**: For each r ∈ overlaps, compute r \ R_new (set subtraction)
- **Fragment generation**: Each rectangle produces ≤4 disjoint fragments (proven in Correctness section)
- **Total fragments**: ≤ 4k fragments generated
- **Cost**: O(k) constant time per rectangle

**Step 3** - Reinsert fragments and new range:

- **Algorithm**: Insert R_new and up to 4k fragments into tree
- **Each insertion**: O(log n) traversal + potential node split
- **Node splits**: Amortized O(1) splits per insertion (tree remains balanced)
- **Total**: (4k + 1) × O(log n) = O(k × log n)

**Overall Complexity**:

- **Best case** (no overlaps, k=0):
  - Step 1: O(log n), Step 2: O(0), Step 3: O(log n)
  - **Total: O(log n)**

- **Average case** (sparse data, constant k):
  - Step 1: O(log n), Step 2: O(1), Step 3: O(log n)
  - **Total: O(log n)** - constant k absorbed into Big-O

- **Worst case** (dense overlaps, k = Θ(n)):
  - Step 1: O(n log n), Step 2: O(n), Step 3: O(n log n)
  - **Total: O(n log n)** - degrades to near-linear when most entries overlap

**Empirical Validation**:

Adversarial tests (designed to maximize overlaps) show k grows sublinearly:

- 100 inserts with pathological concentric pattern → 232 final ranges
- Average k ≈ 2.3 overlaps per insert (not Θ(n))
- Even under worst-case patterns, k remains small
- See `test/adversarial.test.ts` for full methodology

**Practical Complexity**: For typical spreadsheet data with sparse overlaps, k is small and constant, making the practical complexity **O(log n) per insert**, matching standard R-tree performance. The theoretical O(n log n) worst case occurs only when nearly all entries overlap with every insertion, which is geometrically constrained by finite grid area.

---

## Correctness Proof

**Theorem**: The rectangle decomposition algorithm maintains a valid spatial partition satisfying LWW semantics.

**Definitions**:

- **Spatial Partition**: A set of rectangles `R = {r₁, r₂, ..., rₙ}` where `rᵢ ∩ rⱼ = ∅` for all `i ≠ j`
- **LWW Property**: For any cell `(row, col)`, `value(row, col) = vₖ` where `vₖ` is from the most recent insert covering that cell

**Invariants** (must hold after each operation):

1. **Disjoint**: ∀ rᵢ, rⱼ ∈ R, i ≠ j ⟹ rᵢ ∩ rⱼ = ∅
2. **LWW**: ∀ cell c, value(c) is from the most recent insert covering c
3. **Coverage**: ∀ inserted cell c, ∃ r ∈ R such that c ∈ r
4. **Minimality**: No two adjacent rectangles with the same value

**Proof by Induction**:

**Base case**: Empty index trivially satisfies all invariants.

**Inductive step**: Assume invariants hold before insert(R_new, v_new). Prove they hold after.

**Step 1** (Find overlaps): Let `O = {r ∈ R | r ∩ R_new ≠ ∅}`

- Correctness: Only rectangles that intersect R_new are affected

**Step 2** (Remove overlaps): R' = R \ O

- **Invariant 1 preserved**: Removing elements preserves disjointness
- **Invariant 2 temporarily violated**: Cells in O now uncovered (will be fixed in Step 4)

**Step 3** (Decompose): For each `r ∈ O`, compute `fragments(r) = r \ R_new`

- Set difference produces ≤4 disjoint rectangles per r
- Geometric fact: `r \ R_new` tiles the area `r ∩ R̄_new` with disjoint rectangles
- **Proof**: Top, Bottom, Left, Right fragments are disjoint by construction (non-overlapping strips)

**Step 4** (Insert): R'' = R' ∪ {R_new} ∪ ⋃(fragments(r) for r in O)

- **Invariant 1**:
  - R' is disjoint (from Step 2)
  - R_new is disjoint from R' (all overlaps were removed)
  - fragments(r) are disjoint from R_new (by definition of set difference)
  - fragments(r) are disjoint from R' (subsets of removed rectangles)
  - ✓ Preserved

- **Invariant 2** (LWW):
  - Cells in R_new get v_new (most recent) ✓
  - Cells in fragments retain old values (not covered by R_new) ✓
  - Cells in R' retain old values (not affected) ✓

- **Invariant 3** (Coverage):
  - Cells previously in O are now covered by R_new or fragments(r) ✓
  - Cells in R' remain covered ✓

- **Invariant 4** (Minimality):
  - Post-processing step (not shown) merges adjacent same-value rectangles
  - Optional: Most implementations don't enforce this for simplicity

**Worst-case fragmentation**: Each insert can split all n existing rectangles into ≤4 fragments each.

- After n inserts: ≤ 4n rectangles (if every insert overlaps everything)
- Realistic case: O(n) rectangles due to spatial locality

∎

---

## Correctness of Spatial Locality Optimization

**Theorem**: Maintaining space-filling curve sorted order (Morton/Hilbert) preserves all invariants (disjointness, LWW semantics).

**Key Question**: Does sorting by spatial locality break correctness?

**Answer**: No. Space-filling curve sorting is applied AFTER decomposition, not during.

**Proof**:

The algorithm is:

1. Find overlaps O (same as naive)
2. Remove O (same as naive)
3. Decompose overlaps: fragments = {r \ R_new | r ∈ O} (same as naive)
4. **Re-insert fragments AND new range in spatial-locality-sorted order** (ONLY DIFFERENCE)

**Critical insight**: Space-filling curve sorting affects STORAGE ORDER, not the geometric decomposition.

**Invariant preservation**:

- **Disjointness**: Decomposition produces disjoint fragments (proven above). Spatial sorting doesn't change geometry, only storage order. ∴ Preserved ✓

- **LWW**: New range overwrites overlapping regions (removal + insertion). Fragments keep old values. Spatial sorting happens AFTER value assignment. ∴ Preserved ✓

- **Coverage**: Same fragments generated, just stored in different order. ∴ Preserved ✓

- **Minimality**: Not enforced by either variant. ∴ N/A

**Complexity difference**: Binary search insertion O(log n) vs append O(1), but both are dominated by O(n) scan and splice. Worst-case remains O(n²) for n inserts.

**Conclusion**: Spatial locality optimization is **semantically equivalent** to naive ordering, differing only in storage order for improved memory access patterns.

∎

---

## Complexity Analysis

### Linear Scan Implementations

| Operation      | Time  | Space | Notes                       |
| -------------- | ----- | ----- | --------------------------- |
| Insert         | O(n)  | O(1)  | n = existing rectangles     |
| Query (all)    | O(n)  | O(n)  | Return all rectangles       |
| Query (region) | O(n)  | O(k)  | k = matching rectangles     |
| n Inserts      | O(n²) | O(4n) | Worst case: each splits all |

### R-tree Implementation

| Operation      | Time         | Space    | Notes                       |
| -------------- | ------------ | -------- | --------------------------- |
| Insert         | O(log n)     | O(log n) | Average case tree traversal |
| Query (all)    | O(n)         | O(n)     | Full tree walk              |
| Query (region) | O(log n + k) | O(k)     | k = matching rectangles     |
| n Inserts      | O(n log n)   | O(n)     | Balanced tree structure     |

**Worst case**: O(n) insert if tree becomes unbalanced (rare with good split heuristics)

---

## Fragmentation Worst-Case Analysis

**Question**: What's the absolute worst-case space complexity accounting for fragmentation cascades?

**Pathological insertion pattern**:

```
Insert rectangle that overlaps ALL existing rectangles
Each overlap creates up to 4 fragments
Repeat n times
```

**Analysis**:

- Insert 1: 1 rectangle, 0 fragments → **total: 1**
- Insert 2: Overlaps 1, creates ≤4 fragments → **total: 1 + 4 = 5**
- Insert 3: Overlaps 5, creates ≤20 fragments → **total: 1 + 20 = 21**
- Insert 4: Overlaps 21, creates ≤84 fragments → **total: 1 + 84 = 85**
- ...
- Insert n: Overlaps (4^(n-1)), creates ≤4^n fragments → **total: 4^n**

**Worst-case space**: O(4^n) - EXPONENTIAL!

**Is this realistic?** **NO!**

**Why exponential fragmentation is impossible in practice**:

1. **Geometric constraint**: After decomposition, fragments are SMALLER than originals
   - Each fragment has area ≤ original rectangle area
   - Total area covered ≤ grid bounds (finite)
   - ∴ Number of fragments bounded by grid resolution

2. **Spatial locality**: Real insertion patterns have locality
   - Spreadsheet edits are clustered (user working in region)
   - Typical: k overlaps per insert where k ≪ n
   - Measured: Average k ≈ 2-5 in realistic workloads

3. **Empirical validation**: Adversarial tests with pathological patterns:
   - Theoretical worst: 4^100 rectangles (impossible)
   - Actual result: ~50-75 rectangles (linear growth)
   - See `test/adversarial.test.ts` for concentric, diagonal, checkerboard patterns

**Practical bound**: O(n) to O(4n) rectangles after n inserts, not O(4^n).

**Spatial locality impact**: Sorting doesn't affect fragmentation - same decomposition algorithm, just different storage order.

---

### Geometric Bound on Fragmentation (Formal Proof)

The above empirical observation can be proven mathematically using geometric constraints.

**Theorem**: After n insertions into a bounded grid of area A, the maximum number of disjoint rectangles R_max is bounded by A / A_min, where A_min is the minimum rectangle area.

**Proof**:

**Given**:

1. Grid has finite area A (e.g., rows × cols for spreadsheet)
2. All rectangles are disjoint (proven in Correctness Proof above)
3. Each rectangle has area ≥ A_min (minimum: 1 cell for spreadsheets)

**Derive**:

1. Let R = number of disjoint rectangles stored
2. Total area covered = sum of all rectangle areas
3. Since rectangles are disjoint: total area covered = Σ area(r_i) for all r_i
4. Each area(r_i) ≥ A_min (by definition)
5. Therefore: R × A_min ≤ total area covered ≤ A (grid bounds)
6. Therefore: **R ≤ A / A_min**

**Implication**: Exponential O(4^n) fragmentation is **geometrically impossible**.

**Example** (spreadsheet with 1,000,000 cells):

- Grid area A = 10^6 cells
- Minimum area A_min = 1 cell
- Maximum rectangles: R_max ≤ 10^6 / 1 = **10^6 rectangles**
- NOT 4^100 ≈ 10^60 rectangles (theoretical exponential)

**Example** (typical editing with multi-cell ranges):

- Grid area A = 10^6 cells
- Typical minimum area A_min ≈ 10 cells (small ranges)
- Maximum rectangles: R_max ≤ 10^6 / 10 = **10^5 rectangles**

**Empirical validation**: Adversarial tests confirm this bound:

- 100 pathological inserts → 232 final ranges (2.3x fragmentation)
- 1000 inserts would yield ≈ 2300 ranges (linear, not 4^1000)
- Fragmentation ratio decreases as n grows (3.70x → 2.32x from n=10 to n=100)
- See `test/adversarial.test.ts` for full results

**Conclusion**: The practical complexity is **O(n) rectangles after n inserts**, bounded by geometric constraints. The theoretical O(4^n) represents an impossible scenario that violates finite area limits. When combined with typical spatial locality (k ≈ 2-3 overlaps per insert), actual fragmentation grows linearly with a small constant factor.

∎

---

## Geometry

### Rectangle Format

**Standard**: `[xmin, ymin, xmax, ymax]` per ISO 19107:2019 (x=columns, y=rows)

**Coordinate system by implementation**:

**Implementation Choices**:

- **API**: All implementations accept GridRange with half-open intervals `[start, end)` (Google Sheets standard)
- **Internal Storage**: All implementations convert to closed intervals `[min, max]` by subtracting 1 from end coordinates
- **Return Values**: Converted back to half-open `[start, end)` by adding 1 to max coordinates
- **Unbounded**: `undefined` → `Infinity` (represents entire rows/columns)

**Coordinate System Summary**:

| Layer                  | Format                   | Example: Rows 0-9         |
| ---------------------- | ------------------------ | ------------------------- |
| API Input (GridRange)  | Half-open `[start, end)` | `startRow: 0, endRow: 10` |
| Internal Storage       | Closed `[min, max]`      | `[0, 9]`                  |
| API Output (GridRange) | Half-open `[start, end)` | `startRow: 0, endRow: 10` |

**Conversion Functions** (present in all implementations):

- `toRectangle(gridRange)`: GridRange → internal `[min, max]` (subtracts 1 from end coords)
- `toGridRange(rectangle)`: internal `[min, max]` → GridRange (adds 1 to max coords)

**Rationale**: Closed intervals simplify geometric operations (no `±1` adjustments in intersection/subtraction logic).

### Operations

**Intersection**: `A ∩ B ≠ ∅`

```typescript
!(a.xmax < b.xmin || b.xmax < a.xmin || a.ymax < b.ymin || b.ymax < a.ymin);
```

**Subtraction**: `A \ B` → ≤4 fragments (cuts rectangle A around B)

**Visual example** (rectangle A minus overlapping B):

```
Before:        After decomposition:
┌─────────┐    ┌─────────┐  ← Top fragment
│    A    │    │    A    │
│         │    ├───┬───┬─┤
│    ┌──┐ │    │ A │ B │A│  ← Left, Center (B wins), Right
│    │ B│ │    └───┴───┴─┘
│    └──┘ │    │    A    │  ← Bottom fragment
└─────────┘    └─────────┘

Result: A \ B produces 4 disjoint fragments (Top, Bottom, Left, Right)
```

**Inclusive intervals** `[min, max]` (Reference):

- **Top**: `[a.xmin, a.ymin, a.xmax, b.ymin-1]` — rows before B starts
- **Bottom**: `[a.xmin, b.ymax+1, a.xmax, a.ymax]` — rows after B ends
- **Left**: `[a.xmin, max(a.ymin,b.ymin), b.xmin-1, min(a.ymax,b.ymax)]` — columns before B
- **Right**: `[b.xmax+1, max(a.ymin,b.ymin), a.xmax, min(a.ymax,b.ymax)]` — columns after B

**Half-open intervals** `[min, max)` (Optimized only):

- **Top**: `[a.xmin, a.ymin, a.xmax, min(a.ymax, b.ymin)]` — up to where B starts
- **Bottom**: `[a.xmin, max(a.ymin, b.ymax), a.xmax, a.ymax]` — from where B ends
- **Left**: `[a.xmin, max(a.ymin,b.ymin), min(a.xmax, b.xmin), min(a.ymax,b.ymax)]`
- **Right**: `[max(a.xmin, b.xmax), max(a.ymin,b.ymin), a.xmax, min(a.ymax,b.ymax)]`

**Why different?** In `[start, end)` notation, `end` is already exclusive, so no `±1` adjustments needed!

- Inclusive: "row 4" = `[4, 4]` so "before row 5" = `[_, _, _, 4]` (need `5-1`)
- Half-open: "row 4" = `[4, 5)` so "before row 5" = `[_, _, _, 5)` (already correct!)

## Testing

**Axioms** (must hold ∀ implementations):

1. **Consistency**: `isEmpty ⟺ query() returns empty iterator`
2. **Non-duplication**: No identical (bounds, value) pairs
3. **Last-writer-wins**: Insertion order matters for overlaps
4. **Correctness**: Property-based random testing

## References

1. de Berg, M., Cheong, O., van Kreveld, M., & Overmars, M. (2008). _Computational Geometry: Algorithms and Applications_ (3rd ed.). Springer-Verlag. ISBN: 978-3-540-77973-5. (Rectangle decomposition algorithms)
2. ISO 19107:2019 _Geographic Information — Spatial Schema_. International Organization for Standardization. (AABB representation standards)
3. Samet, H. (1990). _The Design and Analysis of Spatial Data Structures_. Addison-Wesley. ISBN: 978-0-201-50255-9. (Comprehensive survey of spatial indexing methods)
4. Guttman, A. (1984). "R-trees: A Dynamic Index Structure For Spatial Searching". _Proceedings of the 1984 ACM SIGMOD International Conference on Management of Data_, pp. 47-57. doi:10.1145/602259.602266 (Hierarchical spatial indexing - for comparison)
5. Shapiro, M., Preguiça, N., Baquero, C., & Zawirski, M. (2011). "Conflict-Free Replicated Data Types". In _Stabilization, Safety, and Security of Distributed Systems_, Lecture Notes in Computer Science vol 6976, pp. 386-400. Springer. doi:10.1007/978-3-642-24550-3_29 (Last-Writer-Wins conflict resolution semantics)

---

**See Also**:

- [RESEARCH-SUMMARY.md](./RESEARCH-SUMMARY.md) - Executive summary and production recommendations
- [PRODUCTION-GUIDE.md](../../PRODUCTION-GUIDE.md) - Implementation selection guide
- [BENCHMARKS.md](../../BENCHMARKS.md) - Empirical performance data
