# Scripts

**Automation and tooling** - files you run with `deno run`

---

## ⚠️ CRITICAL: Two Benchmark Scripts - Different Use Cases

| Script                  | Generates                               | Duration | When to run                 |
| ----------------------- | --------------------------------------- | -------- | --------------------------- |
| `update-benchmarks.ts`  | `BENCHMARKS.md`                         | ~2 min   | Frequently during iteration |
| `analyze-benchmarks.ts` | `docs/analyses/benchmark-statistics.md` | ~30 min  | Before completing tasks     |

**Workflow**:

```bash
# During development - quick feedback:
deno task bench:update  # Run frequently

# Before completing/committing - ensure both docs current:
deno task bench:update
deno task bench:analyze 5 docs/analyses/benchmark-statistics.md
```

**Why both?**

1. `BENCHMARKS.md` - Quick performance overview for iteration
2. `benchmark-statistics.md` - Statistical validation for completion

**Both must be current before completing tasks.**

---

## Documentation Sync

### `sync-docs.ts`

AI assistant utility to auto-sync documentation when code changes.

**Run**: `deno task sync-docs`

**What it does**:

1. Detects changed files (implementations, tests, benchmarks)
2. Regenerates appropriate documentation (`BENCHMARKS.md`)
3. Reports what was updated

**When to run**: After archiving/unarchiving implementations or modifying active implementations

**Note**: This is primarily used by AI assistants (Claude Code, Cursor IDE) to prevent documentation drift. Manually run if you notice docs are out of sync.

---

## Benchmark Automation

### `update-benchmarks.ts`

Runs benchmarks and generates `BENCHMARKS.md`.

**Run**: `deno task bench:update`

**What it does**:

1. Runs `deno bench benchmarks/performance.ts` (parses text table output)
2. Extracts performance data
3. Generates formatted `BENCHMARKS.md` with comparison tables

**Output**: `BENCHMARKS.md` (auto-generated, don't edit manually)

**Note**: Run this frequently during iteration. Before completing task, also run `bench:analyze` to update stats.

### `analyze-benchmarks.ts`

Runs benchmarks multiple times for statistical analysis.

**Run**: `deno task bench:analyze <runs> <output-file>`

**Example**: `deno task bench:analyze 5 docs/analyses/benchmark-statistics.md`

**What it does**:

1. Runs `deno bench` N times
2. Calculates mean, stddev, CV% for each scenario
3. Generates statistical report with confidence intervals

**Output**: Markdown file with statistical analysis

**Note**: Run before completing tasks to ensure statistical docs are current. Also run `bench:update` to keep both docs in sync.

### `compare-benchmarks.ts`

Compares two benchmark text outputs and detects regressions.

**Run**: `deno task bench:compare <pr.txt> <main.txt> <output.md>`

**Example**:

```bash
deno bench benchmarks/performance.ts > pr-benchmarks.txt
# ... checkout main ...
deno bench benchmarks/performance.ts > main-benchmarks.txt
deno task bench:compare pr-benchmarks.txt main-benchmarks.txt comparison.md
```

**What it does**:

1. Parses text table output from `deno bench`
2. Compares performance metrics
3. Detects regressions (>20% slower) and improvements (>20% faster)
4. Generates markdown comparison table

**Exit codes**:

- 0 = No regressions
- 1 = Regressions detected
- 2 = Error (invalid input, missing files)

**Used by**: `.github/workflows/performance-regression.yml` (automated PR checks)

**Local testing**:

```bash
# Run benchmarks and save to files
deno bench benchmarks/performance.ts > pr-benchmarks.txt
# ... make changes ...
deno bench benchmarks/performance.ts > main-benchmarks.txt

# Compare
deno task bench:compare pr-benchmarks.txt main-benchmarks.txt comparison.md
echo $?  # 0=no regression, 1=regression, 2=error

# Or run without arguments to test parsing
deno run --allow-read --allow-run scripts/compare-benchmarks.ts
```

---

## Implementation Lifecycle

### `archive-impl.ts`

Archives an implementation (moves to `archive/`, updates imports).

**Run**: `deno task archive:impl <name> <category>`

**Categories**: `superseded` | `failed-experiments`

**Example**: `deno task archive:impl HybridRTree failed-experiments`

**What it does**:

1. Moves `packages/@jim/spandex/src/index/X.ts` → `archive/src/implementations/<category>/X.ts`
2. Moves `packages/@jim/spandex/test/index/X/` → `archive/test/<category>/X/`
3. Updates imports
4. Adds archive header
5. Verifies type-checking

**See**: `docs/IMPLEMENTATION-LIFECYCLE.md` for details

### `unarchive-impl.ts`

Restores an archived implementation (moves back to active).

**Run**: `deno task unarchive:impl <name> <category>`

**Example**: `deno task unarchive:impl HybridRTree failed-experiments`

**What it does**: Reverse of `archive-impl.ts`

---

## Convention

**This directory contains**: Automation, tooling, generators (scripts you `deno run`)

**For benchmark suites**: See `benchmarks/` directory (files you `deno bench`)

---

## Adding a New Script

1. Create `scripts/your-script.ts`
2. Add permissions needed (e.g., `--allow-read`, `--allow-write`)
3. Optionally add task to `deno.json`:
   ```json
   "your-task": "deno run --allow-read scripts/your-script.ts"
   ```
4. Document in this README

Example:

```typescript
// scripts/example.ts
console.log('Hello from script!');

// deno.json
{
  "tasks": {
    "example": "deno run scripts/example.ts"
  }
}

// Run with:
// deno task example
```
