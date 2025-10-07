# Benchmark Analysis Results

**Date**: 2025-10-07T14:00:13.023Z
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
| mortonlinearscan  | 24   | 69%      | 13043.1       |
| rtree             | 11   | 31%      | 1363.5        |
| compactlinearscan | 0    | 0%       | 36775.1       |

### Statistical Quality

| Implementation    | Avg CV% | Max CV% | Status    |
| ----------------- | ------- | ------- | --------- |
| compactlinearscan | 2.12    | 3.31    | ✅ Stable |
| mortonlinearscan  | 2.10    | 4.04    | ✅ Stable |
| rtree             | 2.69    | 4.24    | ✅ Stable |

## Detailed Results

### mixed: large-overlapping (n=500) 80/20

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 567.2     | ±8.4    | 1.5 | (fastest) |
| rtree              | 1137.0    | ±41.4   | 3.6 | 2.00x     |
| compactlinearscan  | 2462.1    | ±44.5   | 1.8 | 4.34x     |

### mixed: large-sequential (n=1000) 80/20

| Implementation    | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------- | --------- | ------- | --- | --------- |
| rtree ✓           | 792.3     | ±28.0   | 3.5 | (fastest) |
| mortonlinearscan  | 1612.7    | ±26.7   | 1.7 | 2.04x     |
| compactlinearscan | 7775.5    | ±129.3  | 1.7 | 9.81x     |

### mixed: sparse-overlapping (n=40) 80/20

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 10.1      | ±0.2    | 1.6 | (fastest) |
| compactlinearscan  | 17.6      | ±0.3    | 1.6 | 1.74x     |
| rtree              | 68.6      | ±1.6    | 2.4 | 6.77x     |

### mixed: sparse-sequential (n=50) 80/20

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 6.1       | ±0.1    | 1.8 | (fastest) |
| compactlinearscan  | 16.9      | ±0.3    | 1.6 | 2.77x     |
| rtree              | 21.0      | ±0.6    | 3.0 | 3.45x     |

### query-only: large (n=5000, 10k queries)

| Implementation    | Mean (µs) | ±Stddev  | CV% | Relative  |
| ----------------- | --------- | -------- | --- | --------- |
| rtree ✓           | 13448.8   | ±348.6   | 2.6 | (fastest) |
| mortonlinearscan  | 346612.6  | ±4470.3  | 1.3 | 25.77x    |
| compactlinearscan | 859294.0  | ±18727.2 | 2.2 | 63.89x    |

### query-only: overlapping (n=1000, 10k queries)

| Implementation    | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------- | --------- | ------- | --- | --------- |
| rtree ✓           | 14676.1   | ±156.3  | 1.1 | (fastest) |
| mortonlinearscan  | 42639.6   | ±642.2  | 1.5 | 2.91x     |
| compactlinearscan | 109550.7  | ±2447.2 | 2.2 | 7.46x     |

### query-only: sequential (n=1000, 10k queries)

| Implementation    | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------- | --------- | ------- | --- | --------- |
| rtree ✓           | 1080.1    | ±21.7   | 2.0 | (fastest) |
| mortonlinearscan  | 22765.2   | ±467.7  | 2.1 | 21.08x    |
| compactlinearscan | 87090.5   | ±927.4  | 1.1 | 80.63x    |

### read: column-operations (n=20) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 8.3       | ±0.2    | 2.4 | (fastest) |
| rtree              | 13.0      | ±0.2    | 1.6 | 1.57x     |
| compactlinearscan  | 22.2      | ±0.5    | 2.3 | 2.67x     |

### read: diagonal-selection (n=30) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 18.4      | ±0.1    | 0.4 | (fastest) |
| rtree              | 39.6      | ±1.4    | 3.5 | 2.15x     |
| compactlinearscan  | 56.5      | ±1.3    | 2.3 | 3.06x     |

### read: large-grid (n=2500) + 100 queries

