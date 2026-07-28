# GitHub Actions Workflows

This repository uses GitHub Actions for continuous integration and automated quality gates.

## Workflows

### `ci.yml` - Main CI Workflow

**What it does**:

1. **Test job** (runs on every push/PR):
   - Runs in parallel on **Deno 2.x** (stable) and **Deno canary** (nightly)
   - Checks formatting (`deno fmt --check`)
   - Runs linter (`deno lint`)
   - Type-checks entire project (`deno check`)
   - Runs all tests (`deno task test`)

2. **Quick Benchmarks job** (runs **in parallel** with Statistical Analysis):
   - Runs `bench:update` to generate `BENCHMARKS.md` (~16 min)
   - Auto-commits updated file
   - Typically finishes first due to shorter duration

3. **Statistical Analysis job** (runs **in parallel** with Quick Benchmarks):
   - Runs `bench:analyze` to generate `docs/analyses/benchmark-statistics.md` (~80 min)
   - Auto-commits updated file
   - Uses rebase strategy to handle potential race condition with Quick Benchmarks

**When workflows run**:

- **Push to any branch** → Test job runs
- **Pull request** → Test job runs
- **Push to `main`** → All 3 jobs run in parallel (Test + Quick Benchmarks + Statistical Analysis)
- **Every Sunday at 00:00 UTC** → Both benchmark jobs run in parallel
- **Manual trigger** → All jobs run (can trigger anytime via workflow_dispatch)

**How to enable**:

1. Push this code to GitHub
2. Go to your repository → Settings → Actions → General
3. Ensure "Allow all actions and reusable workflows" is enabled
4. Workflows will run automatically on next push

**Viewing results**:

1. Go to your repository on GitHub
2. Click "Actions" tab
3. See workflow runs, logs, and status

**Manually triggering workflows**:

1. Go to repository → Actions tab
2. Click "CI" workflow in left sidebar
3. Click "Run workflow" button (top right)
4. Select branch (usually `main`)
5. Click green "Run workflow" button
6. All jobs (Test + both Benchmark jobs) will run

**Auto-commits from benchmarks**:

**Both jobs run in parallel** and push independently:

**Quick Benchmarks** (~16 min):

- Runs `bench:update`
- Commits `BENCHMARKS.md`
- Pushes back to `main` with `[skip ci]`

**Statistical Analysis** (~80 min):

- Runs `bench:analyze`
- Commits `docs/analyses/benchmark-statistics.md`
- Pulls latest changes (in case Quick Benchmarks finished first)
- Pushes back to `main` with `[skip ci]`

**How race conditions are handled**:

1. Both jobs start at same time from same commit
2. Whichever job finishes first pushes its commit
3. The other job pulls latest changes, rebases its commit on top, then pushes
4. Since they modify different files (no conflicts), rebase always succeeds
5. Result: Both files updated, 2 clean commits, no failures ✅

**Why this works**: Different files (`BENCHMARKS.md` vs `docs/analyses/benchmark-statistics.md`) = no merge conflicts

**How `[skip ci]` prevents infinite loops**:

1. You push to `main` → Workflow runs
2. Benchmark jobs commit with `[skip ci]` message → Push to `main`
3. GitHub sees `[skip ci]` → Skips running workflow on those commits
4. No infinite loop ✅

You'll see these automated commits in your git history with the robot emoji (📊).

## Customization

### Change benchmark schedule

Edit the cron schedule in `.github/workflows/ci.yml`:

```yaml
schedule:
    # Weekly on Sundays at midnight UTC (current):
    - cron: '0 0 * * 0'

    # Daily at 2 AM UTC:
    - cron: '0 2 * * *'

    # First day of month at midnight:
    - cron: '0 0 1 * *'

    # Disable schedule (only run on push/manual):
    # Comment out the entire schedule section
```

### Run benchmarks only on push (not scheduled)

If you don't want the weekly automatic runs:

```yaml
benchmark-quick:
    if: |
        (github.event_name == 'push' && github.ref == 'refs/heads/main') ||
        github.event_name == 'workflow_dispatch'
        # Removed: github.event_name == 'schedule'
```

Do the same for `benchmark-stats` job.

### Disable auto-commit

If you prefer manual benchmark updates:

```yaml
# Comment out or remove this step:
- name: Commit benchmark results
  uses: stefanzweifel/git-auto-commit-action@v5
  ...
```

### `performance-regression.yml` - Performance Regression Tests

**What it does**:

Automatically detects performance regressions on pull requests:

1. **Run benchmarks on PR code**
2. **Run benchmarks on main branch**
3. **Compare results** using `scripts/compare-benchmarks.ts`
4. **Post comparison table** as PR comment (updates existing comment, no spam)
5. **Fail if regression detected** (>20% slower)

**When it runs**:

- **Every pull request** → Compares PR vs main
- **Manual trigger** → Can trigger anytime via workflow_dispatch

**Security features**:

- ✅ Minimal permissions (`contents: read`, `pull-requests: write`)
- ✅ Pinned action versions (commit SHAs)
- ✅ Benchmark runs with `--allow-read --allow-hrtime` only (no network, no write)
- ✅ Comparison script has full input validation

**Example output** (posted as PR comment):

```markdown
## Performance Comparison

| Benchmark   | Main (µs) | PR (µs) | Change | Status        |
| ----------- | --------- | ------- | ------ | ------------- |
| sparse-grid | 13.00     | 12.00   | -7.7%  | ✅            |
| large-grid  | 7100.00   | 8800.00 | +23.9% | 🔴 REGRESSION |
| new-feature | -         | 2500.00 | NEW    | 🆕            |
```

**Thresholds**:

- **Regression**: >20% slower (fails CI)
- **Improvement**: >20% faster (celebrates but passes)
- **Neutral**: Within ±20% (passes)

**Local testing**:

```bash
# Run benchmarks and save output
deno bench benchmarks/performance.ts > pr-benchmarks.txt
# ... checkout main or make changes ...
deno bench benchmarks/performance.ts > main-benchmarks.txt

# Compare
deno run --allow-read --allow-write=comparison.md \
  scripts/compare-benchmarks.ts pr-benchmarks.txt main-benchmarks.txt comparison.md

# Check exit code (1 = regression, 0 = success, 2 = error)
echo $?

# Or test without args (validates parsing)
deno run --allow-read --allow-run scripts/compare-benchmarks.ts
```

---

### `docs.yml` - Documentation Deployment

**What it does**:

Builds and deploys the static documentation site to GitHub Pages.

**When it runs**:

- **Push to main** → Rebuilds and deploys site
- **CI workflow completes** → Triggers rebuild
- **Manual trigger** → Can deploy anytime

**Built site**: [https://jimisaacs.github.io/spandex/](https://jimisaacs.github.io/spandex/)

---

## Troubleshooting

### Workflow fails with "permission denied"

The benchmark job needs write permissions. Ensure:

```yaml
permissions:
    contents: write
```

### Benchmark timeout

If benchmarks take longer than 60 minutes, increase timeout:

```yaml
timeout-minutes: 90 # Increase as needed
```

### Test (deno canary) fails but Test (deno 2.x) passes

This is expected - canary is Deno's nightly/development version. The workflow will:

- ✅ Pass if **Test (deno 2.x)** passes (what matters for production)
- ⚠️ Warn if **Test (deno canary)** fails (early warning of breaking changes)

## Local Testing

Test workflows locally before pushing:

```bash
# Run what CI runs:
deno fmt --check
deno lint
deno check
deno task test

# Simulate benchmark job:
deno task bench:update
deno task bench:analyze 5 docs/analyses/benchmark-statistics.md
```
