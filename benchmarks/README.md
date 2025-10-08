# Benchmarks

**Benchmark suites** - files you run with `deno bench`

---

## Files

### `performance.ts`

Main benchmark suite comparing all active implementations.

**Run**: `deno task bench` or `deno bench benchmarks/performance.ts`

**Scenarios**:

- Write-heavy, read-heavy, mixed workloads
- Query-only benchmarks (construction not measured)
- Various data patterns (sparse, large, overlapping)

**Used by**: `scripts/update-benchmarks.ts` and `scripts/analyze-benchmarks.ts`

### `archived-analysis.ts`

Comprehensive benchmark including archived implementations (HybridRTree).

**Run**: `deno bench benchmarks/archived-analysis.ts`

**Purpose**: Compare archived implementations against active ones to validate why experiments were rejected.

**Note**: Archived implementations may fail tests - this is expected (see `archive/test/README.md`)

---

## Convention

**This directory contains**: Benchmark **suites** (the actual benchmark code)

**For automation**: See `scripts/` directory (runners, analyzers, generators)

---

## Adding a New Benchmark Suite

1. Create `benchmarks/your-suite.ts`
2. Import implementations
3. Write `Deno.bench()` calls
4. Run with `deno bench benchmarks/your-suite.ts`

Example:

```typescript
import RStarTreeImpl from '../src/implementations/rstartree.ts';

Deno.bench('RStarTree - custom scenario', () => {
	const index = new RStarTreeImpl();
	// ... benchmark code
});
```
