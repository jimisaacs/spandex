# Documentation Index

**Spatial Indexing Research** - 2D range decomposition for spreadsheet systems

---

## Quick Start

| Audience         | Start Here                                                | Then Read                                                  |
| ---------------- | --------------------------------------------------------- | ---------------------------------------------------------- |
| **Users**        | [Main README](../README.md)                               | [BENCHMARKS](../BENCHMARKS.md)                             |
| **Researchers**  | [RESEARCH-SUMMARY](./core/RESEARCH-SUMMARY.md)            | [theoretical-foundation](./core/theoretical-foundation.md) |
| **Contributors** | [IMPLEMENTATION-LIFECYCLE](./IMPLEMENTATION-LIFECYCLE.md) | [RESEARCH-SUMMARY](./core/RESEARCH-SUMMARY.md)             |

---

## Structure

```
docs/
├── core/               # Research summary + theoretical foundation
├── analyses/           # Validated findings (Hilbert, R*, sparse data, etc.)
├── diagrams/           # Visual explanations
└── active/             # Current experiments (empty when idle)

archive/docs/           # Rejected experiments
```

---

## Core Documents

- **[RESEARCH-SUMMARY.md](./core/RESEARCH-SUMMARY.md)** - Executive summary of all findings
- **[theoretical-foundation.md](./core/theoretical-foundation.md)** - Algorithms, proofs, complexity analysis

---

## Analyses

| File                     | Finding                                             |
| ------------------------ | --------------------------------------------------- |
| compact-morton-analysis  | Simplified encoding beats complex Morton by 20%     |
| hilbert-curve-analysis   | Spatial locality → 2x speedup                       |
| sparse-data-analysis     | Linear scan wins for n<100                          |
| transition-zone-analysis | Crossover points vary by workload                   |
| r-star-analysis          | R* fastest construction, workload-dependent queries |
| alternatives-analysis    | Why rectangle decomposition over alternatives       |
| benchmark-statistics     | Statistical analysis (5-run validation)             |

---

## Archived Experiments

See `archive/docs/` for rejected experiments. All failed hypotheses are preserved for reproducibility.

---

## Reading Paths

| Goal       | Path                                                        |
| ---------- | ----------------------------------------------------------- |
| Use this   | README → PRODUCTION-GUIDE → BENCHMARKS                      |
| Understand | theoretical-foundation → analyses/                          |
| Contribute | RESEARCH-SUMMARY → IMPLEMENTATION-LIFECYCLE → active/README |
