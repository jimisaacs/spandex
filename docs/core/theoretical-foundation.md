# Theoretical Foundation

Mathematical model and correctness proofs.

## Glossary

- **AABB**: Axis-Aligned Bounding Box
- **Rectangle**: `[xmin, ymin, xmax, ymax]` using closed intervals `[min, max]` (both endpoints included)
- **GridRange**: Google Sheets API type using half-open intervals `[start, end)` (end excluded). Converted via adapter.
- **Spatial Partition**: Disjoint rectangles maintained via geometric set difference
- **Rectangle Decomposition**: `A \ B` produces ≤4 disjoint fragments
- **Last Writer Wins** (LWW): Most recent insertion wins in overlaps
- **Spatial Index**: Data structure for geometric queries (R-trees, quadtrees, linear scan)

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

### Algorithm 1: Linear Scan with Rectangle Decomposition

**Implementations**: See `packages/@jim/spandex/src/index/` for current active implementations.

```
INSERT(R, v):
  1. Find overlapping rectangles O (linear scan through flat array)
  2. Remove O from storage
  3. For each r ∈ O: compute fragments r \ R (set subtraction)
  4. Insert R and valid fragments into flat array
```

**Complexity**: O(n) insert, O(n²) for n sequential inserts

**Space**: O(n) entries (≈4n worst case)

**Best for**: Sparse data (n < 100)

**Optimizations**: Spatial locality (2x faster), compact storage, TypedArrays

### Algorithm 2: Hierarchical R*-tree (O(log n))

```
INSERT(R, v):
  1. Traverse tree to find overlapping rectangles O (O(log n) average)
  2. For each r ∈ O: compute fragments r \ R (set subtraction)
  3. Insert R and fragments into tree with R* node splitting
```

R* Split (Beckmann et al., 1990): Choose axis minimizing perimeter sum, choose split minimizing overlap. O(m log m) per split (m=10).

**Space**: O(n)
**Best for**: Large datasets (n ≥ 1000)

---

### R-Tree Insert Complexity

**Operation**: `insert(R_new, v)` requires finding and modifying ALL overlapping entries (not just one).

**Steps**:

1. Find overlaps: O(k × log n) worst case, O(log n) average (k = overlap count)
2. Decompose: O(k) - each produces ≤4 fragments
3. Reinsert: (4k + 1) × O(log n) = O(k × log n)

**Overall**:

- **Best** (k=0): O(log n)
- **Average** (constant k): O(log n)
- **Worst** (k = Θ(n)): O(n log n)

**Empirical**: Adversarial tests show k ≈ 2.3 average (sublinear growth), not Θ(n).

---

## Correctness Proof

**Theorem**: Rectangle decomposition maintains valid spatial partition with LWW semantics.

**Invariants**:

1. **Disjoint**: ∀ rᵢ, rⱼ ∈ R, i ≠ j ⟹ rᵢ ∩ rⱼ = ∅
2. **LWW**: ∀ cell c, value(c) from most recent insert
3. **Coverage**: ∀ inserted cell c, ∃ r ∈ R: c ∈ r
4. **Minimality**: No adjacent rectangles with same value

**Proof by Induction**:

**Base case**: Empty index trivially satisfies all invariants.

**Inductive step**: Assume invariants hold before insert(R_new, v_new). Prove they hold after.

**Steps**:

1. Find overlaps O = {r ∈ R | r ∩ R_new ≠ ∅}
2. Remove O: R' = R \ O (preserves disjointness)
3. Decompose: fragments(r) = r \ R_new for each r ∈ O (≤4 per r)
4. Insert: R'' = R' ∪ {R_new} ∪ ⋃fragments(r)

**Invariant preservation**:

- **Disjoint**: Fragments disjoint from R_new (by set difference) and from R' (subsets of removed) ✓
- **LWW**: R_new overwrites (most recent), fragments retain old values ✓
- **Coverage**: R_new + fragments cover all cells previously in O ✓
- **Minimality**: Optional (most implementations skip)

**Worst-case**: ≤ 4n rectangles after n inserts. Realistic: O(n) due to spatial locality.

∎

---

## Correctness of Spatial Locality Optimization

**Theorem**: Space-filling curve ordering preserves all invariants.

**Proof**: Sorting affects STORAGE ORDER only, not geometric decomposition. Same fragments generated, just stored in different order.

- **Disjointness**: Geometry unchanged ✓
- **LWW**: Sorting happens after value assignment ✓
- **Coverage**: Same fragments ✓

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

---

## Fragmentation Worst-Case

**Pathological pattern**:

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

**Worst-case space**: O(4^n) - EXPONENTIAL (but impossible in practice)

**Why impossible**:

1. **Geometric constraint**: Total area ≤ grid bounds (finite) → fragments bounded by grid resolution
2. **Spatial locality**: Real patterns clustered, k ≪ n overlaps per insert
3. **Empirical**: Adversarial tests show ~50-75 rectangles (linear), not 4^100

**Practical bound**: O(n) to O(4n) rectangles after n inserts.

---

### Geometric Bound (Formal Proof)

**Theorem**: After n insertions into bounded grid (area A), max rectangles R_max ≤ A / A_min.

**Proof**:

1. Grid area = A (finite)
2. Rectangles disjoint (proven above)
3. Each rectangle area ≥ A_min
4. R × A_min ≤ A
5. Therefore: **R ≤ A / A_min**

**Implication**: Exponential O(4^n) geometrically impossible.

**Example**: 10^6 cell grid → max 10^6 rectangles, not 4^100 ≈ 10^60

**Empirical**: 100 pathological inserts → 232 ranges (2.3x), not 4^100

**Conclusion**: Practical O(n) rectangles after n inserts.

∎

---

## Geometry

### Rectangle Format

**Standard**: `[xmin, ymin, xmax, ymax]` per ISO 19107:2019 (x=columns, y=rows)

**Layered Architecture**:

- **Core**: `Rectangle` with closed intervals `[min, max]`
- **Adapters**: Convert external API types (GridRange, A1) to Rectangle

| Layer                  | Format                | Example: Rows 0-9           |
| ---------------------- | --------------------- | --------------------------- |
| Core (implementations) | Rectangle (closed)    | `[0, 0, 9, 9]`              |
| Adapter (GridRange)    | GridRange (half-open) | `{startRow: 0, endRow: 10}` |
| Adapter (A1)           | A1 notation           | `"A1:J10"`                  |

**Conversion**: GridRange ⟷ Rectangle via `±1` on end coordinates. `undefined` → `±∞`.

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

**Inclusive intervals** `[min, max]`:

- **Top**: `[a.xmin, a.ymin, a.xmax, b.ymin-1]`
- **Bottom**: `[a.xmin, b.ymax+1, a.xmax, a.ymax]`
- **Left**: `[a.xmin, max(a.ymin,b.ymin), b.xmin-1, min(a.ymax,b.ymax)]`
- **Right**: `[b.xmax+1, max(a.ymin,b.ymin), a.xmax, min(a.ymax,b.ymax)]`

**Half-open intervals** `[min, max)`: No `±1` adjustments needed (end already exclusive).

## Testing

**Axioms** (must hold ∀ implementations):

1. **Non-duplication**: No identical (bounds, value) pairs
2. **Last-writer-wins**: Insertion order matters for overlaps
3. **Disjointness**: No overlapping rectangles (maintained after each operation)
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
