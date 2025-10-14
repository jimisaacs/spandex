# Benchmark Framework

**Purpose**: Flexible benchmark execution with opt-in archived implementations

---

## Basic Usage

### Run Active Implementations Only (Default)

```bash
deno task bench
```

Runs benchmarks for all implementations in `packages/@jim/spandex/src/implementations/`. The framework automatically discovers them via file system scanning.

---

## Advanced Usage

### Include Archived Implementations

```bash
deno task bench:archived
# or
deno bench benchmarks/performance.ts -- --include-archived
# or
deno bench benchmarks/performance.ts -- --archived
```

Automatically discovers and includes implementations from `archive/src/implementations/` for comparison.

### Exclude Specific Active Implementations

```bash
# Exclude one implementation
deno bench benchmarks/performance.ts -- --exclude=CompactRTree

# Exclude multiple implementations (example with archived implementations)
deno bench benchmarks/performance.ts -- --exclude=CompactRTree --exclude=CompactLinearScan

# Combine with archived
deno bench benchmarks/performance.ts -- --include-archived --exclude=LinearScan
```

---

## Auto-Discovery

**Convention over configuration**: Implementations are automatically discovered!

### Active Implementations

Automatically discovered from `packages/@jim/spandex/src/implementations/` directory. All `.ts` files are included.

**To add a new implementation**:

1. Create `packages/@jim/spandex/src/implementations/newimpl.ts`
2. Run `deno task bench` - automatically included!

### Archived Implementations

**Note**: Archived implementations have been removed from the repository. The `--include-archived` flag is preserved for potential future use, but currently no archived implementations exist to benchmark.

To compare against historical implementations:

1. Check `archive/IMPLEMENTATION-HISTORY.md` for the git SHA
2. Extract the implementation: `git show <SHA>:path/to/file.ts > /tmp/impl.ts`
3. Manually create a temporary benchmark (adjust imports as needed)

---

## Framework Design

### Principles

1. **Active by default**: Implementations in `packages/@jim/spandex/src/implementations/` run automatically
2. **Selective exclusion**: Can exclude specific implementations via `--exclude=`
3. **No configuration needed**: Auto-discovery means adding/removing just works

### How It Works

**Discovery**:

- Scans `packages/@jim/spandex/src/implementations/` directory for all `.ts` files

**Filtering**:

- Remove any implementations matching `--exclude=<name>` flags

**Execution**:

- Run all scenarios for each implementation in the final list
- Report results

### Selective Filtering

**Focus on specific implementations**:

```bash
# Exclude implementations you don't want to benchmark
deno bench benchmarks/performance.ts -- --exclude=RStarTree

# Exclude multiple
deno bench benchmarks/performance.ts -- --exclude=RStarTree --exclude=MortonLinearScan
```

---

## Use Cases

### Focus on Specific Implementations

```bash
# Example: Only test R-tree (exclude linear scan)
deno bench benchmarks/performance.ts -- --exclude=MortonLinearScan

# Example: Only test linear scan (exclude R-tree)
deno bench benchmarks/performance.ts -- --exclude=RStarTree
```

### Test New Implementation Against Current

```bash
# Add new implementation to packages/@jim/spandex/src/implementations/
# It's automatically discovered!
deno task bench
```

---

## Examples

### Test Only Linear Scan Implementation

```bash
deno bench benchmarks/performance.ts -- --exclude=RStarTree
```

### Test Only R-Tree Implementation

```bash
deno bench benchmarks/performance.ts -- --exclude=MortonLinearScan
```

### Faster Iteration During Development

```bash
# If you're working on MortonLinearScan, exclude RStarTree to speed up benchmarks
deno bench benchmarks/performance.ts -- --exclude=RStarTree
```

---

## Configuration Reference

### Command-Line Flags

| Flag               | Effect                             | Example                   |
| ------------------ | ---------------------------------- | ------------------------- |
| `--exclude=<name>` | Exclude specific implementation    | `--exclude=RStarTree`     |
| (multiple)         | Can use multiple `--exclude` flags | `--exclude=A --exclude=B` |

### Tasks

| Task            | Command                                                                             | Purpose                        |
| --------------- | ----------------------------------------------------------------------------------- | ------------------------------ |
| `bench`         | `deno bench benchmarks/performance.ts`                                              | Run all active implementations |
| `bench:update`  | `deno run -A scripts/update-benchmarks.ts`                                          | Regenerate BENCHMARKS.md       |
| `bench:analyze` | `deno run -A scripts/analyze-benchmarks.ts 5 docs/analyses/benchmark-statistics.md` | Statistical analysis (~30 min) |

---

## Best Practices

### Use `--exclude` For

- Focusing on specific implementation during development
- Faster iteration (benchmark only what you're working on)
- Comparing specific algorithm approaches

---

## Maintenance

### Adding New Active Implementation

1. Create implementation in `packages/@jim/spandex/src/implementations/`
2. Verify: `deno task bench` (automatically discovered!)

### Archiving Implementation

Use `deno task archive:impl <name> <category>` - automatically:

- Removes files from active codebase
- Documents in `archive/IMPLEMENTATION-HISTORY.md`
- Preserves code in git history

Next benchmark run will automatically exclude the archived implementation.

### Unarchiving Implementation

Use `deno task unarchive:impl <name> <category>` - restores from git history and automatically adds back to active benchmarks.

---

## Troubleshooting

**Implementation not benchmarking**: Ensure file exists in `packages/@jim/spandex/src/implementations/` and exports a default class.

**Type errors**: Run `deno task check` to verify implementation type-checks correctly.

---

## Philosophy

**Active implementations** (in `packages/@jim/spandex/src/implementations/`) represent the current state of the art - they're production candidates that should always be benchmarked.

**Archived implementations** are preserved in git history and documentation - they represent what we tried, why it didn't work, and what we learned. Code is removed to avoid maintenance burden, but findings are preserved for reproducibility.

This framework embodies the principle: **"Benchmark what matters, document what doesn't."**
