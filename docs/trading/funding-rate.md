---
title: Funding rate
sidebar_position: 6
---

# Funding rate

Funding is a transfer between the two sides of a market. The side that the rate points at pays, and the other side earns. A positive rate means longs pay shorts, and a negative rate means shorts pay longs. The rate builds toward the crowded side, so a crowded book ends with the crowd paying. The payment rewards the trader who takes the less popular side, and it pulls the book back toward balance.

**Funding is a transfer between traders.** The market holds what a payer settles, and it reaches a receiver as a claimable balance when that receiver's own position next settles.

## How the rate moves

The rate builds up and winds down over time. The imbalance between the two sides sets how fast the rate builds, and time sets how far it gets. A wide imbalance therefore costs more after a day than it costs one hour after the imbalance appears. The market measures the imbalance in the asset that positions hold, as a share of the total size that both sides hold. A balanced book sits at 0%, and a book with one side only sits at 100%.

While the rate already points at the crowded side, two per-market levels decide what it does next:

- Above the upper level, the rate builds toward the crowded side. The wider the imbalance, the faster it builds.
- Below the lower level, the rate winds down toward zero at a flat speed. The imbalance does not change that speed.
- Between the two levels, the rate holds where it is.

Two cases skip those levels. A rate of zero and a rate that points at the thin side both build toward the crowded side, at any imbalance above 0%. While the two sides hold equal size, the rate holds in every case, because the book names no side to steer toward. The rate returns to zero once the market carries no open position.

The rate stops at a cap that the market sets. It goes no further in either direction, however wide the imbalance grows. The cap bounds what a payer is charged, and it does not bound what a receiver earns. A receiver earns the payers' charge spread across the value that the receiving side holds. A thin receiving side therefore earns at a rate above the cap.

The paying side is the side the rate points at, and that side can be the thin one. If the crowd flips from long to short, the rate still points the old way. The rate then moves toward the new crowded side, and a wide imbalance can carry it across in a single update. Until it crosses, the thin side keeps paying.

The build speed, the wind-down speed, the two levels, the minimum charge, and the cap are per-market parameters. The protocol's [parameter-change process](../governance.md) sets them. For the rate model in full, see the [technical reference](/technical/market/funding-rate).

## The minimum charge

Every market sets a floor under the rate it charges. Whenever a market charges funding, it charges at that floor or above. The amount you pay still grows with the size of your position and with the time you hold it. The wind-down stops one step short of zero, so a rate that decays almost to nothing still charges the floor. You pay it for as long as you hold a position on the side that pays, even in a near-balanced market. The charge ends when you close the position, or when the rate crosses over and your side starts to earn instead.

The charge runs on the paying side alone. While nobody holds the other side, what you pay stays with the market and no trader receives it. The protocol takes no funding for itself, and the market holds that money against what it owes traders. For where that money goes at the end of a market's life, see [Market status](../markets/status.md).

## What you pay

Funding accrues every second while your side pays. The market charges it against the collateral behind your position. It settles at the next change to the position. An increase, a decrease, a close, a liquidation, and an auto-deleveraging fill all settle it.

**What you owe counts against your equity before the market settles it.** Equity is what keeps a position alive, so unsettled funding moves your liquidation price toward you every second the position stays open. See [Liquidation](./liquidation.md).

## What you earn

Funding you earn becomes a claimable balance in your name, and it grows each time your position settles, on the same events that settle what you pay. The balance sits apart from the position, so your collateral, your equity, and your liquidation price stay as they are. A claim is a separate action that you choose when to make. See [Claimable credit](./claimable-credit.md).
