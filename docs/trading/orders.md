---
title: Orders
description: Choose an order type, review execution terms, and recover escrow.
---

# Orders

An order requests a change to your position. Creation escrows its funds. The market fills it when the price, your terms, and its limits allow.

## Choose a fill rule

Every order increases or decreases a position. Each family has a market, limit, and stop form.

| Kind | Long trigger | Short trigger |
| --- | --- | --- |
| Market increase | Any eligible price. | Any eligible price. |
| Limit increase | Price at or below the trigger. | Price at or above the trigger. |
| Stop increase | Price at or above the trigger. | Price at or below the trigger. |
| Market decrease | Any eligible price. | Any eligible price. |
| Limit decrease, including take profit | Price at or above the trigger. | Price at or below the trigger. |
| Stop decrease, including stop loss | Price at or below the trigger. | Price at or above the trigger. |

Take profit and stop loss are separate decrease orders. Each escrows an execution fee. You can have up to eight resting decrease orders per side. A decrease can be created before a position exists. It fills only when there is a position it can change.

## Review the terms

**Size and margin** define what changes. An order can move only margin, only size, or both. Positive amounts must meet the market's minimums.

**Trigger** determines when a limit or stop order becomes eligible. It does not fix the eventual price.

**Price bound** sets the worst price you accept. A buy needs a price at or below its bound. A sell needs a price at or above it. The app applies your slippage limit to market orders. Its limit and stop orders, including take profit and stop loss, have no separate price bound.

**Expiry** is the last ledger where the order may fill, including that ledger. It is separate from your signature's expiry.

The market checks the trigger and bound against the effective bid or ask used for that action. See [Prices](../markets/prices.md).

:::warning A trigger does not guarantee a fill
A keeper must submit a successful fill. Until then, a stop loss leaves your position open and exposed to liquidation. The fill price can be worse than the stop price. Without a price bound, a stop accepts any verified price that reaches its trigger and passes the other checks.
:::

## What an order escrows {#what-an-order-escrows}

| Order family | Escrow at creation |
| --- | --- |
| Increase | Added margin plus the execution fee. |
| Decrease | The execution fee. |

The order records its execution fee when it is created. Later changes to that fee do not alter an existing order. The transaction that creates the order also has its own submission fee. [Fees](./fees.md) distinguishes those charges.

## Why an order keeps waiting

A fill can be refused by its trigger, bound, expiry, price freshness, margin, size, liquidity capacity, or decrease lock. Market status can block it too. On-ice and delisted markets stop size-growing fills. An auto-deleveraging flag stops them on the flagged side. A refused trade fill normally leaves the order resting with its escrow. Check [Market status](../markets/status.md) and [Margin and leverage](./margin-and-leverage.md).

## Cancel and reclaim escrow {#cancels}

An expired order stops filling. Cancel a resting order to return its full remaining escrow, including its execution fee. Cancellation costs its own transaction fee. A full close automatically cancels resting decreases on that side. It leaves resting increases in place.

:::warning Expiry does not refund escrow
Its funds stay held until you cancel. A frozen market blocks cancellation until the freeze lifts.
:::

## Creation and a fill in one transaction

The app can create an order and attempt a fill in one transaction. A strict fill failure reverts creation. A recoverable fill failure can instead leave the order resting. In relay mode, **Instant fill** attempts execution immediately. **Strict fill** makes an unsuccessful attempt revert creation. Browser-direct market orders wait for keeper execution. Same-ledger market orders can use a recent verified report observed before creation. Other fills follow the order's price-time rules.

Check both Orders and Positions after confirmation. See [Pending and failed transactions](../account/transactions.md).
