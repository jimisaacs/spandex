# Benchmark Analysis Results

**Date**: 2025-10-08T15:08:01.981Z
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
| mortonlinearscan | 25   | 71%      | 29927.6       |
| rstartree        | 10   | 29%      | 2294.0        |

### Statistical Quality

| Implementation   | Avg CV% | Max CV% | Status      |
| ---------------- | ------- | ------- | ----------- |
| mortonlinearscan | 6.56    | 31.01   | ❌ Unstable |
| rstartree        | 5.30    | 36.47   | ❌ Unstable |

## Detailed Results

### mixed: large-overlapping (n=500) 80/20

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 1098.6    | ±13.4   | 1.2 | (fastest) |
| rstartree          | 1991.5    | ±6.9    | 0.3 | 1.81x     |

### mixed: large-sequential (n=1000) 80/20

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 1421.1    | ±27.7   | 2.0 | (fastest) |
| mortonlinearscan | 3927.8    | ±81.3   | 2.1 | 2.76x     |

### mixed: sparse-overlapping (n=40) 80/20

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 20.5      | ±0.7    | 3.6 | (fastest) |
| rstartree          | 125.3     | ±1.5    | 1.2 | 6.12x     |

### mixed: sparse-sequential (n=50) 80/20

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 12.7      | ±0.2    | 1.5 | (fastest) |
| rstartree          | 38.9      | ±0.3    | 0.9 | 3.06x     |

### query-only: large (n=5000, 10k queries)

| Implementation   | Mean (µs) | ±Stddev  | CV% | Relative  |
| ---------------- | --------- | -------- | --- | --------- |
| rstartree ✓      | 23640.3   | ±1087.6  | 4.6 | (fastest) |
| mortonlinearscan | 859896.2  | ±23827.6 | 2.8 | 36.37x    |

### query-only: overlapping (n=1000, 10k queries)

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 23186.2   | ±33.6   | 0.1 | (fastest) |
| mortonlinearscan | 62375.1   | ±939.4  | 1.5 | 2.69x     |

### query-only: sequential (n=1000, 10k queries)

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 1848.3    | ±9.9    | 0.5 | (fastest) |
| mortonlinearscan | 40737.1   | ±320.3  | 0.8 | 22.04x    |

### read: column-operations (n=20) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 14.5      | ±0.5    | 3.3 | (fastest) |
| rstartree          | 23.5      | ±0.1    | 0.5 | 1.61x     |

### read: diagonal-selection (n=30) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 36.5      | ±0.5    | 1.3 | (fastest) |
| rstartree          | 69.9      | ±0.9    | 1.3 | 1.91x     |

### read: large-grid (n=2500) + 100 queries

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 3353.0    | ±22.9   | 0.7 | (fastest) |
| mortonlinearscan | 15987.4   | ±456.0  | 2.9 | 4.77x     |

### read: large-overlapping (n=1250) + 100 queries

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 5220.0    | ±29.4   | 0.6 | (fastest) |
| mortonlinearscan | 6858.4    | ±226.7  | 3.3 | 1.31x     |

### read: large-ranges (n=500) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 1711.8    | ±37.7   | 2.2 | (fastest) |
| rstartree          | 1779.1    | ±11.1   | 0.6 | 1.04x     |

### read: large-sequential (n=2500) + 100 queries

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 3336.5    | ±23.2   | 0.7 | (fastest) |
| mortonlinearscan | 17051.9   | ±131.3  | 0.8 | 5.11x     |

### read: merge-like-blocks (n=15) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 8.7       | ±0.3    | 2.9 | (fastest) |
| rstartree          | 10.7      | ±0.1    | 1.0 | 1.23x     |

### read: row-operations (n=20) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 11.7      | ±0.4    | 3.3 | (fastest) |
| rstartree          | 14.0      | ±0.1    | 0.7 | 1.20x     |

### read: single-cell-edits (n=50) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 27.3      | ±0.6    | 2.0 | (fastest) |
| rstartree          | 30.4      | ±0.5    | 1.6 | 1.11x     |

### read: sparse-grid (n=60) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 34.7      | ±0.6    | 1.6 | (fastest) |
| rstartree          | 44.0      | ±0.5    | 1.2 | 1.27x     |

### read: sparse-large-ranges (n=30) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 13.1      | ±0.5    | 3.4 | (fastest) |
| rstartree          | 26.2      | ±0.1    | 0.5 | 2.00x     |

