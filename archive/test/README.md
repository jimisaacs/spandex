# Archived Tests

This directory contains tests for archived implementations (superseded or failed experiments).

## Purpose

Archived tests serve two purposes:

1. **Documentation**: Show why an implementation was archived (correctness issues, performance problems)
2. **Reproducibility**: Allow re-running experiments to compare against new implementations

## Running Archived Tests

**Individual test** (opt-in):

```bash
deno test archive/test/hybridrtree.test.ts
```

**All archived tests**:

```bash
deno test archive/test/
```

## Expected Behavior

**Some archived tests may fail** - this is expected and documented:

- **Failed experiments** (`failed-experiments/`): Tests fail, demonstrating why the approach was rejected
- **Superseded implementations** (`superseded/`): Tests pass, but performance is inferior to current implementations

## Example: HybridRTreeImpl (Failed Experiment)

`archive/test/hybridrtree.test.ts` - **INTENTIONALLY FAILS** 7 of 13 tests

**Why it fails:**
The hybrid architecture (TypedArray storage + separate R-tree index) has a fundamental synchronization problem: deleted entries are marked in the array but the R-tree index still points to them. Rebuilding the index on every insert would be O(n log n), defeating the purpose.

**Failed tests:**

- Overlap resolution, Last writer wins, Edge cases, Property-based, Idempotency, Fragment generation, Stress test

**Lesson:** Combining separate storage + index structures creates synchronization bugs. Either store data IN the index (RStarTreeImpl) or use no index (HilbertLinearScanImpl).

This is preserved as an educational example of an architectural dead-end.

## Active Tests

For active (passing) tests, use:

```bash
deno task test    # Active implementations only (101 passing)
```
