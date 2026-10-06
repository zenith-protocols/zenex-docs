---
title: Market parameters
description: Find the settings that affect a trade or vault action.
---

# Market parameters

A market's settings determine its costs, limits, and waiting periods. Use [Deployments](../deployments.md) for the current values and owners. This page identifies which settings matter to your action. Each linked page explains the behavior.

| Setting group | What it changes | Read |
| --- | --- | --- |
| Initial and maintenance margin | Required collateral and liquidation threshold. | [Margin and leverage](../trading/margin-and-leverage.md). |
| Position, order, and side limits | Accepted amounts and available exposure. | [Positions](../trading/positions.md). |
| Trade, impact, execution, and liquidation fees | Costs at creation and settlement. | [Fees](../trading/fees.md). |
| Funding parameters | Rate movement and payments between sides. | [Funding rate](../trading/funding-rate.md). |
| Borrowing curve and utilization limits | Ongoing interest and liquidity capacity. | [Borrowing interest](../trading/borrowing-interest.md). |
| Profit cap and ADL levels | Reduced profit and forced reductions. | [Profit and payouts](../trading/pnl.md), [Auto-deleveraging](../trading/adl.md). |
| Vault fees, minimums, cap, and cooldown | Deposit acceptance and withdrawal behavior. | [Deposits and withdrawals](../vault/depositing.md). |
| Price windows and spread reduction | Accepted reports and effective execution quotes. | [Prices](./prices.md). |
| Decrease lock | How soon added size can close. | [Positions](../trading/positions.md#the-decrease-lock). |

## Settings can reach existing positions

The market owner controls market settings. The oracle owner controls price rules. The treasury owner controls the protocol fee share. For the change process and any delay, read [Governance](../governance.md).

:::warning Opening a position does not lock its settings
Changes to fee rates, margin requirements, curves, and limits can affect positions and orders you already hold. An order keeps its recorded execution fee. Added size keeps its recorded decrease lock.
:::
