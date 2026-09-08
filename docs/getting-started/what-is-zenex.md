---
slug: /
title: What is Zenex
sidebar_position: 1
---

# What is Zenex

Zenex is a perpetual futures exchange on Stellar Soroban. You take a leveraged long or short position on the price of an asset. The position has no expiry date. Your margin keeps it open. If your equity falls under the maintenance line, a keeper closes the position for you. Auto-deleveraging and the wind-down of the market can also close it. One token does all the work in a market, and that token is the settlement token. You post it as margin. You pay the fees in it. Your profit or loss settles in it.

Contracts on the network hold your collateral and settle every trade. A market prices your trade against a signed price report from its price feed. A vault of depositor liquidity stands on the other side of your position. The vault absorbs your loss, and it pays your profit. It can pay less than your marked profit when the profit owed to your side of the book grows large against the vault's liquidity. Read [Profit and loss](../trading/pnl.md) for that limit.

## The three roles

| Role | What it does | Start here |
| --- | --- | --- |
| Trader | Posts collateral as margin, and holds a leveraged long or short position. | [Start trading](./start-trading.md) |
| Liquidity provider | Signs a deposit order at one market, and holds the vault shares that the fill mints. | [Provide liquidity](./providing-liquidity.md) |
| Keeper | Fills any order, including one it created itself, and runs liquidations. Each fill and each liquidation pays a reward. | [Keepers](../keepers.md) |

Every role is open to any account, and one account can take all three at the same time.

## One market, one vault, one price feed

A market is one leveraged pair, for example Stellar lumens (XLM) against the settlement token. A market gets its own vault and its own price feed at deployment, and it keeps both for its whole life. The vault serves that market alone, and it holds the liquidity that backs every position in the market.

Losses therefore stay inside the market that produced them. A run of trader profit in one market draws on the liquidity of that market's vault. It cannot reach the liquidity of another market, and it cannot reach a depositor who deposited into another market.

## Where to go next

| If you want to | Read |
| --- | --- |
| Know what a position costs, and what can close it | [Trading](../trading/overview.md) |
| Know how the vault earns and what it can lose | [Vault](../vault/overview.md) |
| See how a market is configured, priced, and retired | [Markets](../markets/overview.md) |
| Run a keeper, or learn who fills your order | [Keepers](../keepers.md) |
| See who can change a market parameter, and how long it takes | [Governance](../governance.md) |
| Earn points on the traders you bring in | [Referrals](../referrals.md) |
| Weigh what can take your money before you act | [Risks](../risks.md) |
| Get a short answer to a common question | [FAQ](../faq.md) |
| Look up a term | [Glossary](./glossary.md) |
| Read the completed audits of the contracts | [Audits](../audits.md) |
| Find a deployed address or a live parameter | [Deployments](../deployments/contract-addresses.md) |
| Check a claim against the contracts | [Architecture overview](/technical) |
| Call the contracts from your own code | [Integrations](/integrations/overview) |
