# zenex-docs

Public documentation for the Zenex perpetuals protocol on Stellar Soroban,
served at https://docs.zenex.trade. Built with Docusaurus.

Three doc trees, each with its own sidebar and reader:

| Tree | Reader | Route |
| --- | --- | --- |
| `docs/` | Traders and liquidity providers | `/` |
| `technical/` | Auditors and integrators | `/technical` |
| `integrations/` | SDK, keeper, and indexer authors | `/integrations` |

Every claim in `technical/` and `integrations/` is checked against the
contract source in `zenex-contracts`. Writing rules are in `CLAUDE.md`.

## Develop

```bash
npm install
npm start
```

## Build

```bash
npm run build
```

The build fails on a broken internal link or anchor. Output goes to `build/`
and is a static site any host can serve.

## Deployments page

`docs/deployments.md` lists every live mainnet contract and the values it runs
with. A script writes it from the chain, so refresh it rather than editing it:

```bash
STELLAR_RPC_URL=<mainnet rpc endpoint> npm run deployments
```

The script reads the reviewed record in `scripts/deployments/record.mainnet.json`,
the app's public config, and `../zenex-contracts` at the deployed commit (set
`ZENEX_CONTRACTS_DIR` to point elsewhere). It refuses to write the page if the
contracts, the config, and the record disagree.
