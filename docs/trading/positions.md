---
title: Positions
sidebar_position: 2
---

# Positions

A position is your open exposure on one side of one market. The market addresses it by your account and by that side, long or short. You hold at most one long and at most one short in a market. Every later fill on a side folds into the position you already hold there. The [Margin and leverage](./margin-and-leverage.md) page gives the margin behind a position and the floors it must meet.

## How a fill folds in

A fill that adds size to a side adds what it buys to the size you already hold there. It settles its costs from the margin you posted with the order. What remains joins the margin behind the position. If the costs are larger than the margin you posted, the rest comes out of the margin already there. The [Fees](./fees.md) page lists what a fill costs you.

## Your entry price

The position holds one entry price for its whole size. That price is the total value of your fills, divided by the size they bought. The fees on those fills do not enter it, and neither does the margin you posted. A fill above your entry price raises it, and a fill below your entry price lowers it. Your liquidation price moves with it. A partial close leaves the entry price where it is, because the part that stays open keeps its share of the fill value and of the size. The [Profit and loss](./pnl.md) page gives how your entry price marks against the live price.

## The decrease lock

A fill that adds size locks the size it adds. The lock holds for a set time. Each market sets that time, from fifteen seconds up to one day. The size you already hold stays free to close, unless it sits under a lock of its own. While any of your size is locked, the market refuses a full close you request. A partial close can take no more than your unlocked size. A request above that is refused, not cut down to fit. A later fill adds its size to the lock and restarts the clock over the locked amount. Size whose lock has run out does not lock again. **A liquidation reads no lock. It can close the whole position while the lock holds.**

## What a partial close returns

A close of part of the position realizes the profit or loss on that part alone. The trade fee and the impact fee of the close fall on that part. The funding and the borrowing interest settle on the whole position, so a small close still pays every accrual the position owes. Any profit you realize pays those costs first, and the margin behind the position pays the rest of them.

A profit is scaled down while your side sits far ahead of the vault. The [Profit and loss](./pnl.md) page gives that cap. The profit that survives the cap and the costs is paid out to you in the same fill. It never joins the margin behind the part that stays open. A realized loss comes out of that margin instead.

If the order also asks for margin back, the market pays that withdrawal last. The market first takes the loss out of that margin. It then takes the costs your profit did not cover. The withdrawal can take no more than what remains. A close while the price moves against you can therefore return less margin than you asked for. The fill consumes the order either way.

## What a full close returns

A request at or above your open size closes the whole position. So does a smaller request that would leave less than the market's minimum position size. A full close is refused while any of your size sits under the lock.

A full close returns your equity. Equity is the margin behind the position, plus the profit or loss on the whole size, less the costs the close settles. A profit inside that payout meets the same cap as a partial close. The payout floors at zero. If the loss and the costs run past the margin, the vault absorbs the shortfall. **You never owe more than the margin behind the position.**

The same payout rule holds when a keeper closes the position for you. A liquidation charges a liquidation fee out of what survives. The [Liquidation](./liquidation.md) page gives that fee. The [Auto-deleveraging](./adl.md) page gives the other close a keeper can run.

The close then clears the position. The size, the margin, and the entry price return to zero. The side is flat. Your next fill on that side opens a fresh position, with a new entry price and a new margin.

## A full close cancels the orders resting on that side

A take-profit or a stop-loss rests on chain as a decrease order against the position it closes. When the position closes in full, the market cancels every decrease order still resting on that side. Each cancelled order returns its escrow to you, inside the transaction that closes the position.

This holds for the close you request, for a liquidation, and for an auto-deleveraging fill that closes the rest of your size. The [Orders](./orders.md) page gives what each order escrows and how you cancel one yourself.
