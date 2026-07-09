---
sidebar_position: 5
title: Funding Rate
---

# Funding Rate

The funding rate is a transfer between longs and shorts based on the market's imbalance. It is comparable to the funding rate on traditional perpetual exchanges, and it exists to push the market toward balance: the crowded side pays, the underrepresented side earns. A positive rate means longs pay shorts, a negative rate means shorts pay longs.

## Velocity Funding

Zenex uses a velocity funding model. Rather than setting the rate directly from the current imbalance, the protocol adjusts the rate over time based on how one-sided the book is. The saved rate has momentum: while one side dominates, the rate keeps accelerating toward that side, and when the book is close to balanced the rate decays back toward zero.

The imbalance that drives this is measured in tokens: it is the difference between the long and short base-token totals, divided by their sum. A perfectly balanced book has a skew of zero, and a market where one side holds all the open tokens has a skew of one.

For example, a market with 3,000 XLM of long exposure and 1,000 XLM of short exposure has 4,000 tokens open in total and an imbalance of 2,000 between the two sides, so its skew is 2,000 divided by 4,000, or 50%.

- When the skew is large (or the rate is fresh or has just flipped sign), the rate accelerates toward the dominant side. The wider the skew, the faster it accelerates.
- When the skew is small, the rate decays flatly back toward zero.
- Between those bands the rate holds steady.

Both the acceleration and decay speeds, and the skew thresholds that separate the bands, are set per market by governance. The saved rate is hard-capped in both directions, and an empty market resets it to zero. There is also a governance-set floor on what is actually charged: while the rate is nonzero, the paying side pays at least that minimum, even as the saved rate itself decays below it.

Because the rate carries momentum, a persistently one-sided market builds a strong funding rate that makes the crowded side increasingly expensive to hold and the other side increasingly attractive. This is what nudges traders back toward balance and reduces the vault's directional risk.

## Funding Accrues to a Claimable Balance

Funding runs through an internal funding pool rather than flowing directly onto your position's PnL.

When a position settles at a fill, the funding it owes is banked into the pool, and the funding it has earned is added to that user's claimable balance. To collect it you submit a separate claim, which pays out your claimable balance from the pool rather than topping up your collateral automatically. If the pool cannot cover the full amount at that moment, it pays what it can and the remainder stays claimable for later.

This separation keeps funding fully accounted for: the paying side's contributions accumulate in the pool, and the receiving side draws from it on demand. When there is no opposing side to receive it, paid funding simply accrues as surplus in the pool rather than being redistributed.
