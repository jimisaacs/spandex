# Documentation Index

2D rectangle decomposition with last-writer-wins conflict resolution.

**Scope**: This directory documents the spatial indexing research project (`@jim/spandex*` packages). For general-purpose snapshot testing, see `packages/@local/snapmark/README.md`.

## Navigation

**Problem understanding**: [RECTANGLE-DECOMPOSITION-PRIMER](./RECTANGLE-DECOMPOSITION-PRIMER.md) → [diagrams/](./diagrams/)

**Implementation**: [Main README](../README.md) → [BENCHMARKS](../BENCHMARKS.md) → [PRODUCTION-GUIDE](../PRODUCTION-GUIDE.md)

**Research**: [RESEARCH-SUMMARY](./core/RESEARCH-SUMMARY.md) → [analyses/](./analyses/) → [theoretical-foundation](./core/theoretical-foundation.md)

**Development**: [IMPLEMENTATION-LIFECYCLE](./IMPLEMENTATION-LIFECYCLE.md) → [BENCHMARK-FRAMEWORK](./BENCHMARK-FRAMEWORK.md)

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

## Problem Formulation

**[RECTANGLE-DECOMPOSITION-PRIMER](./RECTANGLE-DECOMPOSITION-PRIMER.md)** - Maintain disjoint partition under overlapping insertions. Three conflict resolution strategies (LWW, shallow merge, spatial join).

**Detailed explanations** (`diagrams/`):

- [Last-Writer-Wins](./diagrams/rectangle-decomposition-lww.md) - Used by this library
- [Shallow Merge](./diagrams/rectangle-decomposition-merge.md) - Property combination
- [Spatial Join](./diagrams/rectangle-decomposition-spatial-join.md) - Multi-index

## Development Guides

**[IMPLEMENTATION-LIFECYCLE.md](./IMPLEMENTATION-LIFECYCLE.md)** - Add/archive/restore implementations

**[BENCHMARK-FRAMEWORK.md](./BENCHMARK-FRAMEWORK.md)** - Performance testing and auto-discovery

**[TELEMETRY-GUIDE.md](./TELEMETRY-GUIDE.md)** - Production metrics collection

**[CLAUDE.md](./CLAUDE.md)** - Documentation standards

---

## Research Findings

**[RESEARCH-SUMMARY.md](./core/RESEARCH-SUMMARY.md)** - All validated findings

**[theoretical-foundation.md](./core/theoretical-foundation.md)** - Proofs, complexity analysis, formal model

### Validated Results (`analyses/`)

| Analysis                      | Result                                                  |
| ----------------------------- | ------------------------------------------------------- |
| morton-vs-hilbert-analysis.md | Morton 25% faster (simpler encoding, same locality)     |
| sparse-data-analysis.md       | O(n) dominates for n<100 (tree overhead > scan cost)    |
| transition-zone-analysis.md   | Empirical crossover at n≈100 (workload-validated)       |
| r-star-analysis.md            | R* split: fastest construction, query pattern-dependent |
| adversarial-patterns.md       | O(n) fragmentation bound empirically validated          |
| benchmark-statistics.md       | Methodology: 5 runs, CV%<5%, effect size >20%           |

**Rejected experiments**: `archive/docs/experiments/` (preserved for reproducibility)
