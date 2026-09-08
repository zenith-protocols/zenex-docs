---
title: Markets
sidebar_position: 1
---

# Markets

A market is a pair of contracts for one asset pair, a market contract and a vault, deployed together in one call. The market contract takes your orders and holds your position. The vault beside it holds the tokens that liquidity providers deposit, and that liquidity is what traders in the market trade against. A market settles in one token. It prices against one price stream. You post your margin in the settlement token. Every fee the market charges is in that token. Your profit or your loss comes back in it. The settlement token, the price stream, the vault, and the oracle that checks each price report are fixed when the market is deployed. When an owner winds a market down, the owner sets one final price, and the market fills at that price instead of at the price stream. Anyone can deploy a market, and the deployer becomes its owner. The owner sets the market's parameters and its state. Two charges sit outside that owner. A treasury owner sets the protocol's share of each fee. An oracle owner sets the freshness and spread rules that every price report must meet. Refer to [Vault](../vault/overview.md) for what a deposit into a vault earns and what it risks. Refer to [Governance](../governance.md) for what an owner can change and when a change can take effect.

## In this section

| Page | What it covers |
| --- | --- |
| [Prices](./prices.md) | Where the price of a market comes from, how fresh a price report must be, and which side of the price fills your order. |
| [Market status](./status.md) | The states a market can be in, and what each state does to your position, your orders, and your shares. |
| [Market parameters](./market-parameters.md) | The fees, the margin lines, the leverage cap, the size limits, and the interest curves that each market sets for itself. |
