---
title: Profit and loss
sidebar_position: 9
---

# Profit and loss

Your profit or loss on a position is the distance between what your size is worth now and what you paid for it. A long gains when that value rises above the cost, and loses when it falls below. A short runs the other way. The market works the number out again at every price.

## Your entry price is implied

A position holds two numbers. One is the size it carries in the market's base asset. The other is what that size cost in the settlement token. Your entry price is that cost divided by that size. Nothing else records it.

The cost is the value of the size at entry, not the margin you posted. The position tracks your margin on its own. Each fill adds its own size and its own cost to the pair, so your entry price follows your fills. The [Positions](./positions.md) page gives how a fill and a partial close move it.

## The price your profit is marked at

You enter on one side of the quote and you leave on the other. A long enters at the ask and leaves at the bid. A short enters at the bid and leaves at the ask. The profit on your own position is marked at the price your side would leave on. The [Prices](../markets/prices.md) page gives the two prices and where they come from.

The spread between them is a real cost, and it is the first thing your position must overcome. A position shows a loss from the moment it opens. That loss is the full crossing from one side of the quote to the other, across your whole size. It grows with your size and with the width of the spread. A round trip at an unchanged quote returns less than you paid. The fees of the open and the fees of the close land on top of the spread. You pay the spread inside the price of every fill.

## Unrealized profit moves with every price

Unrealized profit or loss is the gain or loss your open position carries at the current price. It changes every time the feed publishes a new price, and it needs no action from you. An unrealized profit is already reduced by the limit the vault puts on the profit it recognizes. The [profit cap](#the-profit-cap) section below gives that limit. Your unrealized profit or loss also sets your equity, and the [Margin and leverage](./margin-and-leverage.md) page gives how equity decides your liquidation line.

**It is a mark, not a payout. Your profit becomes cash only when the position closes.** The close pays the trade fee, the impact fee, and the funding and borrowing the position owes. The money that reaches you is therefore smaller than the mark. The [Fees](./fees.md) page gives each of those charges, and the [Positions](./positions.md) page gives what a partial close and a full close return.

## The profit cap

The vault is the counterparty to every position, so it recognizes a limited amount of trader profit on each side of a market. That allowance is a share of half the vault balance. Each market sets the share through the [parameter-change process](../governance.md).

The side total is the profit and loss of every open position on your side, netted together. A loss on your side lowers it, and moves the point where the allowance starts to reduce payouts. While that total stays at or under the allowance, a winner is paid in full. **Above the allowance, a winner is paid a scaled-down share of the profit, and the vault keeps the rest.** The further the side runs past its allowance, the smaller the share it pays out. The market values the side at whichever of the two quoted prices gives the larger total. The allowance can therefore reduce your payout before your own mark shows it.

A loss always passes through in full. The cap applies to every close that pays out a profit. It applies to a full close, to a partial close, and to a liquidation. Your payout is final at the close, and the withheld part stays in the vault with the liquidity that backs the market. The [Liquidation](./liquidation.md) page gives what happens when your equity runs out.

Auto-deleveraging is the separate backstop against a side that runs past its allowance. It cuts the size of a winning position. The close it forces realizes profit through the cap above, like any other close. The [Auto-deleveraging](./adl.md) page gives when it fires and what it takes.
