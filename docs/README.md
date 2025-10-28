# Documentation

Research and development docs for the [@jim/spandex](https://jsr.io/@jim/spandex) spatial indexing library.

**Package docs**: See individual README files in `packages/@jim/` for API reference and usage.

## Quick Links

**New here?** [RECTANGLE-DECOMPOSITION-PRIMER](./RECTANGLE-DECOMPOSITION-PRIMER.md) explains the core problem

**Using the library?** [PRODUCTION-GUIDE](../PRODUCTION-GUIDE.md) picks algorithms, [BENCHMARKS](../BENCHMARKS.md) shows performance

**Contributing?** [IMPLEMENTATION-LIFECYCLE](./IMPLEMENTATION-LIFECYCLE.md) for adding code, [BENCHMARK-FRAMEWORK](./BENCHMARK-FRAMEWORK.md) for testing

**Deep dive?** [RESEARCH-SUMMARY](./core/RESEARCH-SUMMARY.md) summarizes findings, [analyses/](./analyses/) has details

---

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
├── TELEMETRY-GUIDE.md                 # Production instrumentation
└── CLAUDE.md                          # Documentation standards

archive/docs/experiments/            # Rejected experiments (preserved)
```

---

## The Problem

Insert overlapping rectangles, maintain non-overlapping partitions. When rectangles overlap, resolve conflicts with one of three strategies:

- **Last-Writer-Wins** ([diagram](./diagrams/rectangle-decomposition-lww.md)) - What this library does
- **Shallow Merge** ([diagram](./diagrams/rectangle-decomposition-merge.md)) - Combine properties
- **Spatial Join** ([diagram](./diagrams/rectangle-decomposition-spatial-join.md)) - Keep separate, join on query

See [RECTANGLE-DECOMPOSITION-PRIMER](./RECTANGLE-DECOMPOSITION-PRIMER.md) for details.

## Guides

| Guide                                                                 | Purpose                     |
| --------------------------------------------------------------------- | --------------------------- |
| [RECTANGLE-DECOMPOSITION-PRIMER](./RECTANGLE-DECOMPOSITION-PRIMER.md) | Core problem explained      |
| [IMPLEMENTATION-LIFECYCLE](./IMPLEMENTATION-LIFECYCLE.md)             | Add/archive implementations |
| [BENCHMARK-FRAMEWORK](./BENCHMARK-FRAMEWORK.md)                       | Run performance tests       |
| [TELEMETRY-GUIDE](./TELEMETRY-GUIDE.md)                               | Collect production metrics  |
| [CLAUDE.md](./CLAUDE.md)                                              | Documentation standards     |

## Research

**Summary**: [RESEARCH-SUMMARY](./core/RESEARCH-SUMMARY.md) - Key findings and recommendations

**Theory**: [theoretical-foundation](./core/theoretical-foundation.md) - Proofs and complexity analysis

**Experiments** (`analyses/`):

| Analysis                                                      | Finding                                       |
| ------------------------------------------------------------- | --------------------------------------------- |
| [morton-vs-hilbert](./analyses/morton-vs-hilbert-analysis.md) | Morton 25% faster, simpler encoding           |
| [sparse-data](./analyses/sparse-data-analysis.md)             | Linear scan wins below n=100                  |
| [transition-zone](./analyses/transition-zone-analysis.md)     | Crossover validated at n≈100                  |
| [r-star](./analyses/r-star-analysis.md)                       | R* split best for construction                |
| [adversarial](./analyses/adversarial-patterns.md)             | O(n) fragmentation bound holds                |
| [statistics](./analyses/benchmark-statistics.md)              | Methodology: 5 runs, CV%<5%, effect size >20% |

Failed experiments in `archive/docs/experiments/` (kept for reference).
