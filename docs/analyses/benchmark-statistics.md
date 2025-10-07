# Benchmark Analysis Results

**Date**: 2025-10-07T20:13:09.151Z
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

| Implementation          | Wins | Win Rate | Avg Time (µs) |
| ----------------------- | ---- | -------- | ------------- |
| mortonlinearscan        | 14   | 40%      | 15515.8       |
| rtree                   | 11   | 31%      | 1405.5        |
| compactmortonlinearscan | 10   | 29%      | 15098.1       |

### Statistical Quality

| Implementation          | Avg CV% | Max CV% | Status    |
| ----------------------- | ------- | ------- | --------- |
| compactmortonlinearscan | 0.91    | 2.44    | ✅ Stable |
| mortonlinearscan        | 1.25    | 4.24    | ✅ Stable |
| rtree                   | 1.04    | 2.64    | ✅ Stable |

## Detailed Results

### mixed: large-overlapping (n=500) 80/20

| Implementation            | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------------- | --------- | ------- | --- | --------- |
| compactmortonlinearscan ✓ | 859.4     | ±7.1    | 0.8 | (fastest) |
| mortonlinearscan          | 899.5     | ±8.4    | 0.9 | 1.05x     |
| rtree                     | 1178.1    | ±9.8    | 0.8 | 1.37x     |

### mixed: large-sequential (n=1000) 80/20

| Implementation          | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------------- | --------- | ------- | --- | --------- |
| rtree ✓                 | 818.4     | ±3.1    | 0.4 | (fastest) |
| mortonlinearscan        | 2042.9    | ±30.8   | 1.5 | 2.50x     |
| compactmortonlinearscan | 2060.4    | ±6.7    | 0.3 | 2.52x     |

### mixed: sparse-overlapping (n=40) 80/20

| Implementation          | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------------- | --------- | ------- | --- | --------- |
| mortonlinearscan ✓      | 11.0      | ±0.1    | 1.3 | (fastest) |
| compactmortonlinearscan | 11.6      | ±0.1    | 1.2 | 1.06x     |
| rtree                   | 71.3      | ±0.5    | 0.7 | 6.49x     |

### mixed: sparse-sequential (n=50) 80/20

| Implementation          | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------------- | --------- | ------- | --- | --------- |
| mortonlinearscan ✓      | 7.1       | ±0.0    | 0.6 | (fastest) |
| compactmortonlinearscan | 7.7       | ±0.0    | 0.5 | 1.09x     |
| rtree                   | 21.8      | ±0.2    | 0.7 | 3.08x     |

### query-only: large (n=5000, 10k queries)

| Implementation          | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------------- | --------- | ------- | --- | --------- |
| rtree ✓                 | 13787.6   | ±46.3   | 0.3 | (fastest) |
| compactmortonlinearscan | 400901.1  | ±5429.6 | 1.4 | 29.08x    |
| mortonlinearscan        | 407506.2  | ±6136.8 | 1.5 | 29.56x    |

### query-only: overlapping (n=1000, 10k queries)

| Implementation          | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------------- | --------- | ------- | --- | --------- |
| rtree ✓                 | 15272.1   | ±161.2  | 1.1 | (fastest) |
| compactmortonlinearscan | 44891.3   | ±1097.3 | 2.4 | 2.94x     |
| mortonlinearscan        | 49216.9   | ±1671.5 | 3.4 | 3.22x     |

### query-only: sequential (n=1000, 10k queries)

| Implementation          | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------------- | --------- | ------- | --- | --------- |
| rtree ✓                 | 1116.8    | ±10.5   | 0.9 | (fastest) |
| mortonlinearscan        | 27416.8   | ±171.5  | 0.6 | 24.55x    |
| compactmortonlinearscan | 28496.2   | ±214.9  | 0.8 | 25.52x    |

### read: column-operations (n=20) + 100 queries

| Implementation          | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------------- | --------- | ------- | --- | --------- |
| mortonlinearscan ✓      | 7.9       | ±0.2    | 2.4 | (fastest) |
| compactmortonlinearscan | 11.5      | ±0.1    | 1.1 | 1.45x     |
| rtree                   | 13.6      | ±0.1    | 0.9 | 1.71x     |

### read: diagonal-selection (n=30) + 100 queries

| Implementation            | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------------- | --------- | ------- | --- | --------- |
| compactmortonlinearscan ✓ | 21.1      | ±0.2    | 1.0 | (fastest) |
| mortonlinearscan          | 21.3      | ±0.1    | 0.7 | 1.01x     |
| rtree                     | 40.3      | ±0.2    | 0.4 | 1.91x     |

### read: large-grid (n=2500) + 100 queries

| Implementation          | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------------- | --------- | ------- | --- | --------- |
| rtree ✓                 | 2011.2    | ±9.2    | 0.5 | (fastest) |
| compactmortonlinearscan | 8933.0    | ±44.4   | 0.5 | 4.44x     |
| mortonlinearscan        | 12112.6   | ±128.5  | 1.1 | 6.02x     |

### read: large-overlapping (n=1250) + 100 queries

