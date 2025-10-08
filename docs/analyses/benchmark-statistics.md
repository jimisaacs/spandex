# Benchmark Analysis Results

**Date**: 2025-10-08T15:55:40.072Z
**Runs**: 5
**Method**: Statistical analysis (mean ± stddev, CV%)

> **⚠️ CI Environment Note**: When run in GitHub Actions, expect higher CV% (>20%) due to shared/noisy runners.
> CI benchmarks are for **regression detection**, not research-grade measurements.
> For academic rigor, run on dedicated/idle hardware with CV% <5%.

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
| mortonlinearscan | 25   | 71%      | 30682.5       |
| rstartree        | 10   | 29%      | 2322.6        |

### Statistical Quality

| Implementation   | Avg CV% | Max CV% | Status      |
| ---------------- | ------- | ------- | ----------- |
| mortonlinearscan | 4.86    | 29.68   | ❌ Unstable |
| rstartree        | 4.78    | 29.86   | ❌ Unstable |

## Detailed Results

### mixed: large-overlapping (n=500) 80/20

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 1113.9    | ±11.1   | 1.0 | (fastest) |
| rstartree          | 2001.7    | ±9.5    | 0.5 | 1.80x     |

### mixed: large-sequential (n=1000) 80/20

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 1432.6    | ±7.2    | 0.5 | (fastest) |
| mortonlinearscan | 4027.7    | ±163.4  | 4.1 | 2.81x     |

### mixed: sparse-overlapping (n=40) 80/20

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 20.3      | ±0.3    | 1.5 | (fastest) |
| rstartree          | 127.6     | ±3.2    | 2.5 | 6.30x     |

### mixed: sparse-sequential (n=50) 80/20

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 12.9      | ±0.1    | 1.1 | (fastest) |
| rstartree          | 39.9      | ±0.2    | 0.6 | 3.08x     |

### query-only: large (n=5000, 10k queries)

| Implementation   | Mean (µs) | ±Stddev  | CV% | Relative  |
| ---------------- | --------- | -------- | --- | --------- |
| rstartree ✓      | 23721.5   | ±315.2   | 1.3 | (fastest) |
| mortonlinearscan | 878925.1  | ±14553.9 | 1.7 | 37.05x    |

### query-only: overlapping (n=1000, 10k queries)

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 23367.5   | ±172.6  | 0.7 | (fastest) |
| mortonlinearscan | 64061.7   | ±931.2  | 1.5 | 2.74x     |

### query-only: sequential (n=1000, 10k queries)

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 1864.5    | ±14.2   | 0.8 | (fastest) |
| mortonlinearscan | 42166.9   | ±1599.7 | 3.8 | 22.62x    |

### read: column-operations (n=20) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 14.5      | ±0.2    | 1.3 | (fastest) |
| rstartree          | 24.0      | ±0.4    | 1.6 | 1.66x     |

### read: diagonal-selection (n=30) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 35.9      | ±0.2    | 0.5 | (fastest) |
| rstartree          | 70.8      | ±1.0    | 1.4 | 1.97x     |

### read: large-grid (n=2500) + 100 queries

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 3368.1    | ±29.2   | 0.9 | (fastest) |
| mortonlinearscan | 16195.2   | ±613.3  | 3.8 | 4.81x     |

### read: large-overlapping (n=1250) + 100 queries

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 5247.7    | ±28.0   | 0.5 | (fastest) |
| mortonlinearscan | 7085.5    | ±134.9  | 1.9 | 1.35x     |

### read: large-ranges (n=500) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 1735.5    | ±37.8   | 2.2 | (fastest) |
| rstartree          | 1797.2    | ±7.6    | 0.4 | 1.04x     |

### read: large-sequential (n=2500) + 100 queries

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 3365.9    | ±28.8   | 0.9 | (fastest) |
| mortonlinearscan | 17163.9   | ±148.5  | 0.9 | 5.10x     |

### read: merge-like-blocks (n=15) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 8.6       | ±0.0    | 0.3 | (fastest) |
| rstartree          | 11.3      | ±0.5    | 4.5 | 1.32x     |

### read: row-operations (n=20) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 11.6      | ±0.1    | 0.4 | (fastest) |
| rstartree          | 14.4      | ±0.2    | 1.1 | 1.24x     |

### read: single-cell-edits (n=50) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 27.1      | ±0.1    | 0.3 | (fastest) |
| rstartree          | 31.0      | ±0.3    | 1.0 | 1.14x     |

### read: sparse-grid (n=60) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 34.3      | ±0.3    | 0.9 | (fastest) |
| rstartree          | 44.5      | ±0.4    | 1.0 | 1.30x     |

