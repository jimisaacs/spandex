# Contributing to Spandex

Thank you for your interest in contributing to Spandex!

## Quick Links

**New to the project?**

- [GETTING-STARTED](./docs/GETTING-STARTED.md) - Learn how to use the library
- [README](./README.md) - Project overview

**Ready to contribute?**

- [CLAUDE.md](./CLAUDE.md) - Comprehensive development guide
- [IMPLEMENTATION-LIFECYCLE](./docs/IMPLEMENTATION-LIFECYCLE.md) - Adding/archiving implementations
- [BENCHMARK-FRAMEWORK](./docs/BENCHMARK-FRAMEWORK.md) - Performance testing

## Development Workflow

### 1. Setting Up

```bash
git clone https://github.com/jimisaacs/spandex.git
cd spandex
deno task test  # Verify everything works
```

### 2. Making Changes

**Before you start:**

- Read [CLAUDE.md](./CLAUDE.md) for project conventions
- Check [IMPLEMENTATION-LIFECYCLE](./docs/IMPLEMENTATION-LIFECYCLE.md) if adding/modifying algorithms

**While developing:**

```bash
deno task test           # Run tests
deno task test:watch     # Watch mode
deno task fmt            # Format code
deno task lint           # Lint code
deno task check          # Type check
deno task bench:update   # Update benchmarks (~2 min)
```

### 3. Pre-Commit Checklist

Before committing, ensure:

- [ ] All tests pass: `deno task test`
- [ ] Code formatted: `deno task fmt`
- [ ] No linter errors: `deno task lint`
- [ ] Type-checked: `deno task check`
- [ ] Benchmarks updated if implementation changed: `deno task bench:update`
- [ ] Documentation updated if behavior changed
- [ ] No `any` types in source code
- [ ] All public APIs have JSDoc comments

### 4. Commit Message Convention

```text
<type>: <description>

Examples:
feat: add bulk insert optimization
fix: correct boundary handling in query
docs: update GETTING-STARTED with examples
test: add adversarial pattern coverage
perf: optimize Morton code calculation
refactor: simplify rectangle decomposition
chore: update dependencies
```

## Adding a New Implementation

See [IMPLEMENTATION-LIFECYCLE](./docs/IMPLEMENTATION-LIFECYCLE.md) for detailed steps.

**Summary:**

1. Create implementation in `packages/@jim/spandex/src/index/`
2. Create test directory with property/geometry/visual tests
3. Generate fixtures: `UPDATE_FIXTURES=1 deno test -A`
4. Run benchmarks: `deno task bench:update`
5. Document findings in `docs/analyses/`

## Running Tests

```bash
# All tests
deno task test

# Specific implementation
deno task test:morton
deno task test:rstartree

# Adversarial patterns
deno task test:adversarial

# Update fixtures (after intentional test changes)
UPDATE_FIXTURES=1 deno test -A
```

## Running Benchmarks

### During Development (Quick Checks)

```bash
deno task bench         # Run benchmarks (~2 min)
deno task bench:update  # Update BENCHMARKS.md (~2 min)
```

### Before Completing Tasks (Full Update)

**⚠️ IMPORTANT**: Both benchmark documentation files must be current before completing work:

```bash
deno task bench:update   # Updates BENCHMARKS.md (~2 min)
deno task bench:analyze 5 docs/analyses/benchmark-statistics.md  # Updates stats (~30 min) ⚠️
```

**Warning**: `bench:analyze` is **VERY SLOW** (20-30 minutes for 5 runs). Only run before completing/committing major changes. Use `deno task bench` (~2 min) for quick validation during development.

For detailed benchmarking workflows and when to use which command, see [BENCHMARK-FRAMEWORK](./docs/BENCHMARK-FRAMEWORK.md).

## Code Style

**Formatting:** Enforced by `deno fmt`

- Tabs (width 4)
- Line width 120
- Semicolons
- Single quotes

**Type Safety:**

- No `any` types
- Use `implements SpatialIndex<T>`
- JSDoc on all public APIs

**Imports:**

```typescript
// ✅ Good
import createMortonLinearScanIndex from '@jim/spandex/index/mortonlinearscan';

// ❌ Bad
import { createMortonLinearScanIndex } from '@jim/spandex';
```

## Documentation

**When to update:**

- API changes → Update package README
- Performance changes → Run `deno task bench:update`
- New algorithms → Create analysis document in `docs/analyses/`
- Workflow changes → Update CLAUDE.md or IMPLEMENTATION-LIFECYCLE

**Documentation style:**

- See [CLAUDE.md](./CLAUDE.md) "Documentation Writing Style" section
- Use present tense for active research
- Include runnable code examples
- Cite academic references

## Research Workflow

For the complete experiment lifecycle (hypothesis → implementation → analysis → cleanup), see [docs/active/README.md](./docs/active/README.md).

## Questions?

- **Usage questions:** [TROUBLESHOOTING](./docs/TROUBLESHOOTING.md)
- **Implementation questions:** [CLAUDE.md](./CLAUDE.md)
- **Research questions:** [docs/core/RESEARCH-SUMMARY.md](./docs/core/RESEARCH-SUMMARY.md)
- **Other questions:** Open an issue on GitHub

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
