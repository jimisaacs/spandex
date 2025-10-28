# Releasing to JSR

## Publishing New Version

1. **Update versions** in `deno.json`:
   ```bash
   # packages/@jim/spandex/deno.json
   # packages/@jim/spandex-ascii/deno.json
   "version": "0.2.0"  # Bump version
   ```

2. **Test locally**:
   ```bash
   deno task test
   deno task bench:update
   deno task check

   # Dry run publish
   cd packages/@jim/spandex && deno publish --dry-run
   cd packages/@jim/spandex-ascii && deno publish --dry-run
   ```

3. **Commit with release message**:
   ```bash
   git add packages/@jim/*/deno.json
   git commit -m "chore: release v0.2.0"
   git push
   ```

4. **CI auto-publishes** when commit message starts with `chore: release v`

## Manual Publishing

If CI fails or you need manual control:

```bash
# Publish spandex
cd packages/@jim/spandex
deno publish

# Publish spandex-ascii
cd packages/@jim/spandex-ascii
deno publish
```

## Versioning

Follow semver:

- **0.x.y** → Pre-1.0, breaking changes allowed
- **x.0.0** → Major (breaking API changes)
- **x.y.0** → Minor (new features, backward compatible)
- **x.y.z** → Patch (bug fixes)

## Checklist Before Release

- [ ] All tests pass (`deno task test`)
- [ ] No linter errors (`deno task lint`)
- [ ] Formatted (`deno task fmt`)
- [ ] Benchmarks updated (`deno task bench:update`)
- [ ] CHANGELOG updated (if exists)
- [ ] Version bumped in both packages
