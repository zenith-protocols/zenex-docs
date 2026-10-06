---
title: Borrowing interest
description: Understand the time-based cost of liquidity reserved for positions.
---

# Borrowing interest

Borrowing interest pays for the vault liquidity that positions reserve. Its rate rises as a side uses more of its available capacity. Funding transfers between traders. Borrowing interest goes to the vault and treasury.

## Which side pays

The market compares the amount of the base asset held by longs and shorts. The larger side pays borrowing interest. The smaller side pays none. If both sides hold equal amounts, both pay at their own utilization rate. The comparison uses asset amounts. A price move alone does not switch the paying side.

## What sets the rate

Each side has a liquidity capacity. Utilization measures how much of that capacity its positions reserve. The borrowing curve gets steeper beyond its configured bend and reaches its maximum at full utilization. Utilization above capacity uses the maximum rate. Long-side reserves depend on current asset value, so price moves can change its rate. Short-side reserves use entry size.

## What you owe

Interest accrues against the size entered, over elapsed time. It settles when the position changes, including a liquidation or auto-deleveraging action. For illustration, 10,000 USDC of size at a constant 20% annual rate costs about 5.48 USDC per day. Real rates vary. When your side becomes the smaller side, new interest stops accruing. It still owes what accrued earlier. Read [Liquidation](./liquidation.md) for the effect on equity. Use [Deployments](../deployments.md) for the configured borrowing curve.

:::warning Time can consume the margin buffer
Interest owed lowers equity before settlement. The asset price can remain unchanged while the position moves closer to liquidation. Lower leverage gives the same position size more collateral to absorb that cost.
:::
