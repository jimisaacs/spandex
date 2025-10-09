# Benchmark Analysis Results

**Date**: 2025-10-09T19:31:57.186Z
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
| mortonlinearscan | 28   | 80%      | 14397.3       |
| rstartree        | 7    | 20%      | 4717.9        |

### Statistical Quality

| Implementation   | Avg CV% | Max CV% | Status      |
| ---------------- | ------- | ------- | ----------- |
| mortonlinearscan | 5.95    | 30.73   | ❌ Unstable |
| rstartree        | 5.58    | 31.84   | ❌ Unstable |

## Detailed Results

### mixed: large-overlapping (n=500) 80/20

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 1295.3    | ±12.9   | 1.0 | (fastest) |
| rstartree          | 4627.6    | ±14.7   | 0.3 | 3.57x     |

### mixed: large-sequential (n=1000) 80/20

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 2961.4    | ±6.9    | 0.2 | (fastest) |
| mortonlinearscan | 4491.1    | ±53.3   | 1.2 | 1.52x     |

### mixed: sparse-overlapping (n=40) 80/20

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 28.5      | ±0.2    | 0.7 | (fastest) |
| rstartree          | 272.5     | ±1.5    | 0.6 | 9.58x     |

### mixed: sparse-sequential (n=50) 80/20

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 22.4      | ±0.3    | 1.4 | (fastest) |
| rstartree          | 82.4      | ±0.3    | 0.3 | 3.67x     |

### query-only: large (n=5000, 10k queries)

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 58451.2   | ±297.2  | 0.5 | (fastest) |
| mortonlinearscan | 366315.3  | ±1537.6 | 0.4 | 6.27x     |

### query-only: overlapping (n=1000, 10k queries)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 7105.0    | ±118.8  | 1.7 | (fastest) |
| rstartree          | 23137.7   | ±75.9   | 0.3 | 3.26x     |

### query-only: sequential (n=1000, 10k queries)

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 3646.0    | ±35.5   | 1.0 | (fastest) |
| mortonlinearscan | 4553.8    | ±17.3   | 0.4 | 1.25x     |

### read: column-operations (n=20) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 9.0       | ±0.1    | 1.2 | (fastest) |
| rstartree          | 26.6      | ±0.2    | 0.8 | 2.95x     |

### read: diagonal-selection (n=30) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 21.1      | ±0.8    | 4.0 | (fastest) |
| rstartree          | 141.0     | ±0.5    | 0.4 | 6.68x     |

### read: large-grid (n=2500) + 100 queries

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 9081.2    | ±32.5   | 0.4 | (fastest) |
| mortonlinearscan | 25654.5   | ±698.2  | 2.7 | 2.83x     |

### read: large-overlapping (n=1250) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 7921.3    | ±77.5   | 1.0 | (fastest) |
| rstartree          | 13929.0   | ±185.3  | 1.3 | 1.76x     |

### read: large-ranges (n=500) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 1796.9    | ±14.0   | 0.8 | (fastest) |
| rstartree          | 4232.6    | ±7.7    | 0.2 | 2.36x     |

### read: large-sequential (n=2500) + 100 queries

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 7840.9    | ±35.0   | 0.4 | (fastest) |
| mortonlinearscan | 23600.7   | ±323.7  | 1.4 | 3.01x     |

### read: merge-like-blocks (n=15) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 7.7       | ±0.1    | 1.0 | (fastest) |
| rstartree          | 16.9      | ±0.1    | 0.7 | 2.18x     |

### read: row-operations (n=20) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 9.2       | ±0.1    | 1.0 | (fastest) |
| rstartree          | 26.7      | ±0.2    | 0.6 | 2.89x     |

### read: single-cell-edits (n=50) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 20.6      | ±0.2    | 1.1 | (fastest) |
| rstartree          | 69.9      | ±0.4    | 0.5 | 3.40x     |

### read: sparse-grid (n=60) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 25.3      | ±0.3    | 1.1 | (fastest) |
| rstartree          | 94.8      | ±0.3    | 0.4 | 3.75x     |

### read: sparse-large-ranges (n=30) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 12.1      | ±0.2    | 1.4 | (fastest) |
| rstartree          | 40.8      | ±0.2    | 0.4 | 3.37x     |

### read: sparse-overlapping (n=40) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 28.4      | ±1.5    | 5.4 | (fastest) |
| rstartree          | 273.1     | ±1.7    | 0.6 | 9.61x     |

