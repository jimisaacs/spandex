# Scripts

**Automation and tooling** - files you run with `deno run`

---

## Benchmark Automation

### `update-benchmarks.ts`

Runs benchmarks and generates `BENCHMARKS.md`.

**Run**: `deno task bench:update`

**What it does**:

1. Runs `deno bench benchmarks/performance.ts --json`
2. Parses results
3. Generates formatted `BENCHMARKS.md` with comparison tables

**Output**: `BENCHMARKS.md` (auto-generated, don't edit manually)

### `analyze-benchmarks.ts`

Runs benchmarks multiple times for statistical analysis.

**Run**: `deno task bench:analyze <runs> <output-file>`

**Example**: `deno task bench:analyze 5 docs/analyses/benchmark-statistics.md`

**What it does**:

1. Runs `deno bench` N times
2. Calculates mean, stddev, CV% for each scenario
3. Generates statistical report with confidence intervals

**Output**: Markdown file with statistical analysis

---

## Implementation Lifecycle

### `archive-impl.ts`

Archives an implementation (moves to `archive/`, updates imports).

**Run**: `deno task archive:impl <name> <category>`

**Categories**: `superseded` | `failed-experiments`

**Example**: `deno task archive:impl HybridRTree failed-experiments`

**What it does**:

1. Moves `src/implementations/X.ts` → `archive/src/implementations/<category>/X.ts`
2. Moves `test/X.test.ts` → `archive/test/<category>/X.test.ts`
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
