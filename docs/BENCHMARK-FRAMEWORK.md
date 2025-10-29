# Benchmark Framework

Auto-discovers implementations from `packages/@jim/spandex/src/index/`.

## Basic Usage

```bash
deno task bench  # Run all active implementations
```

## Advanced Usage

### Include Archived Implementations

```bash
deno task bench:archived
# or
deno bench benchmarks/performance.ts -- --include-archived
```

### Exclude Implementations

```bash
deno bench benchmarks/performance.ts -- --exclude=CompactRTree
deno bench benchmarks/performance.ts -- --exclude=A --exclude=B
deno bench benchmarks/performance.ts -- --include-archived --exclude=LinearScan
```

## Auto-Discovery

**Active**: Auto-discovered from `packages/@jim/spandex/src/index/` (all `.ts` files).

**Archived**: Removed from repository. Use `--include-archived` if implementations exist in `archive/src/implementations/`.

## Principles

1. Active by default (auto-discover from `packages/@jim/spandex/src/index/`)
2. Selective exclusion via `--exclude=`
3. No configuration needed

## Tasks

| Task            | Command                                                                             | Purpose                  |
| --------------- | ----------------------------------------------------------------------------------- | ------------------------ |
| `bench`         | `deno bench benchmarks/performance.ts`                                              | Run active               |
| `bench:update`  | `deno run -A scripts/update-benchmarks.ts`                                          | Regenerate BENCHMARKS.md |
| `bench:analyze` | `deno run -A scripts/analyze-benchmarks.ts 5 docs/analyses/benchmark-statistics.md` | Stats (~30 min)          |

## See Also

- [Implementation Lifecycle](./IMPLEMENTATION-LIFECYCLE.md)