### read: sparse-overlapping (n=40) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 32.9      | ±0.3    | 0.9 | (fastest) |
| rstartree          | 122.6     | ±1.6    | 1.3 | 3.73x     |

### read: sparse-sequential (n=50) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 29.0      | ±0.2    | 0.8 | (fastest) |
| rstartree          | 39.2      | ±0.5    | 1.2 | 1.35x     |

### read: striping-alternating-rows (n=25) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 13.0      | ±0.1    | 0.6 | (fastest) |
| rstartree          | 16.5      | ±0.1    | 0.8 | 1.27x     |

### write: column-operations (n=20)

| Implementation     | Mean (µs) | ±Stddev | CV%  | Relative  |
| ------------------ | --------- | ------- | ---- | --------- |
| mortonlinearscan ✓ | 3.0       | ±0.7    | 24.1 | (fastest) |
| rstartree          | 11.1      | ±0.2    | 1.4  | 3.76x     |

### write: diagonal-selection (n=30)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 11.8      | ±0.4    | 3.0 | (fastest) |
| rstartree          | 63.1      | ±0.8    | 1.2 | 5.36x     |

### write: large-grid (n=2500)

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 3297.0    | ±69.5   | 2.1 | (fastest) |
| mortonlinearscan | 14618.6   | ±355.2  | 2.4 | 4.43x     |

### write: large-overlapping (n=1250)

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 5100.8    | ±16.2   | 0.3 | (fastest) |
| mortonlinearscan | 5638.1    | ±94.6   | 1.7 | 1.11x     |

### write: large-ranges (n=500)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 1291.2    | ±20.6   | 1.6 | (fastest) |
| rstartree          | 1781.1    | ±32.7   | 1.8 | 1.38x     |

### write: large-sequential (n=2500)

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 3381.7    | ±30.8   | 0.9 | (fastest) |
| mortonlinearscan | 15930.0   | ±174.0  | 1.1 | 4.71x     |

### write: merge-like-blocks (n=15)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 1.8       | ±0.1    | 2.9 | (fastest) |
| rstartree          | 7.2       | ±0.1    | 1.6 | 4.01x     |

### write: row-operations (n=20)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 2.8       | ±0.0    | 1.7 | (fastest) |
| rstartree          | 11.1      | ±0.2    | 1.4 | 3.91x     |

### write: single-cell-edits (n=50)

| Implementation     | Mean (µs) | ±Stddev | CV%  | Relative  |
| ------------------ | --------- | ------- | ---- | --------- |
| mortonlinearscan ✓ | 10.8      | ±3.2    | 30.0 | (fastest) |
| rstartree          | 32.3      | ±9.1    | 28.1 | 2.99x     |

### write: sparse-grid (n=60)

| Implementation     | Mean (µs) | ±Stddev | CV%  | Relative  |
| ------------------ | --------- | ------- | ---- | --------- |
| mortonlinearscan ✓ | 15.9      | ±4.6    | 28.8 | (fastest) |
| rstartree          | 42.8      | ±12.3   | 28.9 | 2.70x     |

### write: sparse-large-ranges (n=30)

| Implementation     | Mean (µs) | ±Stddev | CV%  | Relative  |
| ------------------ | --------- | ------- | ---- | --------- |
| mortonlinearscan ✓ | 5.2       | ±1.5    | 29.9 | (fastest) |
| rstartree          | 19.9      | ±5.5    | 27.9 | 3.85x     |

### write: sparse-overlapping (n=40)

| Implementation     | Mean (µs) | ±Stddev | CV%  | Relative  |
| ------------------ | --------- | ------- | ---- | --------- |
| mortonlinearscan ✓ | 20.9      | ±5.8    | 28.0 | (fastest) |
| rstartree          | 146.8     | ±43.3   | 29.5 | 7.03x     |

### write: sparse-sequential (n=50)

| Implementation     | Mean (µs) | ±Stddev | CV%  | Relative  |
| ------------------ | --------- | ------- | ---- | --------- |
| mortonlinearscan ✓ | 13.5      | ±4.2    | 31.0 | (fastest) |
| rstartree          | 43.7      | ±15.9   | 36.5 | 3.24x     |

### write: striping-alternating-rows (n=25)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 3.7       | ±0.0    | 0.7 | (fastest) |
| rstartree          | 14.2      | ±0.2    | 1.6 | 3.82x     |

---

**Note**: CV% (Coefficient of Variation) measures result stability. Lower is better (< 5% = stable).
