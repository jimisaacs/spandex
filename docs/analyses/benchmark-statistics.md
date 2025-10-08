# Benchmark Analysis Results

**Date**: 2025-10-08T15:47:37.533Z
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
| mortonlinearscan | 25   | 71%      | 29707.0       |
| rstartree        | 10   | 29%      | 2307.1        |

### Statistical Quality

| Implementation   | Avg CV% | Max CV% | Status      |
| ---------------- | ------- | ------- | ----------- |
| mortonlinearscan | 6.09    | 29.99   | ❌ Unstable |
| rstartree        | 5.44    | 27.68   | ❌ Unstable |

## Detailed Results

### mixed: large-overlapping (n=500) 80/20

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 1104.0    | ±8.1    | 0.7 | (fastest) |
| rstartree          | 2026.6    | ±25.5   | 1.3 | 1.84x     |

### mixed: large-sequential (n=1000) 80/20

| Implementation   | Mean (µs) | ±Stddev | CV%  | Relative  |
| ---------------- | --------- | ------- | ---- | --------- |
| rstartree ✓      | 1569.0    | ±295.1  | 18.8 | (fastest) |
| mortonlinearscan | 3964.3    | ±57.2   | 1.4  | 2.53x     |

### mixed: sparse-overlapping (n=40) 80/20

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 20.0      | ±0.1    | 0.7 | (fastest) |
| rstartree          | 125.3     | ±0.8    | 0.7 | 6.27x     |

### mixed: sparse-sequential (n=50) 80/20

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 12.8      | ±0.2    | 1.8 | (fastest) |
| rstartree          | 39.6      | ±0.2    | 0.5 | 3.10x     |

### query-only: large (n=5000, 10k queries)

| Implementation   | Mean (µs) | ±Stddev  | CV% | Relative  |
| ---------------- | --------- | -------- | --- | --------- |
| rstartree ✓      | 23466.1   | ±187.2   | 0.8 | (fastest) |
| mortonlinearscan | 851219.2  | ±21734.3 | 2.6 | 36.27x    |

### query-only: overlapping (n=1000, 10k queries)

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 23368.5   | ±166.0  | 0.7 | (fastest) |
| mortonlinearscan | 62282.0   | ±1017.4 | 1.6 | 2.67x     |

### query-only: sequential (n=1000, 10k queries)

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 1860.3    | ±22.3   | 1.2 | (fastest) |
| mortonlinearscan | 41227.0   | ±472.0  | 1.1 | 22.16x    |

### read: column-operations (n=20) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 14.4      | ±0.2    | 1.2 | (fastest) |
| rstartree          | 23.8      | ±0.3    | 1.2 | 1.65x     |

### read: diagonal-selection (n=30) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 35.7      | ±0.3    | 1.0 | (fastest) |
| rstartree          | 70.2      | ±1.0    | 1.4 | 1.97x     |

### read: large-grid (n=2500) + 100 queries

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 3371.7    | ±21.6   | 0.6 | (fastest) |
| mortonlinearscan | 15851.4   | ±417.1  | 2.6 | 4.70x     |

### read: large-overlapping (n=1250) + 100 queries

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 5317.3    | ±110.0  | 2.1 | (fastest) |
| mortonlinearscan | 6900.7    | ±156.7  | 2.3 | 1.30x     |

### read: large-ranges (n=500) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 1727.6    | ±20.1   | 1.2 | (fastest) |
| rstartree          | 1790.9    | ±19.3   | 1.1 | 1.04x     |

### read: large-sequential (n=2500) + 100 queries

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 3364.2    | ±16.8   | 0.5 | (fastest) |
| mortonlinearscan | 17314.3   | ±361.8  | 2.1 | 5.15x     |

### read: merge-like-blocks (n=15) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 8.7       | ±0.1    | 1.3 | (fastest) |
| rstartree          | 11.1      | ±0.2    | 1.6 | 1.28x     |

### read: row-operations (n=20) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 11.7      | ±0.2    | 1.8 | (fastest) |
| rstartree          | 14.3      | ±0.2    | 1.1 | 1.22x     |

### read: single-cell-edits (n=50) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 27.3      | ±0.2    | 0.7 | (fastest) |
| rstartree          | 31.2      | ±0.6    | 2.0 | 1.14x     |

### read: sparse-grid (n=60) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 34.7      | ±0.3    | 1.0 | (fastest) |
| rstartree          | 44.5      | ±0.4    | 0.9 | 1.28x     |

### read: sparse-large-ranges (n=30) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 12.9      | ±0.3    | 2.6 | (fastest) |
| rstartree          | 27.0      | ±0.9    | 3.2 | 2.09x     |