| Implementation          | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------------- | --------- | ------- | --- | --------- |
| rtree ✓                 | 3193.7    | ±19.6   | 0.6 | (fastest) |
| compactmortonlinearscan | 5704.1    | ±60.9   | 1.1 | 1.79x     |
| mortonlinearscan        | 5779.6    | ±25.3   | 0.4 | 1.81x     |

### read: large-ranges (n=500) + 100 queries

| Implementation          | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------------- | --------- | ------- | --- | --------- |
| rtree ✓                 | 1088.6    | ±12.6   | 1.2 | (fastest) |
| mortonlinearscan        | 1152.5    | ±12.4   | 1.1 | 1.06x     |
| compactmortonlinearscan | 1201.8    | ±7.0    | 0.6 | 1.10x     |

### read: large-sequential (n=2500) + 100 queries

| Implementation          | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------------- | --------- | ------- | --- | --------- |
| rtree ✓                 | 2008.2    | ±13.4   | 0.7 | (fastest) |
| mortonlinearscan        | 9759.8    | ±68.2   | 0.7 | 4.86x     |
| compactmortonlinearscan | 10637.3   | ±50.5   | 0.5 | 5.30x     |

### read: merge-like-blocks (n=15) + 100 queries

| Implementation          | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------------- | --------- | ------- | --- | --------- |
| mortonlinearscan ✓      | 5.3       | ±0.0    | 0.5 | (fastest) |
| compactmortonlinearscan | 5.7       | ±0.0    | 0.5 | 1.09x     |
| rtree                   | 5.8       | ±0.1    | 1.0 | 1.10x     |

### read: row-operations (n=20) + 100 queries

| Implementation          | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------------- | --------- | ------- | --- | --------- |
| mortonlinearscan ✓      | 6.5       | ±0.3    | 4.2 | (fastest) |
| compactmortonlinearscan | 7.3       | ±0.0    | 0.5 | 1.14x     |
| rtree                   | 8.0       | ±0.1    | 0.9 | 1.24x     |

### read: single-cell-edits (n=50) + 100 queries

| Implementation            | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------------- | --------- | ------- | --- | --------- |
| compactmortonlinearscan ✓ | 15.7      | ±0.1    | 0.4 | (fastest) |
| mortonlinearscan          | 15.9      | ±0.1    | 0.9 | 1.01x     |
| rtree                     | 17.6      | ±0.1    | 0.8 | 1.12x     |

### read: sparse-grid (n=60) + 100 queries

| Implementation            | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------------- | --------- | ------- | --- | --------- |
| compactmortonlinearscan ✓ | 20.2      | ±0.0    | 0.2 | (fastest) |
| rtree                     | 25.2      | ±0.3    | 1.3 | 1.25x     |
| mortonlinearscan          | 25.7      | ±0.2    | 0.6 | 1.28x     |

### read: sparse-large-ranges (n=30) + 100 queries

| Implementation          | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------------- | --------- | ------- | --- | --------- |
| mortonlinearscan ✓      | 8.0       | ±0.0    | 0.5 | (fastest) |
| compactmortonlinearscan | 8.5       | ±0.1    | 0.6 | 1.07x     |
| rtree                   | 15.0      | ±0.2    | 1.4 | 1.89x     |

### read: sparse-overlapping (n=40) + 100 queries

| Implementation            | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------------- | --------- | ------- | --- | --------- |
| compactmortonlinearscan ✓ | 18.2      | ±0.2    | 0.9 | (fastest) |
| mortonlinearscan          | 19.2      | ±0.2    | 0.9 | 1.05x     |
| rtree                     | 71.2      | ±0.1    | 0.2 | 3.91x     |

### read: sparse-sequential (n=50) + 100 queries

| Implementation            | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------------- | --------- | ------- | --- | --------- |
| compactmortonlinearscan ✓ | 15.8      | ±0.1    | 0.6 | (fastest) |
| mortonlinearscan          | 18.0      | ±0.1    | 0.7 | 1.14x     |
| rtree                     | 22.3      | ±0.2    | 1.1 | 1.41x     |

### read: striping-alternating-rows (n=25) + 100 queries

| Implementation          | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------------- | --------- | ------- | --- | --------- |
| mortonlinearscan ✓      | 7.2       | ±0.3    | 3.8 | (fastest) |
| compactmortonlinearscan | 8.0       | ±0.0    | 0.3 | 1.11x     |
| rtree                   | 9.2       | ±0.0    | 0.3 | 1.27x     |

### write: column-operations (n=20)

| Implementation          | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------------- | --------- | ------- | --- | --------- |
| mortonlinearscan ✓      | 1.4       | ±0.0    | 2.0 | (fastest) |
| compactmortonlinearscan | 1.5       | ±0.0    | 1.4 | 1.02x     |
| rtree                   | 5.8       | ±0.1    | 2.5 | 4.06x     |

### write: diagonal-selection (n=30)

