---
title: Auto-deleveraging
description: Understand forced reductions when a side's pending profit grows too large.
---

# Auto-deleveraging

Auto-deleveraging (ADL) reduces positions when one side's pending profit grows too large for the vault. It protects the liquidity behind the market.

:::warning A profitable position can be reduced without your approval
A keeper chooses an eligible position and amount. The market can close part or all of it without another signature from you. There is no guaranteed order among eligible positions.
:::

## What a flag means

A side is flagged when a price-based measurement finds its pending profit above the upper ADL level. The flag remains until a later measurement finds profit at or below the lower level. A price move alone does not refresh that flag. While flagged, the side cannot fill orders that add size. Margin-only increases and ordinary decreases can still fill.

The ADL trigger is at or below the profit cap. A side can therefore be flagged before the cap reduces payouts.

## What a reduction does

A partial reduction realizes the result on the closed size. The remaining size keeps its entry price. It does not automatically withdraw collateral. A full reduction settles the position and cancels resting decreases on that side. A request that leaves less than the minimum position size becomes a full close. The closed size pays trade and impact fees. The entire position settles its accrued borrowing and funding.

ADL has no liquidation fee or order execution fee. Earned funding goes to [Claimable credit](./claimable-credit.md).

:::info The profit cap still applies
An ADL close pays profit through the same cap as a close you choose. Marked profit can exceed the amount received. See [Profit and payouts](./pnl.md).
:::

## Limits on the keeper

The reduction must lower the side's pending profit and keep it at or above the lower ADL level. The decrease lock limits how much size can close. A remaining position must pass maintenance margin and size limits. A forced remainder can sit below initial margin. The next voluntary change must meet that requirement again. A position already below maintenance margin needs liquidation instead.

The side's profit measure uses the quote that favors traders. A position showing a small loss at its own exit price can still be eligible.

## What you control

You control how much exposure you hold and whether you reduce it before an ADL flag. You do not control the keeper's selection or timing. For current ADL levels, use [Deployments](../deployments.md). For the separate equity-based close, use [Liquidation](./liquidation.md).
