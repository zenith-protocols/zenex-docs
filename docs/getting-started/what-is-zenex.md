---
slug: /
title: What is Zenex
description: Trade perpetual futures and provide liquidity on Stellar.
---

# What is Zenex

Zenex is a perpetual futures exchange on Stellar. You trade the price of an asset through a long or short position. You post collateral, choose your exposure, and settle gains or losses in the market's settlement token.

Each market has its own vault of liquidity. The vault takes the other side of its traders' positions. Liquidity providers hold shares in that vault.

<div className="doc-paths">
  <a className="doc-path" href="/getting-started/start-trading"><strong>Start trading</strong><span>Open a position and follow your first order.</span></a>
  <a className="doc-path" href="/getting-started/providing-liquidity"><strong>Provide liquidity</strong><span>Understand vault shares, deposits, and withdrawals.</span></a>
  <a className="doc-path" href="/account/signing"><strong>Understand your signature</strong><span>Review fees, relayers, and one-click permissions.</span></a>
  <a className="doc-path" href="/technical"><strong>Read the contracts</strong><span>Explore architecture, authorization, and settlement.</span></a>
</div>

## How a trade works

You sign an order with your terms. Each fill uses a signed price report. The contracts check the price, your terms, and the market's limits before they change your position.

The app can combine creation and a fill into one transaction. A confirmed transaction can also leave an order waiting for a later fill.

:::warning Understand the risk before you fund
Leverage can consume all the margin behind a position. A winning position can also face reduced profit or a forced reduction.

Vault shares can lose value, and withdrawals can wait. Read [Risks](../risks.md) before you trade or provide liquidity.
:::

## Choose the depth you need

**Documentation** explains actions, costs, and risks for traders and liquidity providers. **Technical** describes the architecture and contracts in detail.

For addresses and current settings, use [Deployments](../deployments.md). For a term, use [Glossary](./glossary.md).
