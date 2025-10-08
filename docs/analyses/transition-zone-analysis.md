# Transition Zone Analysis: O(n) → O(log n) Crossover Points

**Finding**: Crossover points where R-tree overtakes linear scan vary by workload and overlap pattern, ranging from n=100 to n=600.

**Source Experiment**: See [corrected-transition-analysis.md](../../archive/docs/experiments/corrected-transition-analysis.md) for full experimental details and methodology.

## Result

| Workload      | Pattern     | Crossover n | Linear Scan Advantage | R-tree Advantage |
| ------------- | ----------- | ----------- | --------------------- | ---------------- |
| Write-heavy   | Sequential  | 200         | n < 200               | n > 200          |
| Write-heavy   | Grid        | 100         | n < 100               | n > 100          |
| Write-heavy   | Overlapping | 600         | n < 600               | n > 600          |
| Read-heavy    | Sequential  | 100         | n < 100               | n > 100          |
| Read-heavy    | Grid        | 100         | n < 100               | n > 100          |
| Read-heavy    | Overlapping | 500         | n < 500               | n > 500          |
| Mixed (80/20) | Sequential  | 100         | n < 100               | n > 100          |
| Mixed (80/20) | Grid        | 100         | n < 100               | n > 100          |
| Mixed (80/20) | Overlapping | 600         | n < 600               | n > 600          |

**Impact**: Replaced vague "100-1000 is workload-dependent" with concrete decision thresholds. Enables data-driven implementation selection.

---

## Key Insights

### 1. Read-Heavy Favor R-trees Sooner

Crossover at n=100 for most read-heavy scenarios. R-tree query pruning (O(log n)) beats linear O(n).

Example at n=100: Linear 207µs vs R*-tree 65µs (3.2x)

### 2. Overlapping Delays Crossover

Crossover much later (n=500-600). Rectangle decomposition dominates cost regardless of storage.

Write-heavy: Linear wins at n=100 (97µs vs 326µs), loses at n=600 (2.5ms vs 2.0ms)

### 3. Sequential Shows Fastest Divergence

Minimal overlap = pure storage cost dominates.

- n=100: Linear 70µs, R-tree 94µs (linear 1.3x faster)
- n=200: Linear 290µs, R-tree 202µs (R-tree 1.4x faster)
- n=1000: Linear 6.5ms, R-tree 887µs (R-tree 7.3x faster)

---

## Practical Recommendations

### For Spreadsheet Properties (Real Use Case)

**Typical scenario**: n < 100 per property (backgrounds, borders, etc.)

**Recommendation**: Use `OptimizedLinearScanImpl` exclusively

**Rationale**: All crossover points occur at n ≥ 100, so sparse data always favors linear scan.

### For Consolidated or Heavy Usage

**Scenario**: Single index with many ranges (n > 100)

**Decision matrix**:

| Your Workload        | Your Pattern | Choose                        |
| -------------------- | ------------ | ----------------------------- |
| Mostly reads         | Any          | RStarTreeImpl                 |
| Mostly writes        | Low overlap  | RStarTreeImpl (n > 200)       |
| Mostly writes        | High overlap | OptimizedLinearScan (n < 600) |
| Mixed (read + write) | Low overlap  | RStarTreeImpl (n > 100)       |
| Mixed (read + write) | High overlap | Context-dependent             |

---

## Methodology

**Data sizes**: n = 100, 200, 300, ..., 1000 (10 points)

**Patterns**:

- Sequential: Low overlap, ranges in regular grid
- Grid: Medium overlap, 2D tiling pattern
- Overlapping: High overlap, ranges overlap 3-5 cells

**Workloads**:

- Write-heavy: Pure inserts (construction time)
- Read-heavy: Setup + 100 viewport queries
- Mixed: 80% inserts, 20% queries

**Implementations tested**:

- OptimizedLinearScanImpl (O(n) winner)
- RStarTreeImpl (O(log n) winner)
- ArrayBufferRTreeImpl (O(log n) fast variant)

**Statistical quality**: Single-run benchmarks with stable p75/p99 values (CV% < 10%)

---

## Validation

### Success Criteria

✅ All 90 scenarios (10 sizes × 3 patterns × 3 workloads)
✅ Clear crossover points per workload/pattern
✅ Low variance (p75/p99 within 1.5x)
✅ Quantified "workload-dependent" zone

### Limitations

Single-run data (clear trends, low variance). Discrete sampling every 100. Implementation-specific to OptimizedLinearScan vs R*-tree.

---

## Comparison to Prior Research

### Before This Analysis

| Data Size      | Recommendation          |
| -------------- | ----------------------- |
| n < 100        | OptimizedLinearScanImpl |
| 100 < n < 1000 | "Workload-dependent"    |
| n > 1000       | RStarTreeImpl           |

### After This Analysis

| Data Size | Workload    | Pattern     | Recommendation          |
| --------- | ----------- | ----------- | ----------------------- |
| n < 100   | All         | All         | OptimizedLinearScanImpl |
| n > 100   | Read-heavy  | All         | RStarTreeImpl           |
| n > 200   | Write-heavy | Sequential  | RStarTreeImpl           |
| n > 600   | Write-heavy | Overlapping | RStarTreeImpl           |
| n > 1000  | All         | All         | RStarTreeImpl           |

**Impact**: Transition zone refined from 900-value range to specific thresholds per scenario.

---

## References

- Previous analysis: [sparse-data-analysis.md](./sparse-data-analysis.md) (n < 100)
- R-tree algorithm: [r-star-analysis.md](./r-star-analysis.md)
- Benchmark data: [transition-zone-results.md](../active/experiments/transition-zone-results.md)
- Implementation: [benchmarks/transition-zone.ts](../../benchmarks/transition-zone.ts)

---

**Conclusion**: The O(n) vs O(log n) crossover depends on workload and overlap. For the primary use case (sparse spreadsheet properties with n < 100), linear scan wins universally. For consolidated indices, choose based on workload: read-heavy favors R-tree at n > 100, write-heavy with high overlap favors linear scan until n > 600.
