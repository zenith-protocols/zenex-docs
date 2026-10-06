---
title: Margin and leverage
description: Understand collateral requirements, available capacity, and the liquidation buffer.
---

# Margin and leverage

Margin is the collateral behind a position. Leverage compares its size with that margin. For example, 100 units of size backed by 10 units of margin is 10x leverage. More margin gives the same exposure more room for losses and costs.

## Two margin lines

| Line | Reads | Controls |
| --- | --- | --- |
| Initial margin | Posted margin after settlement. | The minimum collateral for a position you open or change. |
| Maintenance margin | Equity, including price changes and closing costs. | Whether the position can be liquidated. |

Initial margin is the higher requirement. Unrealized profit cannot replace it. A full close leaves no remaining position, so it does not need initial margin. It still needs enough equity to pass the maintenance check.

:::warning A weak position can refuse your close
Below maintenance margin, an ordinary close or margin withdrawal is refused. A keeper can liquidate the position. Adding margin can restore it, but the top-up must pass both lines after accrued costs settle.
:::

## Leverage after fees

The app accounts for estimated trading fees in your order. The final fee depends on conditions when it fills. Higher fees leave less margin and higher leverage than previewed. Lower fees leave more margin and lower leverage. [Fees](./fees.md) explains how the market chooses the rate. Price losses, borrowing interest, and funding you owe reduce equity over time. Funding you earn sits separately and does not defend the position.

A displayed liquidation price is an estimate. Check the position's current costs and [Liquidation](./liquidation.md).

## Capacity can refuse an increase

Each market bounds individual position size and total exposure on each side. It also checks how much vault liquidity the increased side reserves. A fill can be refused even when you have enough margin. The vault may lack capacity for the requested size. An increase that adds only margin skips the size-growing capacity checks. It still must restore a valid position. Use [Deployments](../deployments.md) for current margin and capacity settings. Use [Positions](./positions.md) for the decrease lock and minimum remainder.
