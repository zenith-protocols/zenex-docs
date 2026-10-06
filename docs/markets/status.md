---
title: Market status
description: Check action availability and understand freezes and market wind-downs.
---

# Market status

Every market has a state that controls which actions it accepts. The owner changes that state. Every permitted action still needs to pass its own checks.

## What you can do

| State | Add position size | Reduce size or add margin | Cancel or claim | Deposit or redeem |
| --- | --- | --- | --- | --- |
| Active | Allowed, unless the side is flagged for ADL. | Allowed. | Allowed. | Allowed. |
| On ice | Size-growing fills stop. | Allowed. | Allowed. | Allowed. |
| Frozen | Blocked. | Blocked. | Blocked. | Blocked. |
| Delisted | Size-growing fills stop. | Allowed. | Allowed. | Allowed. |
| Retired | Blocked. | Positions are closed. | Allowed. | Redeem only. |

On-ice and delisted markets can still accept an increase order. It rests with escrow held while its size-growing fill is blocked. Liquidation and auto-deleveraging run in active, on-ice, and delisted markets, subject to their normal checks.

## A freeze holds funds in place

The freeze ends when the owner changes the state. It does not promise a reopening time. The owner can change settings during a freeze. The next accrual update uses the settings then in force for the elapsed period.

:::danger A freeze also blocks exits
You cannot close, add margin, cancel orders, redeem shares, or claim credit while the market is frozen. Price exposure and elapsed borrowing and funding time continue. Liquidation can follow when the freeze lifts.
:::

## Delisting starts a wind-down

Two fixed windows run from delisting.

| Time since delisting | What changes |
| --- | --- |
| First day | Stream-based execution continues. The owner can undo the delisting. |
| After one day | The owner can set a positive settlement price. The market cannot return to active or on ice. |
| After seven days | Any keeper can close every remaining position, including healthy positions. |

Your own close remains available while the market permits execution. Forced closes pay the usual liquidation fee. A freeze does not pause these windows. It can prevent you from closing before the settlement price or forced-close stage begins.

:::warning The owner can choose the settlement price
Once set, that price replaces the stream for execution. The owner can replace it while the market remains delisted. A close can settle at a value far from the chart.
:::

## Retirement

Retirement requires all positions to be closed and all position margin to be cleared. It is permanent. You can still claim credit, cancel resting orders, and redeem shares. Old vault orders never fill. A new retired-market redeem settles in your transaction without a keeper or cooldown. It has no vault or execution fee, and ignores minimum received. Use [Deposits and withdrawals](../vault/depositing.md) for that path. Use [Governance](../governance.md) for the owner's wider powers.
