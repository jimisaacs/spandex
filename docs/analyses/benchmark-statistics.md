# Benchmark Analysis Results

**Date**: 2025-10-08T03:53:17.497Z
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

**Implementations**: 2
**Scenarios**: 35
**Total Data Points**: 70

### Performance Rankings

| Implementation   | Wins | Win Rate | Avg Time (µs) |
| ---------------- | ---- | -------- | ------------- |
| mortonlinearscan | 23   | 66%      | 14333.7       |
| rstartree        | 12   | 34%      | 1323.4        |

### Statistical Quality

| Implementation   | Avg CV% | Max CV% | Status      |
| ---------------- | ------- | ------- | ----------- |
| mortonlinearscan | 2.86    | 7.47    | ⚠️ Variable |
| rstartree        | 2.64    | 6.07    | ⚠️ Variable |

## Detailed Results

### mixed: large-overlapping (n=500) 80/20

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 800.4     | ±4.2    | 0.5 | (fastest) |
| rstartree          | 1133.2    | ±33.3   | 2.9 | 1.42x     |

### mixed: large-sequential (n=1000) 80/20

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 780.3     | ±4.3    | 0.6 | (fastest) |
| mortonlinearscan | 1953.0    | ±16.8   | 0.9 | 2.50x     |

### mixed: sparse-overlapping (n=40) 80/20

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 10.7      | ±0.3    | 3.2 | (fastest) |
| rstartree          | 67.2      | ±0.2    | 0.3 | 6.27x     |

### mixed: sparse-sequential (n=50) 80/20

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 7.0       | ±0.2    | 2.4 | (fastest) |
| rstartree          | 20.6      | ±0.1    | 0.3 | 2.96x     |

### query-only: large (n=5000, 10k queries)

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 13020.4   | ±55.8   | 0.4 | (fastest) |
| mortonlinearscan | 384393.4  | ±6665.4 | 1.7 | 29.52x    |

### query-only: overlapping (n=1000, 10k queries)

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 13771.3   | ±170.0  | 1.2 | (fastest) |
| mortonlinearscan | 35237.9   | ±224.9  | 0.6 | 2.56x     |

### query-only: sequential (n=1000, 10k queries)

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 1031.0    | ±26.3   | 2.6 | (fastest) |
| mortonlinearscan | 25390.5   | ±209.9  | 0.8 | 24.63x    |

### read: column-operations (n=20) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 8.0       | ±0.2    | 2.5 | (fastest) |
| rstartree          | 12.4      | ±0.6    | 4.6 | 1.55x     |

### read: diagonal-selection (n=30) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 21.8      | ±1.2    | 5.3 | (fastest) |
| rstartree          | 39.3      | ±1.3    | 3.2 | 1.80x     |

### read: large-grid (n=2500) + 100 queries

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 1876.8    | ±8.5    | 0.5 | (fastest) |
| mortonlinearscan | 11722.4   | ±323.0  | 2.8 | 6.25x     |

### read: large-overlapping (n=1250) + 100 queries

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 3052.6    | ±62.9   | 2.1 | (fastest) |
| mortonlinearscan | 5172.1    | ±69.7   | 1.3 | 1.69x     |

### read: large-ranges (n=500) + 100 queries

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 1057.6    | ±21.0   | 2.0 | (fastest) |
| mortonlinearscan | 1076.0    | ±20.4   | 1.9 | 1.02x     |

### read: large-sequential (n=2500) + 100 queries

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 1946.7    | ±38.2   | 2.0 | (fastest) |
| mortonlinearscan | 9526.6    | ±289.9  | 3.0 | 4.89x     |

### read: merge-like-blocks (n=15) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 4.8       | ±0.1    | 3.1 | (fastest) |
| rstartree          | 5.1       | ±0.2    | 3.6 | 1.07x     |

### read: row-operations (n=20) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 6.5       | ±0.2    | 2.4 | (fastest) |
| rstartree          | 7.2       | ±0.3    | 3.5 | 1.11x     |

