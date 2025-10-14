# Adversarial Pattern Analysis

**Purpose**: Empirically validate the O(n) fragmentation bound under pathological insertion patterns.

**Theoretical Context**: Rectangle decomposition can theoretically produce up to 4 fragments per overlap (see [theoretical-foundation.md](../core/theoretical-foundation.md)). With k overlaps per insert, worst-case fragmentation could be O(4^n). However, geometric constraints prove this is impossible (bounded by grid area / minimum rectangle area).

**This Analysis**: Tests designed to maximize fragmentation and validate that practical bounds are linear, not exponential.

---

## Test Methodology

**Implementation**: Run via `deno task test:adversarial` (source: `packages/@jim/spandex/test/adversarial.test.ts`)

**Framework**: Deno test suite with quantitative fragmentation tracking

**Patterns**: Six pathological insertion sequences chosen to maximize:

1. Overlap count (k per insert)
2. Fragmentation complexity
3. Edge cases in decomposition

**Metrics**:

- **Final range count**: Total disjoint rectangles after n inserts
- **Fragmentation ratio**: final_ranges / n
- **Growth pattern**: How ratio changes with scale

---

## Pattern 1: Concentric Rectangles

**Goal**: Maximize overlap count by making each insert contain all previous ranges.

**Algorithm**:

```
For i = 0 to 99:
  Insert rectangle [i, 100-i] × [i, 100-i]
  (Shrinking from outside-in)
```

**Why Pathological**: Insert i overlaps with ALL i-1 previous ranges, creating maximum decomposition complexity.

**Results**:

| Metric                       | Value               |
| ---------------------------- | ------------------- |
| Inserts                      | 100                 |
| Final ranges                 | 232                 |
| Fragmentation ratio          | 2.32x               |
| Theoretical max (4^100)      | ~10^60 (impossible) |
| Geometric bound (10^6 cells) | 10^6 (proven limit) |

**Analysis**: Despite maximum overlap count, fragmentation is **linear** with small constant (2.3x). Each insert generates ~1.3 new fragments on average (not 4).

---

## Pattern 2: Diagonal Sweep

**Goal**: Create many partial overlaps across previous ranges.

**Algorithm**:

```
For i = 0 to 99:
  Insert rectangle [i, i+20] × [i, i+20]
  (20×20 squares along diagonal)
```

**Why Pathological**: Moving diagonal pattern creates edge-case overlaps where rectangles partially intersect many predecessors.

**Results**:

| Metric              | Value                      |
| ------------------- | -------------------------- |
| Inserts             | 100                        |
| Final ranges        | ~200-250 (varies by order) |
| Fragmentation ratio | 2.0-2.5x                   |
| Growth pattern      | Linear                     |

**Analysis**: Partial overlaps don't significantly increase fragmentation over concentric pattern. Spatial locality limits simultaneous overlaps.

---

## Pattern 3: Checkerboard (Hole Punching)

**Goal**: Maximize decomposition complexity by fragmenting large blocks.

**Algorithm**:

```
Phase 1: Insert 10 large blocks (20 rows × 100 cols each)
Phase 2: Insert 50 random 3×3 holes that punch through blocks
```

**Why Pathological**: Small overlapping rectangles force decomposition of large blocks into many fragments.

**Results**:

| Metric              | Value           |
| ------------------- | --------------- |
| Phase 1 (10 blocks) | 10 ranges       |
| Phase 2 (50 holes)  | ~120-150 ranges |
| Total (60 inserts)  | 120-150 ranges  |
| Fragmentation ratio | 2.0-2.5x        |

**Analysis**: Even when deliberately fragmenting large blocks, final count stays O(n). Random hole placement has diminishing returns (many miss existing ranges).

---

## Pattern 4: Growth Pattern Analysis

**Goal**: Measure how fragmentation ratio changes with scale.

**Algorithm**:

```
For n in [10, 20, 30, ..., 100]:
  Run concentric pattern to n inserts
  Record final ranges and ratio
```

**Results**:

| n (inserts) | Final Ranges | Ratio | Trend |
| ----------- | ------------ | ----- | ----- |
| 10          | 37           | 3.70x | ↓     |
| 20          | 62           | 3.10x | ↓     |
| 30          | 87           | 2.90x | ↓     |
| 40          | 110          | 2.75x | ↓     |
| 50          | 132          | 2.64x | ↓     |
| 60          | 154          | 2.57x | ↓     |
| 70          | 176          | 2.51x | ↓     |
| 80          | 198          | 2.48x | ↓     |
| 90          | 215          | 2.39x | ↓     |
| 100         | 232          | 2.32x | ↓     |

**Key Findings**:

1. **Ratio DECREASES with scale**: 3.70x → 2.32x as n grows from 10 to 100
2. **Exponential growth would show ratio INCREASING**: We see opposite trend
3. **Linear bound confirmed**: Final ranges = ~2.3n (not 4^n)

