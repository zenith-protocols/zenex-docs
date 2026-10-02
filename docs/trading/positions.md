---
title: Positions
sidebar_position: 2
---

# Positions

A position is your open exposure on one side of one market. This page covers how a fill changes a position, when the market holds size against a close, and what each kind of close returns. The market addresses a position by your account and by its side, long or short. You hold at most one long and one short in a market. Every later fill on a side folds into the position you hold there. The [Margin and leverage](./margin-and-leverage.md) page gives the margin behind a position and the floors it must meet.

## A fill folds into the position you hold {#how-a-fill-folds-in}

A fill that adds size adds what it buys to the size you already hold on that side. It pays its costs from the margin you posted with the order, and what remains joins the margin behind the position. The [Fees](./fees.md) page gives each cost and says how a fill draws on the margin already there when the posted amount falls short.

A fill that adds margin alone changes no size and locks nothing. The base asset is the asset whose price the market tracks. The market refuses a fill that buys none of it at the current price, because the size it added would carry no exposure.

## One entry price covers the whole size {#your-entry-price}

The position holds a single entry price for its whole size. The [Profit and loss](./pnl.md) page defines that price and marks it against the live price. A fill above your entry price raises it, and a fill below your entry price lowers it. Your liquidation price moves with it.

A partial close leaves the entry price where it is. It removes the same fraction of the value you paid and of the size, so the price they give does not change.

## The decrease lock holds new size against a close {#the-decrease-lock}

A fill that adds size locks the size it adds. The lock holds for a set time, and each market sets that time from fifteen seconds up to one day. The lock stops one price from opening and then closing the same size.

The size you already hold stays free to close, unless it sits under a lock of its own. While any of your size is locked, the market refuses a full close you request. The [full close](#what-a-full-close-returns) section says which requests count as one. A partial close can take no more than your unlocked size. The market refuses a larger request and does not cut it down to fit.

A later fill adds its size to the lock and restarts the clock over the whole locked amount. Size whose lock has run out does not lock again. **A liquidation reads no lock. It can close the whole position while the lock holds.**

## A partial close realizes profit or loss on the closed part {#what-a-partial-close-returns}

A close of part of the position realizes the profit or loss on that part alone. The trade fee and the impact fee of the close fall on that part too. The funding and the borrowing interest settle on the whole position, so a small close still settles every accrual the position owes. Any profit you realize pays those costs first, and the margin behind the position pays the rest of them.

The profit cap reduces a profit while the profit your side carries runs past what the vault backs. The [Profit and loss](./pnl.md) page gives that cap. The profit that survives the cap and the costs is paid out to you in the same fill. It never joins the margin behind the part that stays open. A realized loss comes out of that margin instead.

If the order also asks for margin back, the market pays that withdrawal last. It first takes the realized loss out of the margin behind the position, and then the costs your profit did not cover. The withdrawal can take no more than what remains. A close while the price moves against you can therefore return less margin than you asked for. The fill consumes the order either way. The market refuses a partial close that leaves the margin behind the position under the initial margin.

## A full close returns your equity {#what-a-full-close-returns}

A request at or above your open size closes the whole position. So does a smaller request that would leave less than the market's minimum position size, because that remainder could never meet the size floor. The [decrease lock](#the-decrease-lock) section says when the market refuses a full close.

A full close returns your [equity](./margin-and-leverage.md) at the price of the close. A profit inside that payout meets the same profit cap as a partial close. The market refuses a close you request while your equity sits under the maintenance margin. A full close you request therefore returns equity that still covers the maintenance margin's share of your size. **You never owe more than the margin behind the position.**

The same payout rule holds when a keeper closes the position for you. A liquidation charges a liquidation fee out of what survives, and the [Liquidation](./liquidation.md) page gives that fee. If a fast market takes a position past the point where any equity survives, the liquidation returns zero and the vault absorbs the shortfall. The [Auto-deleveraging](./adl.md) page gives the other close a keeper can run.

The close then clears the position. The size and the margin return to zero, and the side holds no entry price. Your next fill on that side opens a fresh position, with a new entry price and a new margin.

## A full close cancels the orders resting on that side

A take profit or a stop loss rests on chain as a decrease order against the position it closes. When the position closes in full, the market cancels every decrease order still resting on that side. The position those orders were meant to close is gone. Each cancelled order returns its escrow to you, inside the transaction that closes the position.

This holds for the close you request, for a liquidation, and for an auto-deleveraging fill that closes the rest of your size. The [Orders](./orders.md) page gives what each order escrows and how you cancel one yourself.

## A payout the market cannot send becomes claimable credit

Every payout on this page follows one rule. If the payment cannot reach your wallet, the fill still completes and the market parks the amount as claimable credit in your name. The [Claimable credit](./claimable-credit.md) page gives how you claim it.

## What this means for you

Every fill on a side changes the one position you hold there and moves your entry price with it. New size sits under the lock for a short time, so a full close waits for the lock to end. A close settles its costs before it pays you, and it never asks for more than the margin behind the position. A full close clears every order resting on that side.
