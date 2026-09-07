---
sidebar_position: 1
title: Keepers
---

# Keepers

The **keeper** is the execution role in Zenex. Traders and liquidity providers only create and cancel price-free orders. A keeper is what turns those resting orders into settled positions and shares: it submits a verified oracle price to the market contract, the contract checks the order against that price, and the fill settles. Keepers are what make the exchange run.

Anyone can be a keeper. The role is fully **permissionless**: calling a fill entry point takes no registration, allowlisting, or prior assignment, since the market contract checks the stored order against a verified signed price rather than checking who the caller is. A trader consented to being filled when their collateral and execution fee were escrowed at order creation, and a liquidity provider consented when they escrowed assets or shares in their vault order. The keeper simply names itself as the reward recipient in each call. [Why Permissionless](./why-permissionless.md) covers why the protocol keeps execution open rather than gating it.

### Why Keepers Matter

Without keepers, orders would never fill, take-profit and stop-loss triggers would never fire, underwater positions would accumulate bad debt, and vault deposits and redeems would never settle. Keepers keep the protocol solvent and give traders and LPs timely execution.

### Prices

Every fill carries a signed **price report** supplied by the keeper. The market contract passes it to the oracle contract, which checks the publisher signatures, the market's immutable stream id, the report's expiry, and the age of the observation before the price is used, so a keeper cannot fill at a price the protocol has not validated. Execution uses the verified bid and ask: an increase enters at the ask (long) or bid (short), and a decrease exits at the bid (long) or ask (short).

### The Keeper Roles

A keeper can take on five distinct roles, each mapping to an entry point on the market contract. Each fill entry point takes a `keeper` argument that is only the reward recipient, and a keeper is free to run any subset of the roles.

- **Filling trade orders** (`execute_order`): fill a trader's resting order (market, limit, or stop entries, and market, take-profit, or stop-loss exits) once its trigger and slippage bound are satisfied at the verified price. Pays the keeper share of the fill's trade fee plus the order's escrowed execution fee.
- **Filling vault orders** (`execute_vault_order`): fill a liquidity provider's deposit or redeem, minting or burning shares net of the vault fill fee. Pays the keeper share of the vault fill fee plus the order's escrowed execution fee.
- **Liquidating** (`execute_liquidation`): force-close a position whose equity has fallen below the maintenance margin, or any remaining position on a wound-down market past its deadline. There is no order and no execution fee here, so it pays only the fee cut, which on a liquidation covers the close's trade fee plus the liquidation fee.
- **Auto-deleveraging** (`update_adl_state`, then `execute_adl`): recompute the per-side ADL flags, then deleverage a winning position on a flagged side back toward the clear target. The flag poke carries no keeper and pays nothing. The deleveraging close pays the keeper share of its trade fee.
- **Advancing the accrual indices** (`accrue`): a maintenance poke that carries a price and brings the market's borrowing and funding indices up to the current moment between fills. It takes no keeper argument and pays no reward, so this is a small role run for the health of the market rather than for income.

### The Liquidator Is the Base

Every role above runs on the same foundation: a live picture of the market's positions and orders, marked against the current oracle price. That is exactly the state a liquidation bot maintains, which makes the liquidator the natural base of a keeper. The per-position equity it computes is what signals a liquidation. Those same marks aggregate into each side's pending PnL, which tells an ADL keeper when a side is close to being flagged and how much to close, and tells a vault-order keeper what share price a deposit or redeem will fill at, and with it whether the fill clears the order's minimum-received bound and the redeem gates. And the per-position health tells an order-filling keeper whether a fill will clear the margin checks before it spends a transaction finding out. A keeper can also simply run the base alone, liquidating and nothing else, and layer the other roles on top of the same state later.

### Rewards

Keepers earn the `keeper_rate` cut (a per-market parameter, see [parameter changes](../governance/parameter-changes.md)) of the fees on the fills they execute, split per role as listed above. Every order, trade or vault, also escrows a flat **execution fee** at creation, and the keeper who fills the order collects it on top of the fee cut. The execution fee is refunded to the order's owner if the order is cancelled.

The reward is paid to whatever address the keeper named. Because the role is permissionless and competitive, faster and more reliable keepers capture more of these rewards. See [Running a Keeper](./running-a-keeper.md) for the operational details.
