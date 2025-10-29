# Active Research Workspace

This directory is for experiments currently in progress. Right now it's empty - all planned experiments have been completed.

## How Experiments Work

When testing a new idea:

1. Create a document in `experiments/` describing the hypothesis
2. Implement the algorithm in `packages/@jim/spandex/src/index/[name].ts`
3. Write tests and run benchmarks with statistical analysis
4. Document the outcome (success, failure, or "needs more work")

When the experiment concludes:

**Successful** → Findings go to `docs/analyses/`, implementation stays active, delete experiment doc

**Failed** → Everything moves to `archive/docs/experiments/` with full writeup

**Inconclusive** → Leave here with notes for future investigation

## Why Keep It Empty?

An empty `active/` directory means all research questions have been answered (for now). It's a sign of completion, not inactivity.

New experiments will be added when:

- New use cases emerge that existing implementations don't handle well
- Technology changes (e.g., WASM becomes practical, new JS engine optimizations)
- Someone has a promising idea that hasn't been tried yet (check `archive/` first!)

For the current state of implementations and validated findings, see `docs/core/RESEARCH-SUMMARY.md`.
