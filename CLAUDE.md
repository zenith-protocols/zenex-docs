# zenex-docs

Public Docusaurus site for the Zenex perpetuals protocol. Two published doc
trees, each with its own Docusaurus plugin instance, sidebar, and reader.
The Integrations source and sidebar remain in the repo but are unpublished.
Read [WRITING.md](./WRITING.md) before you write or review a page, and run its
checks over the diff before you hand it back. It carries the repo's current
reader model and the relevant rules from `~/notes/docs-site-standard.md`.

| Tree | Reader | Route |
| --- | --- | --- |
| `docs/` | Traders and LPs. Behaviour in words. No symbol, no path, no formula. | `/` |
| `technical/` | Auditors and integrators. Signatures, storage, errors, events, formulas. Audit-grade. | `/technical` |
| `integrations/` | App, tool, bot, keeper, and indexer authors. Practical SDK and service workflows. | Unpublished |

## Source of truth

The latest fetched `origin/main` in each relevant repository. Core facts come
from `../zenex-contracts`: `market`, `oracle`, `factory`, `governance`,
`strategy-vault`, and `treasury`. Router, fee forwarder, and session-policy
facts come from `../zenex-util-contracts`. SDK examples come from
`../zenex-sdk-js`. App and API workflows also need `../zenex-trade`,
`../zenex-backend`, `../relayer-plugin-zenex`, and `../zenex-indexer`.

Check traits, errors, storage keys, constants, exports, and handlers before
writing. A sibling working branch or README can differ from main.

Pages name symbols, never paths. A symbol you cannot grep does not go on a
page.

## Commands

- `npm run build`: fails on a broken internal link or anchor. Run it before
  you hand back a diff.
- `npm run typecheck`: validates config, sidebars, and components.
- `npm start`: local dev server.

## Live values

`docs/deployments.md` is generated. Never edit it by hand:
`STELLAR_RPC_URL=<mainnet rpc> npm run deployments` rewrites it. The script in
`scripts/deployments/` takes each value from one source:

- `record.mainnet.json`, reviewed: the factory, the wallet factory, and the code
  each contract must run. Nothing on chain points to these.
- The app's public config (`configUrl` in the record): the markets, the router,
  the fee forwarder, and the smart-wallet contracts.
- The chain: every parameter, owner, status, and code hash.
- `../zenex-contracts` at the recorded commit: the protocol limits and the
  release builds the code hashes must match.

Every cross-check failure stops the run. Re-run it after a deploy, a config
change, or an oracle or treasury change, and update the record when a contract
is added or replaced. No other page states a live value. Link to Deployments.