| Implementation            | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------------- | --------- | ------- | --- | --------- |
| compactmortonlinearscan ✓ | 6.3       | ±0.1    | 1.8 | (fastest) |
| mortonlinearscan          | 6.8       | ±0.2    | 2.4 | 1.08x     |
| rtree                     | 36.5      | ±0.5    | 1.4 | 5.76x     |

### write: large-grid (n=2500)

| Implementation          | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------------- | --------- | ------- | --- | --------- |
| rtree ✓                 | 1957.0    | ±11.2   | 0.6 | (fastest) |
| compactmortonlinearscan | 8257.4    | ±59.5   | 0.7 | 4.22x     |
| mortonlinearscan        | 11470.2   | ±72.6   | 0.6 | 5.86x     |

### write: large-overlapping (n=1250)

| Implementation          | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------------- | --------- | ------- | --- | --------- |
| rtree ✓                 | 3163.0    | ±44.3   | 1.4 | (fastest) |
| compactmortonlinearscan | 5288.2    | ±101.4  | 1.9 | 1.67x     |
| mortonlinearscan        | 5372.9    | ±20.6   | 0.4 | 1.70x     |

### write: large-ranges (n=500)

| Implementation          | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------------- | --------- | ------- | --- | --------- |
| mortonlinearscan ✓      | 852.5     | ±1.4    | 0.2 | (fastest) |
| compactmortonlinearscan | 894.4     | ±9.8    | 1.1 | 1.05x     |
| rtree                   | 1083.4    | ±12.1   | 1.1 | 1.27x     |

### write: large-sequential (n=2500)

| Implementation          | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------------- | --------- | ------- | --- | --------- |
| rtree ✓                 | 2001.2    | ±35.7   | 1.8 | (fastest) |
| mortonlinearscan        | 9274.1    | ±94.9   | 1.0 | 4.63x     |
| compactmortonlinearscan | 10113.8   | ±79.7   | 0.8 | 5.05x     |

### write: merge-like-blocks (n=15)

| Implementation            | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------------- | --------- | ------- | --- | --------- |
| compactmortonlinearscan ✓ | 1.0       | ±0.0    | 1.3 | (fastest) |
| mortonlinearscan          | 1.1       | ±0.0    | 1.5 | 1.11x     |
| rtree                     | 3.3       | ±0.1    | 2.0 | 3.39x     |

### write: row-operations (n=20)

| Implementation          | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------------- | --------- | ------- | --- | --------- |
| mortonlinearscan ✓      | 1.5       | ±0.0    | 1.5 | (fastest) |
| compactmortonlinearscan | 1.6       | ±0.0    | 1.3 | 1.02x     |
| rtree                   | 5.8       | ±0.1    | 1.5 | 3.77x     |

### write: single-cell-edits (n=50)

| Implementation            | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------------- | --------- | ------- | --- | --------- |
| compactmortonlinearscan ✓ | 5.4       | ±0.1    | 1.1 | (fastest) |
| mortonlinearscan          | 5.4       | ±0.0    | 0.9 | 1.00x     |
| rtree                     | 15.7      | ±0.4    | 2.6 | 2.91x     |

### write: sparse-grid (n=60)

| Implementation          | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------------- | --------- | ------- | --- | --------- |
| mortonlinearscan ✓      | 7.4       | ±0.0    | 0.5 | (fastest) |
| compactmortonlinearscan | 7.9       | ±0.0    | 0.2 | 1.06x     |
| rtree                   | 20.7      | ±0.2    | 1.1 | 2.79x     |

### write: sparse-large-ranges (n=30)

| Implementation          | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------------- | --------- | ------- | --- | --------- |
| mortonlinearscan ✓      | 2.4       | ±0.0    | 0.8 | (fastest) |
| compactmortonlinearscan | 2.4       | ±0.0    | 0.6 | 1.00x     |
| rtree                   | 9.4       | ±0.1    | 0.9 | 3.85x     |

### write: sparse-overlapping (n=40)

| Implementation            | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------------- | --------- | ------- | --- | --------- |
| compactmortonlinearscan ✓ | 9.3       | ±0.1    | 1.6 | (fastest) |
| mortonlinearscan          | 9.5       | ±0.2    | 2.0 | 1.03x     |
| rtree                     | 68.1      | ±0.5    | 0.7 | 7.36x     |

### write: sparse-sequential (n=50)

| Implementation          | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------------- | --------- | ------- | --- | --------- |
| mortonlinearscan ✓      | 6.1       | ±0.0    | 0.4 | (fastest) |
| compactmortonlinearscan | 6.5       | ±0.0    | 0.7 | 1.07x     |
| rtree                   | 19.4      | ±0.2    | 0.9 | 3.17x     |

### write: striping-alternating-rows (n=25)

| Implementation          | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------------- | --------- | ------- | --- | --------- |
| mortonlinearscan ✓      | 2.1       | ±0.0    | 1.2 | (fastest) |
| compactmortonlinearscan | 2.2       | ±0.0    | 1.2 | 1.04x     |
| rtree                   | 7.6       | ±0.1    | 1.4 | 3.66x     |

---

**Note**: CV% (Coefficient of Variation) measures result stability. Lower is better (< 5% = stable).
