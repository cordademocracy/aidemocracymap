# AI4Democracy Map

An illustrated island map of 139 organizations working on AI and democracy: research institutes, policy groups,
funders, deliberation platforms, election-integrity teams, and voting tools.
Click an island for the organization's card, or search and filter across all of them.

Live at https://ai4democracy.world.

Maintained by [CORDA](https://cordademocracy.org).

## Run it

```bash
bun install
bun run dev              # http://localhost:5199, map only, no /api
```

The two public forms and `/admin` need the Worker. Set `FORM_TOKEN_SECRET=any-local-string` and
`DEV_ALLOW_INSECURE_ADMIN=1` in `worker/.dev.vars` first (the second skips the mailed one-time
admin link, which workerd can't send).

```bash
npm install --prefix worker
bun run build            # wrangler serves dist/, so build before worker-dev
make worker-dev          # http://localhost:8787
```

Organization records ship from `src/data/organizations.json`, generated outside this repo from a
maintainer's dataset. Edits there get overwritten on the next sync.

## Next

[CONTRIBUTING.md](CONTRIBUTING.md) for pull requests.
[SECURITY.md](SECURITY.md) for reporting vulnerabilities.
[LICENSE](LICENSE): AGPL-3.0-or-later. Does not cover organization logos, which belong to their respective owners.
