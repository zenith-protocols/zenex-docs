---
title: Prices
description: Understand the quote used for a fill and why it can differ from the chart.
---

# Prices

A market uses signed price reports from its configured stream. A keeper submits a report with an execution call. The oracle checks it before the market acts.

## Display price and execution price

The chart or ticker is a display price. It is not a guaranteed fill quote. A report carries a bid and ask. The oracle can narrow their spread before the market uses them.

| Action | Effective quote side |
| --- | --- |
| Open or increase a long | Ask. |
| Reduce or close a long | Bid. |
| Open or increase a short | Bid. |
| Reduce or close a short | Ask. |

Triggers and price bounds use the quote side for the action. An open position is marked at the side it would exit on.

:::info Check the execution terms
The chart, spread, and report timing can produce different displayed and executable prices. Your order's price bound limits the fill price. See [Orders](../trading/orders.md).
:::

## What the oracle checks

The report needs valid publisher signatures, the correct stream, usable positive prices, and acceptable timestamps. The oracle rejects expired reports, crossed quotes, and observations outside its time rules. A rejected report cannot price that execution. These checks confirm the report's validity. They do not make its publishers infallible.

## Freshness and order timing

Trade and vault fills use a strict freshness window. Liquidation and auto-deleveraging accept a wider one. Ordinary fills need a report observed at or after order creation. Same-ledger market orders have a narrow exception for a recent earlier report. Vault fills use a later ledger and have no same-ledger exception. A position also rejects a report older than its last recorded mark.

The market keeps a latest verified price. Liquidation, auto-deleveraging, accrual updates, and vault fills use the newer eligible price. Trade fills use the submitted report. Use [Deployments](../deployments.md) for current oracle settings.

:::warning A stream gap can affect actions differently
A report can be too old for your order while still fresh enough for liquidation. Once it exceeds the wider window, that close also stops.
:::

## Price during a wind-down

A delisted market can use an owner-set settlement price. That value replaces the stream and gives the same bid and ask. The owner can replace it while the market remains delisted. Read [Market status](./status.md) before relying on the chart during a wind-down.
