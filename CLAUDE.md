# zenex-docs

Public Docusaurus site for the Zenex perpetuals protocol. Three doc trees, each
its own Docusaurus plugin instance with its own sidebar file and its own reader.
Read `~/notes/docs-site-standard.md` before you write or review a page, and run
its checklist over the diff before you hand it back.

| Tree | Reader | Route |
| --- | --- | --- |
| `docs/` | Traders and LPs. Behaviour in words. No symbol, no path, no formula. | `/` |
| `technical/` | Auditors and integrators. Signatures, storage, errors, events, formulas. Audit-grade. | `/technical` |
| `integrations/` | SDK, keeper, and indexer authors. How to call it and decode it. The only tree that gives advice. | `/integrations` |

## Source of truth

`../zenex-contracts` on `main`. Every claim in `technical/` and `integrations/`
is checked there before it is written. One crate per contract: `market`,
`market-router`, `oracle`, `factory`, `governance`, `strategy-vault`,
`treasury`. Each crate's `src/` holds the trait, the error enum, the storage
keys and TTLs, the constants, and the cross-contract dependency traits. Grep
the crate, never assume. SDK examples come from `../zenex-sdk-js`.

Pages name symbols, never paths. A symbol you cannot grep does not go on a
page.

## Commands

- `npm run build`: fails on a broken internal link or anchor. Run it before
  you hand back a diff.
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
