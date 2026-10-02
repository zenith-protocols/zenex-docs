---
title: Funding rate
sidebar_position: 6
---

# Funding rate

Funding is a transfer between the two sides of a market. The side that the rate points at pays, and the other side earns. A positive rate means longs pay shorts, and a negative rate means shorts pay longs. This page covers how the rate moves, the minimum charge under it, what you pay, and what you earn.

The rate builds toward the crowded side, so a crowded book ends with the crowd paying. The payment rewards the trader who takes the less popular side, and it pulls the book back toward balance.

## How the rate moves

The rate builds up and winds down over time. The imbalance between the two sides sets how fast the rate builds, and time sets how far it gets. A wide imbalance therefore costs more after a day than it costs an hour after it appears. The market measures the imbalance in the asset that positions hold, as a share of the total size that both sides hold. A balanced book sits at 0%, and a book with one side only sits at 100%.

While the rate already points at the crowded side, two per-market levels decide what it does next:

- Above the upper level, the rate builds toward the crowded side. The wider the imbalance, the faster it builds.
- Below the lower level, the rate winds down toward zero at a flat speed. The imbalance does not change that speed.
- Between the two levels, the rate holds where it is.

Two cases skip those levels. A rate of zero and a rate that points at the thin side both build toward the crowded side, at any imbalance above 0%. While the two sides hold equal size, the rate holds in every case, because the book names no side to steer toward. The rate returns to zero once the market carries no open position.

The rate stops at a cap that the market sets. It goes no further in either direction, however wide the imbalance grows. The cap bounds what a payer is charged. It does not bound what a receiver earns, because a receiver earns the payers' charge spread across the value that the receiving side holds. A receiving side that holds less value than the paying side therefore earns at a rate above the cap.

The paying side is the side the rate points at, and that side can be the thin one. If the crowd flips from long to short, the rate still points the old way. The rate then moves toward the new crowded side, and a wide imbalance can carry it across in a single update. Until it crosses, the thin side keeps paying.

The build speed, the wind-down speed, the two levels, the minimum charge, and the cap are per-market parameters. For the values in force and who changes them, see [Market parameters](../markets/market-parameters.md). The protocol's [parameter-change process](../governance.md) governs each change. For the rate model in full, see the [technical reference](/technical/market/funding-rate).

## The minimum charge

Each market sets a minimum charge, the lowest rate a paying side is ever charged. Once the rate has left zero, the market charges at least that minimum. The amount you pay still grows with the size of your position and with the time you hold it.

A wind-down brings the rate to the smallest step above zero and never to zero. The minimum then sets what the payer is charged, even in a near-balanced market. A market can set its minimum to zero, and it then charges only the rate itself.

You pay at least the minimum for as long as you hold a position on the side that pays. The charge ends when you close the position, or when the rate crosses over and your side starts to earn instead.

## What you pay

The market accrues funding in windows, from one accrual to the next. It prices a whole window at the rate the window ends on, so a rate that is still building charges the full window at its higher value. Funding runs for as long as your side pays. The market takes it from the collateral behind your position, and it settles at the next fill on the position. A liquidation and an auto-deleveraging fill settle it as well. For every fill that settles it, see [Fees](./fees.md).

**What you owe counts against your equity before the market settles it.** Equity is what keeps a position alive, so unsettled funding moves your liquidation price toward your entry price every second the position stays open. See [Liquidation](./liquidation.md).

The charge falls on the size you entered with. The table below uses a position of 10,000 USDC in size on the paying side. The rate column is the rate charged, per year. The last column is a position of the same size on the receiving side.

| Paying side holds | Receiving side holds | Rate charged | You pay on the paying side | You earn on the receiving side |
| --- | --- | --- | --- | --- |
| 40,000 USDC | 40,000 USDC | minimum, about 1% | about 100 USDC a year | about 100 USDC a year |
| 40,000 USDC | 40,000 USDC | cap, about 20% | about 2,000 USDC a year | about 2,000 USDC a year |
| 40,000 USDC | 10,000 USDC | cap, about 20% | about 2,000 USDC a year | about 8,000 USDC a year |

The percentages are an example. [Deployments](../deployments.md) lists the minimum charge and the cap each live market runs with. At the cap, a payer of 10,000 USDC pays about 5.5 USDC a day. In the last row the receiving side holds a quarter of the paying side's value, so each unit on it earns four times what each unit on the paying side pays.

## What you earn

Funding you earn becomes claimable credit in your name. It grows each time your position settles, on the same events that settle what you pay. The credit sits apart from the position, so your collateral, your equity, and your liquidation price stay as they are.

A claim is a separate action, and nothing forces you to make one. The pool that pays a claim holds the funding that payers have settled so far, plus every payout the market parked. If it holds less than your credit, you receive what it has and the rest stays claimable. See [Claimable credit](./claimable-credit.md).

Everything a payer settles stays in the market for the receivers. While nobody holds the other side, that money waits with the market and no trader receives it. The part of the pool that no balance backs moves to the vault when the market retires. See [Market status](../markets/status.md).

## What this means for you

Funding is a cost while your side is the one the rate points at, and it is income while the other side is. A market charges at least its minimum for as long as your side pays. The rate reads the imbalance, so your side can change from paying to earning without any action from you.
