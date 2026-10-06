---
title: Deposits and withdrawals
description: Follow vault orders and understand their fees, rejection, and withdrawal gates.
---

# Deposits and withdrawals

A deposit exchanges settlement tokens for vault shares. A withdrawal redeems shares for settlement tokens. On a trading market, both use an order. You create it first. A keeper fills it later at the vault value then.

## The minimum received {#the-minimum-received}

A deposit minimum is a number of shares. A redeem minimum is an amount of settlement tokens. Both apply after the vault fee. The app derives this minimum from your slippage tolerance. Review the minimum separately from the estimate before signing either order.

:::warning Below minimum means rejection
If the fill returns less than your minimum, the order ends. Your deposit tokens or redeem shares are refunded. The keeper keeps the execution fee. The order does not wait for a better price.
:::

## Deposit

Use **Vault**, then **Deposit**. Review the amount, estimated shares, minimum received, and fees before signing. Creation escrows the deposit tokens and a separate execution fee. At the fill, the vault fee reduces the deposited amount and the vault mints shares.

A deposit must meet the market's minimum. Its fill must leave the vault within its balance cap. A capacity failure leaves the order waiting. The fill uses a verified report observed at or after order creation and lands in a later ledger.

## Withdraw

Use **Vault**, then **Withdraw**. Enter the shares to redeem and review the estimated token payout, minimum received, and fees. Creation escrows the shares and an execution fee. The order serves a cooldown measured from creation.

The fill reads the current cooldown setting. A change can affect an order already waiting. At the fill, the vault burns shares and pays the token amount after the vault fee. See [Share value](./share-value.md) for how it values that exchange.

:::warning The cooldown is not a guaranteed withdrawal date
A redeem also needs enough available assets, enough liquidity behind positions, and acceptable pending trader profit. It can remain unfilled after the cooldown for as long as those checks fail.
:::

## Follow the fill

Rejection below the minimum differs from a liquidity or capacity failure, which normally leaves the order resting.

| Fill outcome | What happens |
| --- | --- |
| Successful | Shares or token payout arrive, after vault fees. |
| Below minimum received | Principal returns, execution fee is paid, and the order is removed. |
| Cooldown, liquidity, or capacity check fails | The order stays resting with escrow held. |

A payout the market cannot send can become [Claimable credit](../trading/claimable-credit.md).

## Cancel a waiting order

Cancel a waiting order to return the full escrow, including its execution fee. Cancellation is a separate transaction with its own fee. Use [Market status](../markets/status.md) to understand availability.

:::info A freeze blocks cancellation
While the market is frozen, deposits, redeems, fills, and cancellations are blocked. Escrow remains held until the freeze lifts.
:::

## Redeem from a retired market

On a retired market, a new redeem settles within your transaction. It needs no keeper, cooldown, execution fee, or vault fee.

Older deposit and redeem orders on a retired market never fill. Cancel them to return escrow, then use the retired redeem path for shares. Current fees, minimums, and cooldowns are on [Deployments](../deployments.md).

:::warning The retired path ignores minimum received
Its payout uses the vault value at execution. The order's minimum does not bound that payout.
:::
