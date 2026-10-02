---
title: Margin and leverage
sidebar_position: 4
---

# Margin and leverage

This page covers the two margin lines every position must clear and the leverage ceiling they set. It also covers the limits on position size and vault use that can refuse an increase. The examples use USD Coin (USDC) as the settlement token.

Margin is the collateral that backs one position. Leverage is the size of that position measured against its margin. A position with 10 USDC of margin behind 100 USDC of size runs at 10x. The vault backs the exposure your margin does not cover, so the market holds every position to two margin lines.

## Two margin lines limit every position

| Line | What it reads | What it does |
| --- | --- | --- |
| Initial margin | The margin you posted, without unrealized profit or loss | Sets the floor for every change you make, and the leverage ceiling |
| Maintenance margin | Your equity, which counts profit and loss | Marks liquidation, and blocks a close or a withdrawal |

The initial margin is the higher of the two. The two lines read different figures on purpose. The initial margin asks what you put behind the position. The maintenance margin asks what the position is worth if it closes now.

## The initial margin gates the changes you choose

The initial margin is the floor the position must meet after a change you make. It applies when you open, when you increase, when you close a part of the position, and when you withdraw collateral. You make each of those changes through an order, and the [Orders](./orders.md) page gives the kinds. A full close leaves no position behind, so only the maintenance margin gates it.

The check reads the margin behind the position. A realized loss lowers that margin, and so does any collateral a decrease paid out. **An unrealized gain cannot stand in for posted margin.** A gain can vanish with the next price move. Posted margin stays behind the position.

When you open or increase, the fees due at the fill come out of your posted collateral before the check runs. Collateral posted at exactly the requirement on a new position therefore falls short, and the open is refused. When you close a part of the position, the fees come out of your realized profit first. Only the part the profit does not cover lowers your margin.

Auto-deleveraging is the one forced path that skips this floor. **A position that auto-deleveraging reduced may sit under the initial margin.** The reduction is forced, so the remainder must clear the size bounds and the maintenance margin. The [Auto-deleveraging](./adl.md) page gives that path.

## The initial margin sets the leverage ceiling

The ceiling is one divided by the initial margin. Each market sets its own initial margin through the [parameter-change process](../governance.md), so the ceiling differs by market. The table shows the margin that a 1,000 USDC position needs at three settings.

| Initial margin | Margin behind 1,000 USDC of size | Leverage ceiling |
| --- | --- | --- |
| 50% | 500 USDC | 2x |
| 5% | 50 USDC | 20x |
| 1% | 10 USDC | 100x |

No market may set an initial margin under 0.1% or over 50%, so every market allows at least 2x. Each market must also leave room between its two margin lines, and that rule lifts the real floor above 0.1%. No market reaches 1000x.

## The maintenance margin marks liquidation

The maintenance margin is the lower line. It reads your equity, which is what the position would return if it closed now. Your equity is your margin, plus or minus your unrealized profit or loss, less the costs the close settles. A position whose equity falls under the maintenance margin's share of its size can be liquidated. The [Liquidation](./liquidation.md) page gives what that close costs you.

The line also blocks you. While your equity sits under it, you cannot close the position and you cannot withdraw collateral. Liquidation is then the only close the position can take.

You can still add collateral, but the market checks the top-up like any other change. The accrued funding and borrowing interest come out of the added margin first. The position must then clear both lines in that one step. A top-up that leaves it under either line is refused, so one deposit must be large enough on its own. Once it is, the position trades again.

## The gap between the lines absorbs costs

The gap between the two lines absorbs adverse price moves and the costs that build up. Each market keeps that gap wide. A position opened at the initial margin still clears the maintenance margin after the fees of one small close. The gap is also the reason you cannot draw your collateral down to the maintenance margin. Every withdrawal must leave the position at or above the initial margin.

## Costs lower your equity after you open

Your equity falls without any change from you. Borrowing interest and the funding you owe build against a size that has not changed, and both lower your equity. An unrealized loss lowers it too. Your buffer above the maintenance margin shrinks, and the position moves toward liquidation.

Funding you earn becomes a credit you can claim separately. It does not raise your margin or your equity. Your posted margin does not change while those costs build, and a fill settles them against it. Added collateral restores the buffer at once.

## Every market bounds position size

Every market bounds the size of one position with a minimum and a maximum. The market checks both bounds on the position a change leaves behind, so an order that would push you past the maximum is refused. The [Positions](./positions.md) page gives what happens to a close that would leave less than the minimum.

A market also caps the total size of all positions on one side. An increase is refused once that side's total would pass the cap, even while your own position sits inside its own bounds. A fill that adds collateral and no size skips this cap. The [Market parameters](../markets/market-parameters.md) page gives the bounds of the deployed markets.

## A busy vault can refuse an increase

An increase can also be refused because the vault's liquidity is already committed. The market lets a side reserve only a set share of half the vault balance. The [Borrowing interest](./borrowing-interest.md) page gives that share and how it sets the rate. When a fill adds size, the market reads the reserve of the side you increase. It counts the fee the fill pays into the vault. If that reserve passes the limit, the fill is refused.

The other side does not block the fill. It can already sit over its own limit after a price move or a parameter change. A fill that adds collateral and no size reserves nothing and skips the check.

The refusal is not permanent. The check reads the vault balance and the open positions at the moment of the fill. Capacity returns when positions close or when liquidity providers add liquidity.

## What this means for your position

Two numbers decide what your position can do. The initial margin decides how much size your margin can carry and what you may change. The maintenance margin decides when the position is at risk of liquidation and when it is locked out of a close or a withdrawal. Costs move your equity toward the maintenance margin over time, and added collateral moves it back.

For the exact checks and the order they run in, see the [technical reference](/technical/market/margin-and-leverage).
