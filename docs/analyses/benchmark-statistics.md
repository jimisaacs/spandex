# Benchmark Analysis Results

**Date**: 2025-10-08T15:29:20.110Z
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
| mortonlinearscan | 25   | 71%      | 31052.8       |
| rstartree        | 10   | 29%      | 2308.8        |

### Statistical Quality

| Implementation   | Avg CV% | Max CV% | Status      |
| ---------------- | ------- | ------- | ----------- |
| mortonlinearscan | 5.06    | 28.56   | ❌ Unstable |
| rstartree        | 4.70    | 27.73   | ❌ Unstable |

## Detailed Results

### mixed: large-overlapping (n=500) 80/20

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 1105.9    | ±8.1    | 0.7 | (fastest) |
| rstartree          | 1998.7    | ±18.3   | 0.9 | 1.81x     |

### mixed: large-sequential (n=1000) 80/20

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 1413.9    | ±10.7   | 0.8 | (fastest) |
| mortonlinearscan | 3972.4    | ±78.8   | 2.0 | 2.81x     |

### mixed: sparse-overlapping (n=40) 80/20

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 20.2      | ±0.2    | 1.2 | (fastest) |
| rstartree          | 125.1     | ±1.2    | 1.0 | 6.21x     |

### mixed: sparse-sequential (n=50) 80/20

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 12.7      | ±0.2    | 1.9 | (fastest) |
| rstartree          | 39.5      | ±0.7    | 1.8 | 3.12x     |

### query-only: large (n=5000, 10k queries)

| Implementation   | Mean (µs) | ±Stddev  | CV% | Relative  |
| ---------------- | --------- | -------- | --- | --------- |
| rstartree ✓      | 23408.6   | ±296.3   | 1.3 | (fastest) |
| mortonlinearscan | 894677.8  | ±16669.2 | 1.9 | 38.22x    |

### query-only: overlapping (n=1000, 10k queries)

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 23303.8   | ±141.2  | 0.6 | (fastest) |
| mortonlinearscan | 63606.2   | ±1394.2 | 2.2 | 2.73x     |

### query-only: sequential (n=1000, 10k queries)

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 1849.6    | ±8.8    | 0.5 | (fastest) |
| mortonlinearscan | 40891.3   | ±284.2  | 0.7 | 22.11x    |

### read: column-operations (n=20) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 14.4      | ±0.1    | 1.0 | (fastest) |
| rstartree          | 23.7      | ±0.2    | 1.0 | 1.65x     |

### read: diagonal-selection (n=30) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 36.0      | ±0.5    | 1.3 | (fastest) |
| rstartree          | 69.6      | ±0.3    | 0.4 | 1.93x     |

### read: large-grid (n=2500) + 100 queries

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 3344.5    | ±11.2   | 0.3 | (fastest) |
| mortonlinearscan | 16299.4   | ±230.3  | 1.4 | 4.87x     |

### read: large-overlapping (n=1250) + 100 queries

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 5231.6    | ±21.5   | 0.4 | (fastest) |
| mortonlinearscan | 7125.3    | ±203.6  | 2.9 | 1.36x     |

### read: large-ranges (n=500) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 1710.4    | ±24.5   | 1.4 | (fastest) |
| rstartree          | 1790.3    | ±17.5   | 1.0 | 1.05x     |

### read: large-sequential (n=2500) + 100 queries

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 3351.4    | ±31.4   | 0.9 | (fastest) |
| mortonlinearscan | 17160.9   | ±131.9  | 0.8 | 5.12x     |

### read: merge-like-blocks (n=15) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 8.7       | ±0.1    | 1.3 | (fastest) |
| rstartree          | 10.7      | ±0.2    | 2.2 | 1.23x     |

### read: row-operations (n=20) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 11.6      | ±0.1    | 0.9 | (fastest) |
| rstartree          | 14.2      | ±0.2    | 1.3 | 1.22x     |

### read: single-cell-edits (n=50) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 27.1      | ±0.3    | 0.9 | (fastest) |
| rstartree          | 30.6      | ±0.4    | 1.2 | 1.13x     |

### read: sparse-grid (n=60) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 34.3      | ±0.3    | 1.0 | (fastest) |
| rstartree          | 45.4      | ±2.7    | 5.9 | 1.32x     |

### read: sparse-large-ranges (n=30) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 13.0      | ±0.6    | 4.7 | (fastest) |
| rstartree          | 26.4      | ±0.3    | 1.2 | 2.03x     |

