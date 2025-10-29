# Documentation

Research and development documentation for [@jim/spandex](https://jsr.io/@jim/spandex).

## Quick Links by Role

**New to rectangle decomposition?** Start with [RECTANGLE-DECOMPOSITION-PRIMER](./RECTANGLE-DECOMPOSITION-PRIMER.md) - explains three strategies for handling overlapping rectangles.

**Using the library?**

- [PRODUCTION-GUIDE](../PRODUCTION-GUIDE.md) - Algorithm selection and migration
- [BENCHMARKS](../BENCHMARKS.md) - Current performance data
- [benchmark-statistics](./analyses/benchmark-statistics.md) - Statistical methodology

**Contributing?**

- [IMPLEMENTATION-LIFECYCLE](./IMPLEMENTATION-LIFECYCLE.md) - Add/archive implementations
- [BENCHMARK-FRAMEWORK](./BENCHMARK-FRAMEWORK.md) - Run and understand benchmarks
- [TELEMETRY-GUIDE](./TELEMETRY-GUIDE.md) - Production instrumentation

**Interested in the research?**

- [RESEARCH-SUMMARY](./core/RESEARCH-SUMMARY.md) - Key findings (5 min read)
- [theoretical-foundation](./core/theoretical-foundation.md) - Proofs and complexity analysis
- [analyses/](./analyses/) - Individual experiment results

## Structure

```
docs/
├── core/                            # Theory + validated findings
├── analyses/                        # Individual experiment results
├── diagrams/                        # Visual explanations (ASCII)
├── active/experiments/              # In-progress work (empty when idle)
│
├── RECTANGLE-DECOMPOSITION-PRIMER.md  # Educational introduction
├── IMPLEMENTATION-LIFECYCLE.md        # Add/archive/restore workflows
├── BENCHMARK-FRAMEWORK.md             # Performance testing guide
└── TELEMETRY-GUIDE.md                 # Production instrumentation

archive/docs/experiments/            # Rejected experiments (preserved)
```

## Core Research

**Executive summary**: [RESEARCH-SUMMARY](./core/RESEARCH-SUMMARY.md) provides overview of all findings (5 min read)

**Theory**: [theoretical-foundation](./core/theoretical-foundation.md) contains mathematical proofs and complexity analysis

## Key Experiments

Each analysis document includes hypothesis, methodology, data, and conclusions:

- [morton-vs-hilbert-analysis](./analyses/morton-vs-hilbert-analysis.md) - Why Morton curve is 25% faster than Hilbert
- [sparse-data-analysis](./analyses/sparse-data-analysis.md) - Why linear scan wins for n<100
- [transition-zone-analysis](./analyses/transition-zone-analysis.md) - Crossover thresholds by workload (100 < n < 600)
- [r-star-analysis](./analyses/r-star-analysis.md) - Split algorithm comparison (R* vs Midpoint vs Quadratic)
- [adversarial-patterns](./analyses/adversarial-patterns.md) - Worst-case fragmentation validation
- [benchmark-statistics](./analyses/benchmark-statistics.md) - Statistical methodology and confidence

**Related work**: [alternatives-analysis](./analyses/alternatives-analysis.md) (quadtrees, grids, etc.) • [related-work](./analyses/related-work.md) (modern techniques)

**Failed experiments**: See `archive/docs/experiments/` for rejected approaches and lessons learned