### read: single-cell-edits (n=50) + 100 queries

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 16.6      | ±0.5    | 3.0 | (fastest) |
| mortonlinearscan | 16.8      | ±0.9    | 5.5 | 1.02x     |

### read: sparse-grid (n=60) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 23.1      | ±1.1    | 4.9 | (fastest) |
| rstartree          | 24.4      | ±0.7    | 2.8 | 1.06x     |

### read: sparse-large-ranges (n=30) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 8.9       | ±0.7    | 7.5 | (fastest) |
| rstartree          | 14.1      | ±0.5    | 3.4 | 1.58x     |

### read: sparse-overlapping (n=40) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 18.9      | ±0.7    | 3.6 | (fastest) |
| rstartree          | 69.8      | ±2.4    | 3.5 | 3.68x     |

### read: sparse-sequential (n=50) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 14.9      | ±0.5    | 3.5 | (fastest) |
| rstartree          | 21.7      | ±0.9    | 4.2 | 1.45x     |

### read: striping-alternating-rows (n=25) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 7.5       | ±0.3    | 4.4 | (fastest) |
| rstartree          | 8.5       | ±0.2    | 2.3 | 1.13x     |

### write: column-operations (n=20)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 1.5       | ±0.0    | 1.8 | (fastest) |
| rstartree          | 5.6       | ±0.1    | 2.2 | 3.84x     |

### write: diagonal-selection (n=30)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 6.6       | ±0.2    | 3.1 | (fastest) |
| rstartree          | 35.4      | ±0.7    | 2.0 | 5.34x     |

### write: large-grid (n=2500)

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 1926.9    | ±60.9   | 3.2 | (fastest) |
| mortonlinearscan | 11299.4   | ±221.3  | 2.0 | 5.86x     |

### write: large-overlapping (n=1250)

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 3184.8    | ±109.9  | 3.4 | (fastest) |
| mortonlinearscan | 4939.2    | ±130.5  | 2.6 | 1.55x     |

### write: large-ranges (n=500)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 802.9     | ±24.2   | 3.0 | (fastest) |
| rstartree          | 1053.8    | ±28.1   | 2.7 | 1.31x     |

### write: large-sequential (n=2500)

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 1989.1    | ±79.0   | 4.0 | (fastest) |
| mortonlinearscan | 9171.7    | ±53.7   | 0.6 | 4.61x     |

### write: merge-like-blocks (n=15)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 1.1       | ±0.0    | 3.3 | (fastest) |
| rstartree          | 3.2       | ±0.2    | 6.1 | 2.96x     |

### write: row-operations (n=20)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 1.6       | ±0.0    | 2.0 | (fastest) |
| rstartree          | 5.7       | ±0.1    | 2.5 | 3.63x     |

### write: single-cell-edits (n=50)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 5.5       | ±0.1    | 2.7 | (fastest) |
| rstartree          | 15.1      | ±0.4    | 2.7 | 2.75x     |

### write: sparse-grid (n=60)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 7.9       | ±0.2    | 2.6 | (fastest) |
| rstartree          | 20.8      | ±0.9    | 4.2 | 2.64x     |

### write: sparse-large-ranges (n=30)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 2.5       | ±0.1    | 2.7 | (fastest) |
| rstartree          | 9.6       | ±0.3    | 3.3 | 3.86x     |

### write: sparse-overlapping (n=40)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 9.6       | ±0.5    | 5.3 | (fastest) |
| rstartree          | 65.6      | ±0.8    | 1.2 | 6.86x     |

### write: sparse-sequential (n=50)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 6.5       | ±0.2    | 3.3 | (fastest) |
| rstartree          | 19.5      | ±0.6    | 3.1 | 3.00x     |

### write: striping-alternating-rows (n=25)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 2.1       | ±0.1    | 3.3 | (fastest) |
| rstartree          | 7.4       | ±0.2    | 3.1 | 3.49x     |

---

**Note**: CV% (Coefficient of Variation) measures result stability. Lower is better (< 5% = stable).
