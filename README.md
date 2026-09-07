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
