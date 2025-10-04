# Benchmark Analysis Results

**Date**: 2025-10-07T05:49:28.704Z
**Runs**: 5
**Method**: Statistical analysis (mean ± stddev, CV%)

## Methodology

**Sample Size**: 5 runs per scenario (each run = mean of Deno's 10-100 internal iterations) → **50-500 total iterations**

**Metrics**:

- **Mean (μ)**: Average performance
- **Std Dev (σ)**: Absolute variability
- **CV%**: `(σ/μ) × 100` - normalized variability (<5% = stable ✅, >5% = variable ⚠️)
- **95% CI**: `μ ± 1.96(σ/√5)` - typically ±2-4% of mean for stable results

**Practical Significance Threshold**: Report differences **>10%** with CV% <5% (both large effect size AND stable measurement). All major findings show >20% differences, well above noise.

**Why effect size over p-values?** Microbenchmarks prioritize magnitude (2x faster matters, 2% doesn't) over statistical hypothesis testing. We measure effect size and stability, not statistical significance (which would require hypothesis tests we don't perform).

**Reproducibility**: `deno task bench:analyze 5 docs/analyses/benchmark-statistics.md` regenerates. Expect ±10-20% absolute variance across systems, but relative rankings stable.

---

## Summary

**Implementations**: 3
**Scenarios**: 35
**Total Data Points**: 105

### Performance Rankings

| Implementation    | Wins | Win Rate | Avg Time (µs) |
| ----------------- | ---- | -------- | ------------- |
| hilbertlinearscan | 22   | 63%      | 13143.9       |
| rtree             | 11   | 31%      | 1348.2        |
| compactlinearscan | 2    | 6%       | 36224.2       |

### Statistical Quality

| Implementation    | Avg CV% | Max CV% | Status    |
| ----------------- | ------- | ------- | --------- |
| compactlinearscan | 1.18    | 2.58    | ✅ Stable |
| hilbertlinearscan | 1.46    | 3.80    | ✅ Stable |
| rtree             | 1.23    | 3.78    | ✅ Stable |

## Detailed Results

### mixed: large-overlapping (n=500) 80/20

| Implementation      | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------- | --------- | ------- | --- | --------- |
| hilbertlinearscan ✓ | 658.9     | ±15.0   | 2.3 | (fastest) |
| rtree               | 1123.8    | ±11.7   | 1.0 | 1.71x     |
| compactlinearscan   | 2436.3    | ±40.3   | 1.7 | 3.70x     |

### mixed: large-sequential (n=1000) 80/20

| Implementation    | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------- | --------- | ------- | --- | --------- |
| rtree ✓           | 787.3     | ±13.2   | 1.7 | (fastest) |
| hilbertlinearscan | 1636.4    | ±37.3   | 2.3 | 2.08x     |
| compactlinearscan | 7710.7    | ±134.0  | 1.7 | 9.79x     |

### mixed: sparse-overlapping (n=40) 80/20

| Implementation      | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------- | --------- | ------- | --- | --------- |
| compactlinearscan ✓ | 17.6      | ±0.4    | 2.3 | (fastest) |
| hilbertlinearscan   | 17.9      | ±0.7    | 3.8 | 1.01x     |
| rtree               | 68.6      | ±1.3    | 1.9 | 3.90x     |

### mixed: sparse-sequential (n=50) 80/20

| Implementation      | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------- | --------- | ------- | --- | --------- |
| hilbertlinearscan ✓ | 7.5       | ±0.1    | 1.0 | (fastest) |
| compactlinearscan   | 17.0      | ±0.3    | 1.5 | 2.28x     |
| rtree               | 21.1      | ±0.7    | 3.3 | 2.83x     |

### query-only: large (n=5000, 10k queries)

| Implementation    | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------- | --------- | ------- | --- | --------- |
| rtree ✓           | 13115.9   | ±97.0   | 0.7 | (fastest) |
| hilbertlinearscan | 349786.5  | ±6934.3 | 2.0 | 26.67x    |
| compactlinearscan | 845696.7  | ±4232.6 | 0.5 | 64.48x    |

### query-only: overlapping (n=1000, 10k queries)

| Implementation    | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------- | --------- | ------- | --- | --------- |
| rtree ✓           | 14920.1   | ±361.8  | 2.4 | (fastest) |
| hilbertlinearscan | 42179.5   | ±602.6  | 1.4 | 2.83x     |
| compactlinearscan | 109397.5  | ±1948.3 | 1.8 | 7.33x     |

### query-only: sequential (n=1000, 10k queries)

| Implementation    | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------- | --------- | ------- | --- | --------- |
| rtree ✓           | 1074.7    | ±19.1   | 1.8 | (fastest) |
| hilbertlinearscan | 22893.2   | ±513.9  | 2.2 | 21.30x    |
| compactlinearscan | 86751.0   | ±1414.6 | 1.6 | 80.72x    |

### read: column-operations (n=20) + 100 queries

| Implementation      | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------- | --------- | ------- | --- | --------- |
| hilbertlinearscan ✓ | 8.7       | ±0.3    | 3.7 | (fastest) |
| rtree               | 12.8      | ±0.1    | 1.2 | 1.47x     |
| compactlinearscan   | 22.2      | ±0.4    | 1.9 | 2.56x     |

### read: diagonal-selection (n=30) + 100 queries

| Implementation      | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------- | --------- | ------- | --- | --------- |
| hilbertlinearscan ✓ | 22.7      | ±0.2    | 1.1 | (fastest) |
| rtree               | 38.7      | ±0.3    | 0.7 | 1.70x     |
| compactlinearscan   | 55.7      | ±0.5    | 0.9 | 2.45x     |

### read: large-grid (n=2500) + 100 queries

| Implementation    | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------- | --------- | ------- | --- | --------- |
| rtree ✓           | 1886.8    | ±17.3   | 0.9 | (fastest) |
| hilbertlinearscan | 9399.9    | ±56.4   | 0.6 | 4.98x     |
| compactlinearscan | 49386.1   | ±244.3  | 0.5 | 26.18x    |

### read: large-overlapping (n=1250) + 100 queries

| Implementation    | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------- | --------- | ------- | --- | --------- |
| rtree ✓           | 3047.4    | ±29.5   | 1.0 | (fastest) |
| hilbertlinearscan | 3690.0    | ±57.9   | 1.6 | 1.21x     |
| compactlinearscan | 17128.8   | ±134.5  | 0.8 | 5.62x     |

### read: large-ranges (n=500) + 100 queries

| Implementation    | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------- | --------- | ------- | --- | --------- |
| rtree ✓           | 1039.8    | ±4.1    | 0.4 | (fastest) |
| hilbertlinearscan | 1178.3    | ±2.8    | 0.2 | 1.13x     |
| compactlinearscan | 4128.6    | ±56.1   | 1.4 | 3.97x     |

### read: large-sequential (n=2500) + 100 queries

| Implementation    | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------- | --------- | ------- | --- | --------- |
| rtree ✓           | 1899.2    | ±11.2   | 0.6 | (fastest) |
| hilbertlinearscan | 7844.9    | ±90.6   | 1.2 | 4.13x     |
| compactlinearscan | 42110.4   | ±624.7  | 1.5 | 22.17x    |

### read: merge-like-blocks (n=15) + 100 queries

| Implementation      | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------- | --------- | ------- | --- | --------- |
| hilbertlinearscan ✓ | 4.4       | ±0.0    | 0.7 | (fastest) |
| rtree               | 5.4       | ±0.0    | 0.6 | 1.23x     |
| compactlinearscan   | 18.6      | ±0.3    | 1.8 | 4.21x     |

### read: row-operations (n=20) + 100 queries

| Implementation      | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------- | --------- | ------- | --- | --------- |
| hilbertlinearscan ✓ | 5.8       | ±0.0    | 0.8 | (fastest) |
| rtree               | 7.6       | ±0.1    | 1.1 | 1.32x     |
| compactlinearscan   | 17.0      | ±0.1    | 0.7 | 2.95x     |

### read: single-cell-edits (n=50) + 100 queries

| Implementation      | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------- | --------- | ------- | --- | --------- |
| hilbertlinearscan ✓ | 16.3      | ±0.1    | 0.7 | (fastest) |
| rtree               | 16.6      | ±0.1    | 0.9 | 1.02x     |
| compactlinearscan   | 48.3      | ±0.6    | 1.1 | 2.97x     |

### read: sparse-grid (n=60) + 100 queries

| Implementation      | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------- | --------- | ------- | --- | --------- |
| hilbertlinearscan ✓ | 20.5      | ±0.1    | 0.7 | (fastest) |
| rtree               | 23.9      | ±0.1    | 0.6 | 1.17x     |
| compactlinearscan   | 87.4      | ±0.6    | 0.7 | 4.26x     |

### read: sparse-large-ranges (n=30) + 100 queries

| Implementation      | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------- | --------- | ------- | --- | --------- |
| hilbertlinearscan ✓ | 8.8       | ±0.3    | 3.1 | (fastest) |
| rtree               | 14.1      | ±0.1    | 0.6 | 1.59x     |
| compactlinearscan   | 26.0      | ±0.2    | 0.8 | 2.94x     |

### read: sparse-overlapping (n=40) + 100 queries

| Implementation      | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------- | --------- | ------- | --- | --------- |
| hilbertlinearscan ✓ | 24.0      | ±0.5    | 2.2 | (fastest) |
| compactlinearscan   | 46.8      | ±0.3    | 0.7 | 1.95x     |
| rtree               | 67.5      | ±0.4    | 0.5 | 2.81x     |

### read: sparse-sequential (n=50) + 100 queries

| Implementation      | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------- | --------- | ------- | --- | --------- |
| hilbertlinearscan ✓ | 16.5      | ±0.3    | 1.9 | (fastest) |
| rtree               | 21.1      | ±0.1    | 0.3 | 1.28x     |
| compactlinearscan   | 46.2      | ±1.2    | 2.6 | 2.80x     |

### read: striping-alternating-rows (n=25) + 100 queries

| Implementation      | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------- | --------- | ------- | --- | --------- |
| hilbertlinearscan ✓ | 7.1       | ±0.1    | 0.7 | (fastest) |
| rtree               | 8.7       | ±0.1    | 0.9 | 1.22x     |
| compactlinearscan   | 20.7      | ±0.1    | 0.6 | 2.90x     |

### write: column-operations (n=20)

| Implementation      | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------- | --------- | ------- | --- | --------- |
| hilbertlinearscan ✓ | 2.0       | ±0.0    | 1.7 | (fastest) |
| compactlinearscan   | 2.3       | ±0.0    | 1.9 | 1.16x     |
| rtree               | 5.4       | ±0.1    | 2.3 | 2.69x     |

### write: diagonal-selection (n=30)

| Implementation      | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------- | --------- | ------- | --- | --------- |
| hilbertlinearscan ✓ | 11.0      | ±0.1    | 0.9 | (fastest) |
| compactlinearscan   | 11.1      | ±0.1    | 1.2 | 1.02x     |
| rtree               | 34.2      | ±0.3    | 0.9 | 3.12x     |

### write: large-grid (n=2500)

| Implementation    | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------- | --------- | ------- | --- | --------- |
| rtree ✓           | 1873.4    | ±14.6   | 0.8 | (fastest) |
| hilbertlinearscan | 8907.1    | ±68.6   | 0.8 | 4.75x     |
| compactlinearscan | 45270.0   | ±446.6  | 1.0 | 24.16x    |

### write: large-overlapping (n=1250)

| Implementation    | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------- | --------- | ------- | --- | --------- |
| rtree ✓           | 3003.1    | ±22.8   | 0.8 | (fastest) |
| hilbertlinearscan | 3308.6    | ±56.8   | 1.7 | 1.10x     |
| compactlinearscan | 16023.7   | ±98.2   | 0.6 | 5.34x     |

### write: large-ranges (n=500)

| Implementation      | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------- | --------- | ------- | --- | --------- |
| hilbertlinearscan ✓ | 896.6     | ±3.6    | 0.4 | (fastest) |
| rtree               | 1031.2    | ±11.6   | 1.1 | 1.15x     |
| compactlinearscan   | 3325.2    | ±26.0   | 0.8 | 3.71x     |

### write: large-sequential (n=2500)

| Implementation    | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------- | --------- | ------- | --- | --------- |
| rtree ✓           | 1897.6    | ±16.5   | 0.9 | (fastest) |
| hilbertlinearscan | 7437.6    | ±139.7  | 1.9 | 3.92x     |
| compactlinearscan | 37974.8   | ±442.6  | 1.2 | 20.01x    |

### write: merge-like-blocks (n=15)

| Implementation      | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------- | --------- | ------- | --- | --------- |
| hilbertlinearscan ✓ | 1.3       | ±0.0    | 0.6 | (fastest) |
| compactlinearscan   | 1.7       | ±0.0    | 0.7 | 1.33x     |
| rtree               | 3.0       | ±0.0    | 1.2 | 2.34x     |

### write: row-operations (n=20)

| Implementation      | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------- | --------- | ------- | --- | --------- |
| hilbertlinearscan ✓ | 1.9       | ±0.0    | 1.2 | (fastest) |
| compactlinearscan   | 2.4       | ±0.0    | 1.1 | 1.27x     |
| rtree               | 5.4       | ±0.1    | 0.9 | 2.91x     |

### write: single-cell-edits (n=50)

| Implementation      | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------- | --------- | ------- | --- | --------- |
| hilbertlinearscan ✓ | 6.7       | ±0.1    | 1.2 | (fastest) |
| rtree               | 14.7      | ±0.4    | 2.6 | 2.21x     |
| compactlinearscan   | 15.6      | ±0.1    | 0.7 | 2.34x     |

### write: sparse-grid (n=60)

| Implementation      | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------- | --------- | ------- | --- | --------- |
| hilbertlinearscan ✓ | 8.7       | ±0.1    | 1.4 | (fastest) |
| compactlinearscan   | 17.9      | ±0.2    | 1.1 | 2.05x     |
| rtree               | 19.5      | ±0.2    | 1.1 | 2.23x     |

### write: sparse-large-ranges (n=30)

| Implementation      | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------- | --------- | ------- | --- | --------- |
| hilbertlinearscan ✓ | 3.0       | ±0.1    | 2.3 | (fastest) |
| compactlinearscan   | 5.1       | ±0.1    | 2.1 | 1.69x     |
| rtree               | 9.0       | ±0.3    | 3.8 | 2.96x     |

### write: sparse-overlapping (n=40)

| Implementation      | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------- | --------- | ------- | --- | --------- |
| compactlinearscan ✓ | 14.3      | ±0.1    | 0.9 | (fastest) |
| hilbertlinearscan   | 16.0      | ±0.2    | 1.0 | 1.12x     |
| rtree               | 64.8      | ±1.2    | 1.9 | 4.53x     |

### write: sparse-sequential (n=50)

| Implementation      | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------- | --------- | ------- | --- | --------- |
| hilbertlinearscan ✓ | 6.3       | ±0.0    | 0.6 | (fastest) |
| compactlinearscan   | 10.0      | ±0.1    | 0.7 | 1.57x     |
| rtree               | 18.2      | ±0.1    | 0.7 | 2.86x     |

### write: striping-alternating-rows (n=25)

| Implementation      | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------- | --------- | ------- | --- | --------- |
| hilbertlinearscan ✓ | 2.5       | ±0.0    | 1.4 | (fastest) |
| compactlinearscan   | 3.6       | ±0.0    | 0.4 | 1.46x     |
| rtree               | 7.1       | ±0.1    | 1.0 | 2.85x     |

---

**Note**: CV% (Coefficient of Variation) measures result stability. Lower is better (< 5% = stable).