### read: sparse-large-ranges (n=30) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 12.9      | ±0.2    | 1.7 | (fastest) |
| rstartree          | 26.7      | ±0.2    | 0.8 | 2.07x     |

### read: sparse-overlapping (n=40) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 32.4      | ±0.4    | 1.1 | (fastest) |
| rstartree          | 124.0     | ±1.3    | 1.1 | 3.83x     |

### read: sparse-sequential (n=50) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 29.1      | ±0.2    | 0.7 | (fastest) |
| rstartree          | 40.6      | ±1.0    | 2.5 | 1.39x     |

### read: striping-alternating-rows (n=25) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 13.0      | ±0.1    | 0.7 | (fastest) |
| rstartree          | 16.9      | ±0.1    | 0.6 | 1.30x     |

### write: column-operations (n=20)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 2.6       | ±0.0    | 1.6 | (fastest) |
| rstartree          | 11.4      | ±0.2    | 2.0 | 4.33x     |

### write: diagonal-selection (n=30)

| Implementation     | Mean (µs) | ±Stddev | CV%  | Relative  |
| ------------------ | --------- | ------- | ---- | --------- |
| mortonlinearscan ✓ | 13.4      | ±3.7    | 27.7 | (fastest) |
| rstartree          | 73.6      | ±20.3   | 27.6 | 5.49x     |

### write: large-grid (n=2500)

| Implementation   | Mean (µs) | ±Stddev | CV%  | Relative  |
| ---------------- | --------- | ------- | ---- | --------- |
| rstartree ✓      | 3268.0    | ±33.1   | 1.0  | (fastest) |
| mortonlinearscan | 16307.6   | ±2502.1 | 15.3 | 4.99x     |

### write: large-overlapping (n=1250)

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 5132.3    | ±13.1   | 0.3 | (fastest) |
| mortonlinearscan | 5760.4    | ±126.4  | 2.2 | 1.12x     |

### write: large-ranges (n=500)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 1310.7    | ±40.3   | 3.1 | (fastest) |
| rstartree          | 1782.9    | ±10.5   | 0.6 | 1.36x     |

### write: large-sequential (n=2500)

| Implementation   | Mean (µs) | ±Stddev | CV%  | Relative  |
| ---------------- | --------- | ------- | ---- | --------- |
| rstartree ✓      | 4000.7    | ±1194.6 | 29.9 | (fastest) |
| mortonlinearscan | 17700.5   | ±3012.1 | 17.0 | 4.42x     |

### write: merge-like-blocks (n=15)

| Implementation     | Mean (µs) | ±Stddev | CV%  | Relative  |
| ------------------ | --------- | ------- | ---- | --------- |
| mortonlinearscan ✓ | 2.1       | ±0.6    | 29.7 | (fastest) |
| rstartree          | 8.5       | ±1.8    | 20.9 | 4.01x     |

### write: row-operations (n=20)

| Implementation     | Mean (µs) | ±Stddev | CV%  | Relative  |
| ------------------ | --------- | ------- | ---- | --------- |
| mortonlinearscan ✓ | 2.8       | ±0.1    | 2.5  | (fastest) |
| rstartree          | 12.9      | ±3.3    | 25.2 | 4.59x     |

### write: single-cell-edits (n=50)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 9.2       | ±0.1    | 0.8 | (fastest) |
| rstartree          | 28.1      | ±0.4    | 1.6 | 3.06x     |

### write: sparse-grid (n=60)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 13.7      | ±0.6    | 4.1 | (fastest) |
| rstartree          | 37.4      | ±0.5    | 1.3 | 2.73x     |

### write: sparse-large-ranges (n=30)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 4.5       | ±0.1    | 2.0 | (fastest) |
| rstartree          | 17.7      | ±0.3    | 1.8 | 3.95x     |

### write: sparse-overlapping (n=40)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 17.6      | ±0.4    | 2.2 | (fastest) |
| rstartree          | 126.4     | ±1.4    | 1.1 | 7.20x     |

### write: sparse-sequential (n=50)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 11.3      | ±0.2    | 1.9 | (fastest) |
| rstartree          | 36.6      | ±0.8    | 2.1 | 3.24x     |

### write: striping-alternating-rows (n=25)

| Implementation     | Mean (µs) | ±Stddev | CV%  | Relative  |
| ------------------ | --------- | ------- | ---- | --------- |
| mortonlinearscan ✓ | 4.4       | ±1.3    | 28.8 | (fastest) |
| rstartree          | 16.5      | ±4.4    | 26.9 | 3.74x     |

---

**Note**: CV% (Coefficient of Variation) measures result stability. Lower is better (< 5% = stable).
