---
title: Markets
sidebar_position: 1
---

# Markets

A market is where you trade one asset pair, and it has a vault that holds the liquidity you trade against. This section explains what a market fixes, what it lets its owner change, and where each rule lives.

A market runs as two contracts. The market contract takes your orders and holds your position. Beside it sits a [vault](../vault/overview.md), which holds the tokens that liquidity providers deposit. Those tokens back every position the market carries, so the vault is the counterparty to your trade.

Four things are fixed for the life of a market. The settlement token is the one token you post as margin, in which every fee is charged, and in which your profit or loss comes back. The price stream is the one source of signed price reports that the market accepts. The vault is the one that backs the market. The oracle is the contract that checks each price report. Because these four stay put, the unit of your margin and the source of your price reports cannot change under an open position. The one exception is a delisted market, where the owner can fix a flat settlement price that replaces the price stream. [Market status](./status.md) covers it.

Anyone can deploy a market, and the deployer becomes its [owner](../governance.md). The owner sets the market's parameters and its state, and can replace its code. The protocol treasury is also fixed at deployment. It takes a share of the trade, impact, liquidation, and borrowing fees and of the fee on a vault order, and a separate owner of that treasury sets the share.

## In this section

| Page | What it covers |
| --- | --- |
| [Prices](./prices.md) | Where the price of a market comes from, how fresh a price report must be, and which side of the price fills your order. |
| [Market status](./status.md) | The states a market can be in, and what each state does to your position, your orders, and your shares. |
| [Market parameters](./market-parameters.md) | The fees, the margin lines, the leverage cap, the size limits, and the interest curves that each market sets for itself. |

[Governance](../governance.md) covers what an owner can change and when a change takes effect. It matters for every market you trade in, because the owner is part of what you trust.
