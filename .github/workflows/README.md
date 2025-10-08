# GitHub Actions Workflows

## How to Use

This repository uses GitHub Actions for continuous integration. The workflows automatically run when you push code to GitHub.

### `ci.yml` - Main CI Workflow

**What it does**:

1. **Test job** (runs on every push/PR):
   - Tests on Deno 2.x stable and canary
   - Checks formatting (`deno fmt --check`)
   - Runs linter (`deno lint`)
   - Type-checks entire project (`deno check`)
   - Runs all tests (`deno task test`)

2. **Quick Benchmarks job** (runs in parallel with tests):
   - Runs `bench:update` to generate `BENCHMARKS.md` (~2 min)
   - Auto-commits updated file

3. **Statistical Analysis job** (runs in parallel with tests):
   - Runs `bench:analyze` to generate `docs/analyses/benchmark-statistics.md` (~30 min)
   - Auto-commits updated file
   - Runs in parallel with Quick Benchmarks to save time

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

**Quick Benchmarks** (~2 min):

- Runs `bench:update`
- Commits `BENCHMARKS.md`
- Pushes back to `main` with `[skip ci]`

**Statistical Analysis** (~30 min):

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

### Tests fail on canary but pass on stable

This is expected - canary is Deno's unstable version. The workflow will:

- ✅ Pass if stable passes (what matters)
- ⚠️ Warn if canary fails (FYI only)

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