| Implementation    | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------- | --------- | ------- | --- | --------- |
| rtree ✓           | 1954.7    | ±48.4   | 2.5 | (fastest) |
| mortonlinearscan  | 9326.2    | ±244.5  | 2.6 | 4.77x     |
| compactlinearscan | 51048.9   | ±966.7  | 1.9 | 26.12x    |

### read: large-overlapping (n=1250) + 100 queries

| Implementation    | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------- | --------- | ------- | --- | --------- |
| rtree ✓           | 3136.3    | ±119.3  | 3.8 | (fastest) |
| mortonlinearscan  | 3592.4    | ±86.3   | 2.4 | 1.15x     |
| compactlinearscan | 17657.0   | ±493.4  | 2.8 | 5.63x     |

### read: large-ranges (n=500) + 100 queries

| Implementation    | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------- | --------- | ------- | --- | --------- |
| rtree ✓           | 1071.7    | ±37.7   | 3.5 | (fastest) |
| mortonlinearscan  | 1127.6    | ±22.2   | 2.0 | 1.05x     |
| compactlinearscan | 4228.7    | ±94.8   | 2.2 | 3.95x     |

### read: large-sequential (n=2500) + 100 queries

| Implementation    | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------- | --------- | ------- | --- | --------- |
| rtree ✓           | 1950.7    | ±69.8   | 3.6 | (fastest) |
| mortonlinearscan  | 7962.9    | ±147.4  | 1.9 | 4.08x     |
| compactlinearscan | 43008.2   | ±1137.9 | 2.6 | 22.05x    |

### read: merge-like-blocks (n=15) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 4.1       | ±0.1    | 1.7 | (fastest) |
| rtree              | 5.6       | ±0.2    | 2.8 | 1.35x     |
| compactlinearscan  | 18.8      | ±0.4    | 1.9 | 4.57x     |

### read: row-operations (n=20) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 5.4       | ±0.2    | 4.0 | (fastest) |
| rtree              | 7.8       | ±0.2    | 2.6 | 1.44x     |
| compactlinearscan  | 17.2      | ±0.4    | 2.3 | 3.18x     |

### read: single-cell-edits (n=50) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 15.2      | ±0.2    | 1.6 | (fastest) |
| rtree              | 16.8      | ±0.4    | 2.1 | 1.11x     |
| compactlinearscan  | 49.2      | ±1.1    | 2.3 | 3.24x     |

### read: sparse-grid (n=60) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 19.3      | ±0.4    | 2.1 | (fastest) |
| rtree              | 25.0      | ±0.8    | 3.1 | 1.30x     |
| compactlinearscan  | 88.8      | ±1.8    | 2.0 | 4.61x     |

### read: sparse-large-ranges (n=30) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 8.2       | ±0.2    | 2.5 | (fastest) |
| rtree              | 14.4      | ±0.2    | 1.4 | 1.75x     |
| compactlinearscan  | 26.0      | ±0.4    | 1.4 | 3.16x     |

### read: sparse-overlapping (n=40) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 17.3      | ±0.6    | 3.5 | (fastest) |
| compactlinearscan  | 48.0      | ±1.0    | 2.0 | 2.77x     |
| rtree              | 69.3      | ±2.0    | 2.9 | 4.01x     |

### read: sparse-sequential (n=50) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 15.2      | ±0.4    | 2.4 | (fastest) |
| rtree              | 21.9      | ±0.7    | 3.3 | 1.44x     |
| compactlinearscan  | 46.5      | ±1.1    | 2.3 | 3.05x     |

### read: striping-alternating-rows (n=25) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 6.5       | ±0.1    | 1.5 | (fastest) |
| rtree              | 9.0       | ±0.2    | 2.5 | 1.37x     |
| compactlinearscan  | 20.9      | ±0.2    | 0.9 | 3.19x     |

### write: column-operations (n=20)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 1.5       | ±0.0    | 2.5 | (fastest) |
| compactlinearscan  | 2.4       | ±0.1    | 3.3 | 1.61x     |
| rtree              | 5.6       | ±0.2    | 4.2 | 3.78x     |