### read: sparse-sequential (n=50) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 21.5      | ±0.5    | 2.5 | (fastest) |
| rstartree          | 83.4      | ±1.2    | 1.4 | 3.88x     |

### read: striping-alternating-rows (n=25) + 100 queries

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 10.9      | ±0.3    | 2.8 | (fastest) |
| rstartree          | 34.1      | ±0.5    | 1.4 | 3.12x     |

### write: column-operations (n=20)

| Implementation     | Mean (µs) | ±Stddev | CV%  | Relative  |
| ------------------ | --------- | ------- | ---- | --------- |
| mortonlinearscan ✓ | 5.5       | ±1.6    | 29.0 | (fastest) |
| rstartree          | 23.6      | ±6.7    | 28.4 | 4.30x     |

### write: diagonal-selection (n=30)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 16.3      | ±0.2    | 1.3 | (fastest) |
| rstartree          | 134.9     | ±0.9    | 0.6 | 8.28x     |

### write: large-grid (n=2500)

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 9605.4    | ±70.3   | 0.7 | (fastest) |
| mortonlinearscan | 27308.2   | ±386.1  | 1.4 | 2.84x     |

### write: large-overlapping (n=1250)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 7907.9    | ±148.3  | 1.9 | (fastest) |
| rstartree          | 13347.7   | ±139.8  | 1.0 | 1.69x     |

### write: large-ranges (n=500)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 1783.6    | ±13.6   | 0.8 | (fastest) |
| rstartree          | 4221.8    | ±16.8   | 0.4 | 2.37x     |

### write: large-sequential (n=2500)

| Implementation   | Mean (µs) | ±Stddev | CV% | Relative  |
| ---------------- | --------- | ------- | --- | --------- |
| rstartree ✓      | 7998.1    | ±71.2   | 0.9 | (fastest) |
| mortonlinearscan | 23818.2   | ±243.9  | 1.0 | 2.98x     |

### write: merge-like-blocks (n=15)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 3.4       | ±0.0    | 1.4 | (fastest) |
| rstartree          | 10.5      | ±0.1    | 1.2 | 3.08x     |

### write: row-operations (n=20)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 5.1       | ±0.3    | 5.9 | (fastest) |
| rstartree          | 20.8      | ±0.8    | 4.0 | 4.10x     |

### write: single-cell-edits (n=50)

| Implementation     | Mean (µs) | ±Stddev | CV%  | Relative  |
| ------------------ | --------- | ------- | ---- | --------- |
| mortonlinearscan ✓ | 19.2      | ±5.4    | 28.1 | (fastest) |
| rstartree          | 74.3      | ±21.2   | 28.5 | 3.87x     |

### write: sparse-grid (n=60)

| Implementation     | Mean (µs) | ±Stddev | CV%  | Relative  |
| ------------------ | --------- | ------- | ---- | --------- |
| mortonlinearscan ✓ | 24.5      | ±7.0    | 28.5 | (fastest) |
| rstartree          | 108.3     | ±29.2   | 27.0 | 4.42x     |

### write: sparse-large-ranges (n=30)

| Implementation     | Mean (µs) | ±Stddev | CV%  | Relative  |
| ------------------ | --------- | ------- | ---- | --------- |
| mortonlinearscan ✓ | 9.2       | ±2.8    | 30.7 | (fastest) |
| rstartree          | 40.6      | ±11.2   | 27.6 | 4.44x     |

### write: sparse-overlapping (n=40)

| Implementation     | Mean (µs) | ±Stddev | CV%  | Relative  |
| ------------------ | --------- | ------- | ---- | --------- |
| mortonlinearscan ✓ | 28.6      | ±8.2    | 28.6 | (fastest) |
| rstartree          | 335.2     | ±99.5   | 29.7 | 11.73x    |

### write: sparse-sequential (n=50)

| Implementation     | Mean (µs) | ±Stddev | CV%  | Relative  |
| ------------------ | --------- | ------- | ---- | --------- |
| mortonlinearscan ✓ | 18.1      | ±1.9    | 10.4 | (fastest) |
| rstartree          | 109.5     | ±34.9   | 31.8 | 6.04x     |

### write: striping-alternating-rows (n=25)

| Implementation     | Mean (µs) | ±Stddev | CV% | Relative  |
| ------------------ | --------- | ------- | --- | --------- |
| mortonlinearscan ✓ | 6.7       | ±0.3    | 5.1 | (fastest) |
| rstartree          | 27.5      | ±0.2    | 0.7 | 4.12x     |

---

**Note**: CV% (Coefficient of Variation) measures result stability. Lower is better (< 5% = stable).
