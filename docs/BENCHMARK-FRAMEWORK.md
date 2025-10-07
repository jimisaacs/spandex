# Benchmark Framework

**Purpose**: Flexible benchmark execution with opt-in archived implementations

---

## Basic Usage

### Run Active Implementations Only (Default)

```bash
deno task bench
```

Runs benchmarks for all implementations in `src/implementations/`. The framework automatically discovers them via file system scanning.

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

Includes implementations from `archive/src/implementations/` for comparison.

**Note**: You must manually add archived implementations to the `archivedImplementations` array in `benchmarks/performance.ts` (see below).

### Exclude Specific Active Implementations

```bash
# Exclude one implementation
deno bench benchmarks/performance.ts -- --exclude=CompactRTree

# Exclude multiple implementations
deno bench benchmarks/performance.ts -- --exclude=CompactRTree --exclude=CompactLinearScan

# Combine with archived
deno bench benchmarks/performance.ts -- --include-archived --exclude=LinearScan
```

---

## Auto-Discovery

**Convention over configuration**: Implementations are automatically discovered!

### Active Implementations

Automatically discovered from `src/implementations/` directory. All `.ts` files are included.

**To add a new implementation**:

1. Create `src/implementations/newimpl.ts`
2. Run `deno task bench` - automatically included!

### Archived Implementations

Automatically discovered from `archive/src/implementations/` when `--include-archived` flag is used.

**Convention**: All `.ts` files in `archive/src/implementations/*/` are discovered and labeled with their category.

**To compare against archived**:

```bash
deno task bench:archived
```

No manual configuration needed!

---

## Framework Design

### Principles

1. **Active by default**: Implementations in `src/implementations/` run automatically
2. **Archived opt-in**: Archived implementations only run when explicitly added + flag set
3. **Selective exclusion**: Can exclude specific implementations via `--exclude=`
4. **No modification needed**: Default `deno task bench` always works

### How It Works

**Discovery**:

- Active: Scans `src/implementations/` directory for all `.ts` files
- Archived: Scans `archive/src/implementations/` directory when `--include-archived` flag is used

**Filtering**:

- Remove any implementations matching `--exclude=<name>` flags
- Only include archived if `--include-archived` flag present

**Execution**:

- Run all scenarios for each implementation in the final list
- Report results

### Selective Filtering

**Include specific category**:

```bash
deno bench benchmarks/performance.ts -- --include-archived=failed-experiments
```

**Include specific implementation**:

```bash
deno bench benchmarks/performance.ts -- --include-archived=hybridrtree
```

**Combine with exclusions**:

```bash
# Compare only MortonLinearScan vs archived implementations
deno bench benchmarks/performance.ts -- --include-archived \
  --exclude=RTree --exclude=CompactRTree --exclude=ArrayBufferRTree \
  --exclude=LinearScan --exclude=CompactLinearScan \
  --exclude=OptimizedLinearScan --exclude=ArrayBufferLinearScan
```

---

## Use Cases

### Compare New Implementation Against Archived Baseline

```bash
# 1. Add archived baseline to benchmarks/performance.ts
# 2. Run comparison
deno task bench:archived
```

### Focus on Specific Implementations

```bash
# Example: Only test R-tree variants (exclude all linear scan implementations)
# Use --exclude for each implementation you want to skip
deno bench benchmarks/performance.ts -- --exclude=<ImplName> --exclude=<ImplName>
```

### Test New Implementation Against Everything

```bash
# Add new implementation to src/implementations/
# It's automatically discovered!
# Run full suite including archived
deno task bench:archived
```

---

## Examples

### Compare Against Failed Experiment

```bash
deno task bench:archived
```

Review if archived implementation is still slower.

### Test Only Linear Scan Variants

```bash
deno bench benchmarks/performance.ts -- --exclude=RTree --exclude=CompactRTree
```

### Compare New vs Superseded

```bash
deno task bench:archived
```

Verify current still faster than superseded version.

---

## Configuration Reference

### Command-Line Flags

| Flag                 | Effect                                 | Example                        |
| -------------------- | -------------------------------------- | ------------------------------ |
| `--include-archived` | Include archived implementations       | `deno task bench:archived`     |
| `--archived`         | Alias for `--include-archived`         | `deno bench ... -- --archived` |
| `--exclude=<name>`   | Exclude specific active implementation | `--exclude=CompactRTree`       |
| (multiple)           | Can use multiple `--exclude` flags     | `--exclude=A --exclude=B`      |

### Tasks

| Task             | Command                                                      | Purpose                          |
| ---------------- | ------------------------------------------------------------ | -------------------------------- |
| `bench`          | `deno bench benchmarks/performance.ts`                       | Run active implementations only  |
| `bench:archived` | `deno bench benchmarks/performance.ts -- --include-archived` | Include archived implementations |
| `bench:update`   | Run benchmarks + update BENCHMARKS.md                        | Regenerate documentation         |
| `bench:analyze`  | Run 5 iterations + statistical analysis                      | Detailed performance analysis    |

---

## Best Practices

### Use `--include-archived` For

- Comparing against archived baseline
- Verifying failed experiments still fail
- Demonstrating improvement over superseded

### Use `--exclude` For

- Focusing on specific algorithm family
- Debugging single implementation
- Faster iteration

---

## Maintenance

### Adding New Active Implementation

1. Create implementation in `src/implementations/`
2. Verify: `deno task bench` (automatically discovered!)

### Archiving Implementation

Use `deno task archive:impl <name> <category>` - automatically removes from active benchmarks.

To compare later: manually add to `archivedImplementations` array + use `--include-archived`

### Unarchiving Implementation

Use `deno task unarchive:impl <name> <category>` - automatically adds back to active benchmarks.

---

## Troubleshooting

**Implementation not found**: Check import path for correct category (`failed-experiments/` or `superseded/`)

**Not running**: Use `--include-archived` flag

**Type errors**: Expected for some failed experiments - kept for historical comparison

---

## Philosophy

**Active implementations** are the current state of the art - they represent what we believe works best right now. They're always tested because they're candidates for production use.

**Archived implementations** are historical artifacts - they represent what we tried, why it didn't work, and what we learned. They're opt-in because they're not production candidates, but they're valuable for research, comparison, and avoiding repeated mistakes.

This framework embodies the principle: **"Active by default, archived by choice."**
