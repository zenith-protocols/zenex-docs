---
title: Profit and loss
sidebar_position: 9
---

# Profit and loss

This page covers how the market marks your profit or loss and why a position starts in loss. It also covers how the profit cap scales down a payout when one side of a market runs far ahead. Your profit or loss on a position is the gap between what your size is worth now and what it cost you. A long gains when that value rises above the cost and loses when it falls below. A short runs the other way.

## Your entry price is the reference for the mark

The cost of your size is the value of your fills at entry. The margin you posted does not enter it. Your entry price is that cost divided by that size, so each fill you add moves it. The [Positions](./positions.md) page gives how a fill and a partial close change it.

## Your profit is marked at the price you would leave on

You enter on one side of the quote and you leave on the other. A long enters at the ask and leaves at the bid. A short enters at the bid and leaves at the ask. The market marks your position at the price you would leave on. The [Prices](../markets/prices.md) page gives the two prices and where they come from.

The spread between them is the first cost your position must overcome. Your entry sits on one side of the quote and your mark on the other. A position therefore shows a loss from the moment it opens. That loss is the full crossing from one side to the other, across your whole size. It grows with your size and with the width of the spread. A round trip at an unchanged quote returns less than you paid. The fees of the open and the fees of the close come on top. You pay the spread inside the price of every fill, so it needs no separate charge.

## Unrealized profit follows every price

Unrealized profit or loss is the gain or loss your open position carries at the current price. The market recalculates it against each price report it acts on, and it needs no action from you. The mark does not include the profit cap. The cap reduces a profit only when a close pays it out, and the [profit cap](#the-profit-cap-scales-a-winners-payout-when-a-side-runs-ahead) section gives how. Your equity counts the profit after the cap has scaled it. The [Margin and leverage](./margin-and-leverage.md) page gives how equity decides your liquidation line.

**Unrealized profit is a mark. It becomes cash when a close realizes it, in full or in part.** The close settles the trade fee, the impact fee, and the funding and borrowing the position owes. The cash that reaches you is therefore smaller than the mark. The [Fees](./fees.md) page gives each of those charges, and the [Positions](./positions.md) page gives what a partial close and a full close return.

## The profit cap scales a winner's payout when a side runs ahead

The vault is the counterparty to every position, so the profit on a side is a claim on the vault. The profit cap limits how large a claim the vault recognizes on each side of a market. The cap is a share of half the vault balance. Each side measures against its own half, so the two sides together never claim more than that share of the whole vault. Each market sets the share through the [parameter-change process](../governance.md).

The pending profit of a side is the profit of every open position on that side, netted together. To value the side, the market prices every position at the quote price that favors the traders. That is the ask for longs and the bid for shorts. That price is kinder to traders than your own mark. The cap can therefore reduce your payout before your own mark shows any excess.

The cap moves with the vault balance. The pending profit moves with the positions on the side. A loss on your side lowers it. It never lowers it below minus the margin the side has posted, because a paper loss beyond that margin cannot be realized. While the pending profit stays at or under the cap, a winner is paid in full. **Above the cap, a winner is paid a scaled-down share of the profit, and the vault keeps the rest.** The further the side runs past the cap, the smaller the share.

Take a cap of 100 USDC on the long side, with 125 USDC of pending profit across all longs. The share is 100 out of 125, which is four fifths. A long that closes with 10 USDC of profit is paid 8 USDC, before the costs of the close. If other longs then lose enough to bring the side to 100 USDC or less, the next winner is paid in full.

A loss always passes through in full. The cap applies to every close that pays out a profit, which includes a full close, a partial close, and a liquidation. Your payout is final at the close, and the withheld part stays in the vault with the liquidity that backs the market. The [Liquidation](./liquidation.md) page gives what happens when your equity runs out.

Auto-deleveraging is the backstop against a side that runs past its cap. It cuts the size of a winning position. The close it forces realizes profit through the cap like any other close. A keeper flags a side for it once the side passes a trigger set at or below the cap, so the trigger is reached no later than the point where the cap scales any payout, and the [Market parameters](../markets/market-parameters.md) page gives that order. The [Auto-deleveraging](./adl.md) page gives when it fires and what it takes.

## What this means for you

Your mark shows the profit before the cap, and your payout can be smaller than the mark for two reasons. The close settles its costs, and the cap scales the profit while your side sits above it. The cap never scales a loss.