### read: sparse-overlapping (n=40) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 32.3      | ±0.4    | 1.3 | (fastest) |
| rstartree          | 123.1     | ±1.0    | 0.8 | 3.81x     |

### read: sparse-sequential (n=50) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV%  | Relative  |
| ------------------ | --------- | ------- | ---- | --------- |
| mortonlinearscan ✓ | 32.2      | ±6.5    | 20.2 | (fastest) |
| rstartree          | 40.0      | ±0.4    | 1.1  | 1.24x     |

### read: striping-alternating-rows (n=25) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 13.0      | ±0.2    | 1.4 | (fastest) |
| rstartree          | 17.2      | ±1.0    | 5.6 | 1.32x     |

### write: column-operations (n=20)

| Implementation     | Mean (µs) | ±Stddev | CV%  | Relative  |
| ------------------ | --------- | ------- | ---- | --------- |
| mortonlinearscan ✓ | 3.1       | ±0.9    | 30.0 | (fastest) |
| rstartree          | 13.1      | ±3.3    | 25.2 | 4.20x     |

### write: diagonal-selection (n=30)

| Implementation     | Mean (µs) | ±Stddev | CV%  | Relative  |
| ------------------ | --------- | ------- | ---- | --------- |
| mortonlinearscan ✓ | 13.4      | ±3.7    | 27.6 | (fastest) |
| rstartree          | 74.5      | ±20.6   | 27.7 | 5.58x     |

### write: large-grid (n=2500)

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 3297.4    | ±20.3   | 0.6 | (fastest) |
| mortonlinearscan | 14760.4   | ±532.6  | 3.6 | 4.48x     |

### write: large-overlapping (n=1250)

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 5146.2    | ±55.8   | 1.1 | (fastest) |
| mortonlinearscan | 5712.0    | ±111.5  | 2.0 | 1.11x     |

### write: large-ranges (n=500)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 1306.4    | ±33.6   | 2.6 | (fastest) |
| rstartree          | 1787.7    | ±20.8   | 1.2 | 1.37x     |

### write: large-sequential (n=2500)

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 3439.1    | ±28.0   | 0.8 | (fastest) |
| mortonlinearscan | 16039.0   | ±153.9  | 1.0 | 4.66x     |

### write: merge-like-blocks (n=15)

| Implementation     | Mean (µs) | ±Stddev | CV%  | Relative  |
| ------------------ | --------- | ------- | ---- | --------- |
| mortonlinearscan ✓ | 2.1       | ±0.4    | 20.8 | (fastest) |
| rstartree          | 7.8       | ±0.3    | 3.7  | 3.82x     |

### write: row-operations (n=20)

| Implementation     | Mean (µs) | ±Stddev | CV%  | Relative  |
| ------------------ | --------- | ------- | ---- | --------- |
| mortonlinearscan ✓ | 3.3       | ±1.0    | 29.6 | (fastest) |
| rstartree          | 13.3      | ±3.6    | 27.0 | 4.02x     |

### write: single-cell-edits (n=50)

| Implementation     | Mean (µs) | ±Stddev | CV%  | Relative  |
| ------------------ | --------- | ------- | ---- | --------- |
| mortonlinearscan ✓ | 9.3       | ±0.1    | 1.2  | (fastest) |
| rstartree          | 31.9      | ±7.3    | 22.9 | 3.43x     |

### write: sparse-grid (n=60)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 13.6      | ±0.4    | 3.1 | (fastest) |
| rstartree          | 37.2      | ±0.6    | 1.7 | 2.73x     |

### write: sparse-large-ranges (n=30)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 4.7       | ±0.5    | 9.7 | (fastest) |
| rstartree          | 17.7      | ±0.3    | 1.9 | 3.74x     |

### write: sparse-overlapping (n=40)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 17.4      | ±0.3    | 1.5 | (fastest) |
| rstartree          | 126.1     | ±0.7    | 0.5 | 7.26x     |

### write: sparse-sequential (n=50)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 11.3      | ±0.1    | 0.5 | (fastest) |
| rstartree          | 36.9      | ±0.9    | 2.5 | 3.26x     |

### write: striping-alternating-rows (n=25)

| Implementation     | Mean (µs) | ±Stddev | CV%  | Relative  |
| ------------------ | --------- | ------- | ---- | --------- |
| mortonlinearscan ✓ | 4.5       | ±1.3    | 29.5 | (fastest) |
| rstartree          | 16.7      | ±4.4    | 26.5 | 3.73x     |

---

**Note**: CV% (Coefficient of Variation) measures result stability. Lower is better (< 5% = stable).