### write: diagonal-selection (n=30)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 6.6       | ±0.1    | 1.1 | (fastest) |
| compactlinearscan  | 11.1      | ±0.1    | 0.7 | 1.68x     |
| rtree              | 34.5      | ±0.2    | 0.6 | 5.22x     |

### write: large-grid (n=2500)

| Implementation    | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------- | --------- | ------- | --- | --------- |
| rtree ✓           | 1916.8    | ±62.3   | 3.2 | (fastest) |
| mortonlinearscan  | 8728.9    | ±188.2  | 2.2 | 4.55x     |
| compactlinearscan | 46008.1   | ±1245.4 | 2.7 | 24.00x    |

### write: large-overlapping (n=1250)

| Implementation    | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------- | --------- | ------- | --- | --------- |
| rtree ✓           | 3091.9    | ±64.7   | 2.1 | (fastest) |
| mortonlinearscan  | 3179.8    | ±98.6   | 3.1 | 1.03x     |
| compactlinearscan | 16450.6   | ±405.2  | 2.5 | 5.32x     |

### write: large-ranges (n=500)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 825.0     | ±17.4   | 2.1 | (fastest) |
| rtree              | 1053.0    | ±19.0   | 1.8 | 1.28x     |
| compactlinearscan  | 3422.7    | ±75.8   | 2.2 | 4.15x     |

### write: large-sequential (n=2500)

| Implementation    | Mean (µs) | ±Stddev | CV% | Relative  |
| ----------------- | --------- | ------- | --- | --------- |
| rtree ✓           | 1915.7    | ±17.5   | 0.9 | (fastest) |
| mortonlinearscan  | 7393.5    | ±94.9   | 1.3 | 3.86x     |
| compactlinearscan | 38617.1   | ±604.2  | 1.6 | 20.16x    |

### write: merge-like-blocks (n=15)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 0.9       | ±0.0    | 2.3 | (fastest) |
| compactlinearscan  | 1.7       | ±0.0    | 2.5 | 1.84x     |
| rtree              | 3.1       | ±0.1    | 3.7 | 3.26x     |

### write: row-operations (n=20)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 1.4       | ±0.0    | 3.1 | (fastest) |
| compactlinearscan  | 2.4       | ±0.1    | 2.4 | 1.73x     |
| rtree              | 5.5       | ±0.1    | 2.2 | 3.97x     |

### write: single-cell-edits (n=50)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 5.4       | ±0.1    | 1.9 | (fastest) |
| rtree              | 15.1      | ±0.5    | 3.2 | 2.79x     |
| compactlinearscan  | 16.1      | ±0.5    | 3.2 | 2.98x     |

### write: sparse-grid (n=60)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 7.3       | ±0.2    | 2.7 | (fastest) |
| compactlinearscan  | 18.3      | ±0.4    | 2.4 | 2.52x     |
| rtree              | 20.2      | ±0.7    | 3.4 | 2.78x     |

### write: sparse-large-ranges (n=30)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 2.4       | ±0.0    | 1.9 | (fastest) |
| compactlinearscan  | 5.2       | ±0.1    | 2.3 | 2.19x     |
| rtree              | 9.1       | ±0.3    | 3.7 | 3.85x     |

### write: sparse-overlapping (n=40)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 8.9       | ±0.3    | 3.8 | (fastest) |
| compactlinearscan  | 14.7      | ±0.4    | 2.5 | 1.65x     |
| rtree              | 65.8      | ±1.7    | 2.5 | 7.36x     |

### write: sparse-sequential (n=50)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 5.4       | ±0.1    | 2.1 | (fastest) |
| compactlinearscan  | 10.3      | ±0.3    | 3.3 | 1.89x     |
| rtree              | 18.8      | ±0.6    | 3.2 | 3.45x     |

### write: striping-alternating-rows (n=25)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 1.8       | ±0.0    | 1.1 | (fastest) |
| compactlinearscan  | 3.7       | ±0.0    | 1.1 | 2.02x     |
| rtree              | 7.2       | ±0.1    | 2.0 | 3.94x     |

---

**Note**: CV% (Coefficient of Variation) measures result stability. Lower is better (< 5% = stable).
