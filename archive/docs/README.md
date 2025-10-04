# Research Archive

**Purpose**: Historical record of rejected experiments

**Philosophy**: Negative results are scientifically valuable. We preserve them for transparency and to prevent repeating failed approaches.

---

## Contents

- **[RESEARCH-ARCHIVE-SUMMARY.md](./RESEARCH-ARCHIVE-SUMMARY.md)** - Overview of all archived experiments
- **[experiments/](./experiments/)** - Individual experiment documents (9 files)
- **[benchmarks/](../benchmarks/)** - Archived benchmark scripts (5 files)
- **[test/](../test/)** - Archived test files (1 file)

---

## Quick Reference

| Experiment    | Hypothesis                                | Result             | Key Learning                  |
| ------------- | ----------------------------------------- | ------------------ | ----------------------------- |
| Fast R-tree   | R* axis + midpoint = quality without cost | ❌ 1.29x slower    | Half-measures don't work      |
| Tree Quality  | R* split improves query performance       | ❌ Midpoint faster | Theory ≠ practice             |
| Hybrid R-tree | TypedArray + R-tree = best of both        | ❌ 1.9-27x slower  | Indirection kills performance |

**Full details**: See [RESEARCH-ARCHIVE-SUMMARY.md](./RESEARCH-ARCHIVE-SUMMARY.md)

---

## Archive Criteria

Experiments archived when:

- Hypothesis definitively rejected
- Full analysis completed
- Implementation removed

---

## Research Philosophy

Negative results are scientifically valuable. These experiments represent rigorous process:

1. Hypothesis
2. Implementation
3. Statistical analysis
4. Honest reporting

Each rejection narrows the search space. Ask "What did we learn?" not "Why did it fail?"
