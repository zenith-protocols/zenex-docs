# zenex-docs

Public documentation for the Zenex perpetuals protocol on Stellar Soroban.
Built with Docusaurus and published at [docs.zenex.trade](https://docs.zenex.trade).

| Tree | Reader | Route |
| --- | --- | --- |
| `docs/` | Traders and liquidity providers | `/` |
| `integrations/` | App, tool, bot, keeper, and indexer authors | Unpublished |
| `technical/` | Contract developers and reviewers | `/technical` |

[WRITING.md](./WRITING.md) defines page jobs, length targets, warning placement,
source verification, and publication checks. [CLAUDE.md](./CLAUDE.md) gives
agent instructions and deployment-generation rules.

## Develop

Use Node.js 22 or later:

```bash
npm ci
npm start
```

## Validate and build

```bash
npm run typecheck
npm run build
git diff --check
```

The build rejects broken internal links and anchors in the two published trees.
Output goes to `build/`. Integrations source and its sidebar are retained for
future review, but excluded from the site, navigation, and local search.

Before re-enabling Integrations, validate its links and compile its examples
against the documented SDK revision.
Inspect a production build on desktop and mobile before publishing.

## Serve a preview

Set `DOCS_SITE_URL` when the preview needs its own canonical origin:

```bash
DOCS_SITE_URL=https://your-preview.example npm run build
npm run serve -- --host 127.0.0.1 --port 3005 --no-open
```

Point your existing tunnel or reverse proxy at that port. The default build
origin remains `https://docs.zenex.trade`.

Existing Integrations URLs redirect to the Technical architecture overview.
Existing reader-page URLs remain in place.

## Refresh deployments

`docs/deployments.md` is generated. Change the generator or reviewed record,
then refresh it rather than editing the page by hand:

```bash
STELLAR_RPC_URL=<mainnet rpc endpoint> npm run deployments
```

The script reads the reviewed deployment record, the app's public config, and
the chain. It checks core code against the recorded commit in
`../zenex-contracts`. Set `ZENEX_CONTRACTS_DIR` to use another clone.

A mismatch stops generation. Current addresses, owners, parameters, and code
hashes belong on Deployments. Other pages link there.

## Local documentation proposals

`local-drafts/` is ignored by Git and excluded from the site. It holds proposed
documentation for sibling repositories and editorial comparison notes.
