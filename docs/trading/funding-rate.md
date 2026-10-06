---
title: Funding rate
description: Understand which side pays funding and where earned funding goes.
---

# Funding rate

Funding transfers value between longs and shorts. A positive rate means longs pay shorts. A negative rate means shorts pay longs. Read the signed rate to identify the paying side. Current imbalance alone does not determine it.

## Why the rate changes

The rate moves toward the crowded side. Its speed depends on the imbalance and the market's settings. Once it points at the crowd, it can build, hold, or wind down as imbalance changes. A configured minimum can keep a nonzero rate chargeable even near balance. The market caps the paying rate. Earned funding per unit can be higher when fewer positions share the receiving side.

:::info A thinner side can still pay
After the crowd changes sides, the rate can keep its previous direction until it crosses zero. Check the rate's sign before assuming your side earns.
:::

## What you pay

Funding depends on position size and elapsed time. The market updates accrual when an action reaches it, then settles your share when your position changes. Funding owed already counts against equity before settlement. It can move the liquidation price closer even while the asset price stays still. For the complete cost picture, use [Fees](./fees.md) and [Liquidation](./liquidation.md).

## What you earn

Earned funding becomes claimable credit when the position settles. It stays separate from margin. Use [Claimable credit](./claimable-credit.md) to collect it. Borrowing is a separate charge described in [Borrowing interest](./borrowing-interest.md). For current funding settings, use [Deployments](../deployments.md).

:::warning Earned funding does not protect your position
Claimable credit does not increase the position's equity or move its liquidation price away. A claim can also pay only part of the balance while its pool awaits payer settlements.
:::