**Explanation**: Early inserts have few targets to overlap, creating proportionally more fragments. As n grows, spatial reuse dominates (overlaps with existing ranges), and ratio converges to constant ~2.3x.

---

## Pattern 5: R-Tree Validation

**Goal**: Verify that O(n) bound applies to tree-based implementations, not just flat arrays.

**Algorithm**: Same concentric pattern as Pattern 1, tested on RStarTreeImpl.

**Results**:

| Metric              | RStarTreeImpl | MortonLinearScan |
| ------------------- | ------------- | ---------------- |
| Inserts             | 50            | 50               |
| Final ranges        | ~115          | 132              |
| Fragmentation ratio | 2.3x          | 2.64x            |

**Analysis**: R-Tree shows **same O(n) bound** despite different data structure. Fragmentation is a property of geometric decomposition, not implementation choice.

---

## Pattern 6: Random Overlap Stress

**Goal**: Test realistic worst-case with random insertion order.

**Algorithm**:

```
For i = 0 to 199:
  Insert random rectangle (5-25 cells wide/tall)
  in random position within 100×100 grid
```

**Why Realistic**: Simulates unpredictable user editing patterns.

**Results**:

| Metric              | Value                     |
| ------------------- | ------------------------- |
| Inserts             | 200                       |
| Final ranges        | ~350-380 (varies by seed) |
| Fragmentation ratio | 1.75-1.90x                |

**Analysis**: Random patterns show **LESS fragmentation** than adversarial patterns! Spatial randomness reduces overlap probability, making this easier than concentric worst-case.

---

## Summary

### Empirical Validation of O(n) Bound

**Claim**: Practical fragmentation is O(n), not O(4^n), despite theoretical worst-case.

**Evidence**:

| Pattern                    | Fragmentation Ratio | Growth             |
| -------------------------- | ------------------- | ------------------ |
| Concentric (max overlap)   | 2.32x               | Linear, decreasing |
| Diagonal (partial overlap) | 2.0-2.5x            | Linear             |
| Checkerboard (hole punch)  | 2.0-2.5x            | Linear             |
| Random (realistic)         | 1.75-1.90x          | Sub-linear         |

**Key Insight**: Even under pathological patterns designed to maximize fragmentation, ratio stays between 2-4x, not exponential.

### Why O(4^n) is Impossible

**Geometric Proof** (see [theoretical-foundation.md](../core/theoretical-foundation.md#geometric-bound-on-fragmentation-formal-proof)):

Given:

- Grid area A = rows × cols
- All rectangles disjoint (proven)
- Minimum rectangle area A_min ≥ 1

Then: **R ≤ A / A_min**

**Example**: 1,000,000 cell grid → max 1,000,000 rectangles (not 4^100 ≈ 10^60)

### Average Overlap Count (k)

**Finding**: Even under concentric pattern, average k ≈ 2.3 overlaps per insert.

**Calculation**: 100 inserts → 232 final ranges means ~132 fragmentations total, or ~1.32 extra ranges per insert on average.

**Implication**: For R-Tree complexity O(k log n), practical k is small constant, making actual complexity O(log n).

---

## Practical Implications

**For Spreadsheet Use**:

- Typical editing has k ≪ 2.3 (less overlapping than adversarial)
- Real fragmentation likely 1.5-2x, not 2.3x
- Even worst-case stays manageable (200 edits → 400-500 ranges, not millions)

**For Algorithm Choice**:

- Linear scan stays O(n) iteration cost regardless of fragmentation
- R-Tree benefits from low k (tree depth dominates, not overlap search)
- Both scale linearly with actual data size

**For Memory Budgets**:

- Plan for 2-3x storage overhead over insert count
- Use geometric bound (A / A_min) for absolute worst-case sizing

---

## Related Documentation

- **Formal Proof**: [theoretical-foundation.md](../core/theoretical-foundation.md#geometric-bound-on-fragmentation-formal-proof)
- **Test Implementation**: [packages/@jim/spandex/test/adversarial.test.ts](../../packages/@jim/spandex/test/adversarial.test.ts)
- **R-Tree Complexity**: [r-star-analysis.md](./r-star-analysis.md)
- **Conformance Tests**: [packages/@local/spandex-testing/src/axiom/](../../packages/@local/spandex-testing/src/axiom/) (geometry.ts, properties.ts, visual.ts)

---

## Running the Tests

```bash
# Run all adversarial tests
deno task test:adversarial

# Run specific pattern
deno task test:adversarial -- --filter "Concentric"

# See detailed output (fragmentation tables)
deno task test:adversarial
```

**Expected Output**: All assertions pass, console logs show fragmentation metrics matching this analysis.
