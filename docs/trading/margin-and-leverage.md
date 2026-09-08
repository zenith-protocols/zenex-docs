---
title: Margin and leverage
sidebar_position: 4
---

# Margin and leverage

Margin is the collateral that backs one position. Leverage is the size of that position measured against its margin. A position with 10 USDC of margin behind 100 USDC of size runs at 10x. The vault backs the exposure your margin does not cover, so every position must clear two margin lines.

## The two lines

| Line | What it reads | What it does |
| --- | --- | --- |
| Initial margin | The collateral you posted, without unrealized profit or loss | Sets the floor for every change you make, and the leverage ceiling |
| Maintenance margin | Your equity, which counts profit and loss | Marks liquidation, and blocks a close or a withdrawal |

The initial margin is the higher of the two.

## The initial margin

The initial margin is the floor the position must meet after a change you make. It applies when you open, when you increase, when you close a part of the position, and when you withdraw collateral. A full close leaves no position behind, so only the maintenance line gates it. You make each of those changes through an order, and the [Orders](./orders.md) page gives the kinds. The check measures the collateral you posted. A realized loss and any collateral a decrease paid out both reduce that figure. **An unrealized gain cannot stand in for posted collateral.**

When you open or increase, the fees due at the fill come out of your posted collateral before the check runs. Collateral posted at exactly the requirement on a new position therefore falls short, and the open is refused. When you close a part of the position, the fees come out of your realized profit first, and only the uncovered part reduces your margin.

One forced path is the exception. **A position that auto-deleveraging has reduced may sit under the initial margin.** The [Auto-deleveraging](./adl.md) page gives that path.

## Maximum leverage

The initial margin sets the leverage ceiling, which is one divided by the initial margin. A market with a 5% initial margin holds at least 50 USDC of margin behind a 1,000 USDC position, so the ceiling is 20x. A market with a 1% initial margin holds 10 USDC behind the same position, and the ceiling is 100x. Each market sets its own initial margin through the [parameter-change process](../governance.md), so the ceiling differs by market. No market may set an initial margin under 0.1% or over 50%, so every market allows at least 2x. Each market must also leave room between its two margin lines, and that rule lifts the real floor above 0.1%. No market reaches 1000x.

## The maintenance margin

The maintenance margin is the lower line, and it marks liquidation. It reads your equity, which is what the position would return if it closed now. Your equity is your collateral, plus or minus your unrealized profit or loss, less the costs the close settles. A position whose equity falls under the maintenance margin's share of its size can be liquidated. The [Liquidation](./liquidation.md) page gives what that close costs you.

The line also blocks you. While your equity sits under it, you cannot close the position and you cannot withdraw collateral. You can still add collateral, and the position trades again once the added margin lifts it clear of both lines.

## The buffer between the two lines

The gap between the two lines absorbs adverse price moves and the costs that build up. Each market keeps that gap wide enough to cover the fees of one small close. The gap is also the reason you cannot draw your collateral down to the maintenance margin. Every withdrawal must leave the position at or above the initial margin.

Your effective leverage drifts after you open. Borrowing interest and the funding you owe build against a size that has not changed, and both lower your equity. An unrealized loss lowers your equity too. Funding you earn becomes a credit you can claim separately, and it does not raise your margin or your equity. Your posted margin does not change while those costs build, and a fill settles them against it. Added collateral restores the buffer at once.

## Position size limits

Every market bounds the size of one position, with a minimum and a maximum. Both bounds are checked on the position a change leaves behind, so an order that would push you past the maximum is refused. The [Positions](./positions.md) page gives what happens to a close that would leave less than the minimum.

A market also caps the total size of all positions on one side. An increase is refused once that side's total would pass the cap, even while your own position sits inside its own bounds. The [Market parameters](../markets/market-parameters.md) page gives the bounds of the deployed markets.

## When the vault is heavily used

An increase can also be refused because the vault's liquidity is already committed. A side of a market may reserve at most a set share of half the vault balance. The market sets that share. The check runs on the positions the fill would leave behind, so a fill that pushes either side past its limit is refused. The check runs only on a fill that adds size. A fill that adds collateral alone skips it.

The refusal is not permanent. The check reads the vault balance and the open positions at the moment of the fill. Capacity returns when positions close or when depositors add liquidity.

For the exact checks and the order they run in, see the [technical reference](/technical/market/margin-and-leverage).
