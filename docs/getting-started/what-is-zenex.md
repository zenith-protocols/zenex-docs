---
slug: /
title: What is Zenex
sidebar_position: 1
---

# What is Zenex

Zenex is a perpetual futures exchange on Stellar Soroban. This page covers how a trade works at a glance, the three roles around it, and where each topic lives in these docs.

You take a leveraged long or short position on the price of an asset. The position stays open until you close it or a forced close ends it. Your margin keeps it open. If your equity falls under the maintenance margin, a keeper closes the position. A keeper is an account that submits a signed price to the market. Auto-deleveraging can also close a position, and so can the wind-down of a delisted market. One token does all the work in a market, and that token is the settlement token. You post your margin in it, you pay every market fee in it, and your profit or loss settles in it.

Contracts on Stellar hold your margin and settle every trade. The market prices your trade against a signed price report from its price stream. A vault of deposited liquidity stands on the other side of your position. The vault keeps your loss and pays your profit. The vault limits the profit it recognizes on each side. When the profit owed to your side grows large against the vault's liquidity, you receive less than your marked profit. Read [Profit and loss](../trading/pnl.md) for that limit.

## Three roles share every market

| Role | What it does | Start here |
| --- | --- | --- |
| Trader | Posts margin, signs orders, and holds a leveraged long or short position. | [Start trading](./start-trading.md) |
| Liquidity provider | Signs a deposit order for a market's vault, and holds the vault shares that the fill mints. | [Provide liquidity](./providing-liquidity.md) |
| Keeper | Submits a signed price report to fill any order, including one it created itself, to liquidate a position, or to deleverage a side. Each of these calls pays a reward. | [Keepers](../keepers.md) |

Every role is open to any account, and one account can take all three at the same time.

## Each market has its own vault and price stream

A market is one leveraged pair, for example Stellar lumens (XLM) priced in US dollars. At deployment a market gets its own vault and its own price stream, and it keeps both for its whole life. The vault serves that market alone, and it holds the liquidity that backs every position there.

Losses therefore stay inside the market that produced them. A run of trader profit in one market draws only on the liquidity of that market's vault. It cannot reach the liquidity of another market. A liquidity provider's exposure to trader profit is limited to the vault whose shares they hold.

## Where to go next

| If you want to | Read |
| --- | --- |
| Know what a position costs, and what can close it | [Trading](../trading/overview.md) |
| Know how the vault earns and what it can lose | [Vault](../vault/overview.md) |
| See how a market is configured, priced, and retired | [Markets](../markets/overview.md) |
| Run a keeper, or learn who fills your order | [Keepers](../keepers.md) |
| See who can change a market parameter, and how long it takes | [Governance](../governance.md) |
| Earn a bonus on the points the traders you bring in earn | [Referrals](../referrals.md) |
| Weigh what can take your money before you act | [Risks](../risks.md) |
| Get a short answer to a common question | [FAQ](../faq.md) |
| Look up a term | [Glossary](./glossary.md) |
| See the audit status of the contracts | [Audits](../audits.md) |
| Find a deployed address or a live parameter | [Deployments](../deployments.md) |
| Check a claim against the contracts | [Architecture overview](/technical) |
| Call the contracts from your own code | [Integrations](/integrations/overview) |