### read: sparse-overlapping (n=40) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 32.3      | ±0.3    | 1.1 | (fastest) |
| rstartree          | 122.3     | ±0.8    | 0.7 | 3.78x     |

### read: sparse-sequential (n=50) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 28.9      | ±0.3    | 0.9 | (fastest) |
| rstartree          | 40.0      | ±0.8    | 2.0 | 1.38x     |

### read: striping-alternating-rows (n=25) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 13.0      | ±0.1    | 0.9 | (fastest) |
| rstartree          | 16.7      | ±0.4    | 2.2 | 1.28x     |

### write: column-operations (n=20)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 2.7       | ±0.1    | 2.6 | (fastest) |
| rstartree          | 11.3      | ±0.0    | 0.4 | 4.22x     |

### write: diagonal-selection (n=30)

| Implementation     | Mean (µs) | ±Stddev | CV%  | Relative  |
| ------------------ | --------- | ------- | ---- | --------- |
| mortonlinearscan ✓ | 13.3      | ±3.7    | 28.0 | (fastest) |
| rstartree          | 73.7      | ±20.4   | 27.7 | 5.53x     |

### write: large-grid (n=2500)

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 3261.2    | ±17.7   | 0.5 | (fastest) |
| mortonlinearscan | 14726.7   | ±389.2  | 2.6 | 4.52x     |

### write: large-overlapping (n=1250)

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 5236.6    | ±185.0  | 3.5 | (fastest) |
| mortonlinearscan | 5679.5    | ±44.0   | 0.8 | 1.08x     |

### write: large-ranges (n=500)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 1289.1    | ±9.3    | 0.7 | (fastest) |
| rstartree          | 1778.3    | ±13.0   | 0.7 | 1.38x     |

### write: large-sequential (n=2500)

| Implementation   | Mean (µs) | ±Stddev | CV%  | Relative  |
| ---------------- | --------- | ------- | ---- | --------- |
| rstartree ✓      | 3905.0    | ±1016.8 | 26.0 | (fastest) |
| mortonlinearscan | 18268.3   | ±4324.5 | 23.7 | 4.68x     |

### write: merge-like-blocks (n=15)

| Implementation     | Mean (µs) | ±Stddev | CV%  | Relative  |
| ------------------ | --------- | ------- | ---- | --------- |
| mortonlinearscan ✓ | 2.1       | ±0.6    | 28.6 | (fastest) |
| rstartree          | 8.2       | ±1.6    | 19.4 | 3.84x     |

### write: row-operations (n=20)

| Implementation     | Mean (µs) | ±Stddev | CV%  | Relative  |
| ------------------ | --------- | ------- | ---- | --------- |
| mortonlinearscan ✓ | 3.2       | ±0.7    | 21.1 | (fastest) |
| rstartree          | 12.9      | ±3.3    | 25.5 | 4.01x     |

### write: single-cell-edits (n=50)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 9.2       | ±0.1    | 1.3 | (fastest) |
| rstartree          | 28.4      | ±0.7    | 2.5 | 3.08x     |

### write: sparse-grid (n=60)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 14.1      | ±0.8    | 5.4 | (fastest) |
| rstartree          | 36.9      | ±0.2    | 0.5 | 2.63x     |

### write: sparse-large-ranges (n=30)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 4.5       | ±0.1    | 1.7 | (fastest) |
| rstartree          | 17.5      | ±0.3    | 1.7 | 3.93x     |

### write: sparse-overlapping (n=40)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 17.4      | ±0.1    | 0.7 | (fastest) |
| rstartree          | 126.6     | ±0.6    | 0.5 | 7.28x     |

### write: sparse-sequential (n=50)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 11.3      | ±0.1    | 0.8 | (fastest) |
| rstartree          | 36.7      | ±0.7    | 1.8 | 3.26x     |

### write: striping-alternating-rows (n=25)

| Implementation     | Mean (µs) | ±Stddev | CV%  | Relative  |
| ------------------ | --------- | ------- | ---- | --------- |
| mortonlinearscan ✓ | 4.4       | ±1.2    | 28.1 | (fastest) |
| rstartree          | 16.4      | ±4.3    | 26.3 | 3.70x     |

---

**Note**: CV% (Coefficient of Variation) measures result stability. Lower is better (< 5% = stable).
