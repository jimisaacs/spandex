# Benchmark Analysis Results

**Date**: 2025-10-08T02:15:55.954Z
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
| mortonlinearscan | 24   | 69%      | 14251.5       |
| rstartree        | 11   | 31%      | 1353.7        |

### Statistical Quality

| Implementation   | Avg CV% | Max CV% | Status      |
| ---------------- | ------- | ------- | ----------- |
| mortonlinearscan | 2.56    | 7.02    | ⚠️ Variable |
| rstartree        | 2.88    | 5.82    | ⚠️ Variable |

## Detailed Results

### mixed: large-overlapping (n=500) 80/20

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 805.0     | ±8.7    | 1.1 | (fastest) |
| rstartree          | 1153.8    | ±38.5   | 3.3 | 1.43x     |

### mixed: large-sequential (n=1000) 80/20

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 787.2     | ±23.6   | 3.0 | (fastest) |
| mortonlinearscan | 1992.1    | ±43.8   | 2.2 | 2.53x     |

### mixed: sparse-overlapping (n=40) 80/20

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 10.8      | ±0.3    | 3.2 | (fastest) |
| rstartree          | 70.5      | ±3.0    | 4.3 | 6.54x     |

### mixed: sparse-sequential (n=50) 80/20

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 7.1       | ±0.2    | 3.4 | (fastest) |
| rstartree          | 21.3      | ±0.8    | 3.6 | 3.01x     |

### query-only: large (n=5000, 10k queries)

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 13143.3   | ±190.5  | 1.4 | (fastest) |
| mortonlinearscan | 381646.9  | ±9181.5 | 2.4 | 29.04x    |

### query-only: overlapping (n=1000, 10k queries)

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 14754.7   | ±448.0  | 3.0 | (fastest) |
| mortonlinearscan | 35519.2   | ±457.1  | 1.3 | 2.41x     |

### query-only: sequential (n=1000, 10k queries)

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 1061.3    | ±24.3   | 2.3 | (fastest) |
| mortonlinearscan | 25777.5   | ±587.5  | 2.3 | 24.29x    |

### read: column-operations (n=20) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 8.2       | ±0.2    | 2.1 | (fastest) |
| rstartree          | 13.2      | ±0.8    | 5.8 | 1.60x     |

### read: diagonal-selection (n=30) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 21.1      | ±0.8    | 3.7 | (fastest) |
| rstartree          | 39.8      | ±1.2    | 3.1 | 1.89x     |

### read: large-grid (n=2500) + 100 queries

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 1913.5    | ±23.9   | 1.2 | (fastest) |
| mortonlinearscan | 11535.0   | ±234.6  | 2.0 | 6.03x     |

### read: large-overlapping (n=1250) + 100 queries

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 3076.8    | ±59.5   | 1.9 | (fastest) |
| mortonlinearscan | 5230.3    | ±133.5  | 2.6 | 1.70x     |

### read: large-ranges (n=500) + 100 queries

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 1058.6    | ±20.5   | 1.9 | (fastest) |
| mortonlinearscan | 1092.9    | ±26.5   | 2.4 | 1.03x     |

### read: large-sequential (n=2500) + 100 queries

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 1947.4    | ±27.3   | 1.4 | (fastest) |
| mortonlinearscan | 9450.2    | ±137.2  | 1.5 | 4.85x     |

### read: merge-like-blocks (n=15) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 4.9       | ±0.2    | 4.3 | (fastest) |
| rstartree          | 5.6       | ±0.2    | 4.0 | 1.13x     |

### read: row-operations (n=20) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 6.4       | ±0.2    | 2.8 | (fastest) |
| rstartree          | 7.6       | ±0.3    | 3.8 | 1.20x     |

### read: single-cell-edits (n=50) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 16.7      | ±1.0    | 5.9 | (fastest) |
| rstartree          | 17.0      | ±0.6    | 3.5 | 1.02x     |

### read: sparse-grid (n=60) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 22.2      | ±0.5    | 2.2 | (fastest) |
| rstartree          | 24.0      | ±0.2    | 0.8 | 1.08x     |

### read: sparse-large-ranges (n=30) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 8.8       | ±0.6    | 7.0 | (fastest) |
| rstartree          | 14.5      | ±0.8    | 5.5 | 1.66x     |

### read: sparse-overlapping (n=40) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 18.3      | ±0.7    | 3.7 | (fastest) |
| rstartree          | 70.6      | ±4.0    | 5.6 | 3.85x     |

### read: sparse-sequential (n=50) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 14.9      | ±0.2    | 1.3 | (fastest) |
| rstartree          | 21.2      | ±0.2    | 1.0 | 1.42x     |

### read: striping-alternating-rows (n=25) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 7.5       | ±0.4    | 5.0 | (fastest) |
| rstartree          | 9.1       | ±0.4    | 4.5 | 1.21x     |

### write: column-operations (n=20)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 1.4       | ±0.0    | 2.1 | (fastest) |
| rstartree          | 5.5       | ±0.1    | 1.4 | 3.82x     |

### write: diagonal-selection (n=30)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 6.5       | ±0.1    | 1.5 | (fastest) |
| rstartree          | 35.0      | ±0.5    | 1.5 | 5.41x     |

### write: large-grid (n=2500)

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 1872.2    | ±23.0   | 1.2 | (fastest) |
| mortonlinearscan | 10948.8   | ±204.1  | 1.9 | 5.85x     |

### write: large-overlapping (n=1250)

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 3139.0    | ±158.4  | 5.0 | (fastest) |
| mortonlinearscan | 4867.9    | ±132.7  | 2.7 | 1.55x     |

### write: large-ranges (n=500)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 795.3     | ±12.8   | 1.6 | (fastest) |
| rstartree          | 1043.5    | ±29.8   | 2.9 | 1.31x     |

### write: large-sequential (n=2500)

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 1927.9    | ±34.1   | 1.8 | (fastest) |
| mortonlinearscan | 8949.6    | ±205.2  | 2.3 | 4.64x     |

### write: merge-like-blocks (n=15)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 1.1       | ±0.0    | 2.6 | (fastest) |
| rstartree          | 3.1       | ±0.1    | 4.4 | 2.96x     |

### write: row-operations (n=20)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 1.5       | ±0.0    | 0.7 | (fastest) |
| rstartree          | 5.7       | ±0.3    | 4.7 | 3.69x     |

### write: single-cell-edits (n=50)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 5.4       | ±0.1    | 2.0 | (fastest) |
| rstartree          | 14.9      | ±0.3    | 1.9 | 2.74x     |

### write: sparse-grid (n=60)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 7.7       | ±0.1    | 1.3 | (fastest) |
| rstartree          | 20.6      | ±0.8    | 3.9 | 2.66x     |

### write: sparse-large-ranges (n=30)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 2.5       | ±0.0    | 1.2 | (fastest) |
| rstartree          | 9.1       | ±0.2    | 1.9 | 3.69x     |

### write: sparse-overlapping (n=40)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 9.5       | ±0.3    | 3.0 | (fastest) |
| rstartree          | 66.2      | ±1.0    | 1.6 | 6.98x     |

### write: sparse-sequential (n=50)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 6.4       | ±0.1    | 1.2 | (fastest) |
| rstartree          | 19.3      | ±0.6    | 3.0 | 3.00x     |

### write: striping-alternating-rows (n=25)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 2.1       | ±0.1    | 3.0 | (fastest) |
| rstartree          | 7.2       | ±0.1    | 0.8 | 3.42x     |

---

**Note**: CV% (Coefficient of Variation) measures result stability. Lower is better (< 5% = stable).
