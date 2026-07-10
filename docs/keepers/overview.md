---
sidebar_position: 1
title: Keepers
---

# Keepers

The **keeper** is the execution role in Zenex. Traders and liquidity providers only create and cancel price-free orders. A keeper is what turns those resting orders into settled positions and shares: it submits a verified oracle price to the trading contract, the contract checks the order against that price, and the fill settles. Keepers are what make the exchange run.

Anyone can be a keeper. The role is fully **permissionless**: calling a fill entry point takes no registration, allowlisting, or prior assignment, since the trading contract checks the stored order against a verified signed price rather than checking who the caller is. A trader consented to being filled when their collateral and execution fee were escrowed at order creation, and a liquidity provider consented when they escrowed assets or shares in their vault order. The keeper simply names itself as the reward recipient in each call.

### Why Keepers Matter

Without keepers, orders would never fill, take-profit and stop-loss triggers would never fire, underwater positions would accumulate bad debt, and vault deposits and redeems would never settle. Keepers keep the protocol solvent and give traders and LPs timely execution.

### Prices

Every fill carries a serialized **Pyth Lazer** price update supplied by the keeper. The trading contract verifies it against the market's immutable feed anchors through the price-verifier contract before using it, so a keeper cannot fill at a price the protocol has not validated. Execution uses the verified bid and ask: an increase enters at the ask (long) or bid (short), and a decrease exits at the bid (long) or ask (short).

### Entry Points

Keepers call the trading contract directly. Each fill entry point takes a `keeper` argument that is only the reward recipient. `update_adl_state` and the maintenance pokes carry no keeper and pay no reward.

- **`execute_order`**: fill a trader's resting order (market, limit, or stop entries, and market, take-profit, or stop-loss exits) once its trigger and slippage bound are satisfied at the verified price.
- **`execute_liquidation`**: force-close a position whose equity has fallen below the maintenance margin, or any remaining position on a wound-down market past its deadline.
- **`update_adl_state`** then **`execute_adl`**: recompute the per-side auto-deleveraging flags, then deleverage a winning position on a flagged side back toward the clear target.
- **`execute_vault_order`**: fill a liquidity provider's deposit or redeem, minting or burning shares net of the vault fill fee.
- **`accrue`** and **`accrue_funding`**: maintenance pokes. `accrue` carries a price and advances both the borrowing and funding indices, `accrue_funding` is price-free and advances only funding.

### Rewards

Keepers earn the `keeper_rate` cut (a per-market parameter, see [parameter changes](../governance/parameter-changes.md)) of the fees on the fills they execute. Every order, trade or vault, also escrows a flat **execution fee** at creation, and the keeper who fills the order collects it on top of the fee cut. The execution fee is refunded to the order's owner if the order is cancelled.

- On a trade order fill, the keeper takes its share of that fill's **trade fee** (the base fee plus the price impact fee) plus the order's escrowed execution fee.
- On a vault order fill, the keeper takes its share of the **vault fill fee** on the moved assets plus the order's escrowed execution fee.
- On a liquidation or ADL close there is no order and no escrowed execution fee, so the keeper takes only its share of the trade fee.

The reward is paid to whatever address the keeper named. Because the role is permissionless and competitive, faster and more reliable keepers capture more of these rewards. See [Running a Keeper](./running-a-keeper.md) for the operational details.
