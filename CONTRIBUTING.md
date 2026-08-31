# Contributing

Organization data is not edited through pull requests. Use the forms on the map, described in
[README.md](README.md).

For code, see [README.md](README.md) for local setup. Before opening a pull request:

```bash
bun run build
npm test --prefix worker
node scripts/check-layout.mjs   # only if you moved map positions
```

CI runs the same checks, plus a dependency audit. Keep commits small and scoped to one change.
