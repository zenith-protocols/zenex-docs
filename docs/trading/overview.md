---
title: Trading
sidebar_position: 1
---

# Trading

A trade on Zenex has two parts. You sign an order, and a [keeper](../keepers.md) fills it against a price the market verifies. This page follows one trade from order to close and names the page that owns each step. For the checks a price must pass, refer to [Prices](../markets/prices.md).

Your position stays open until you close it. Two closes can come without your request. A liquidation closes the whole position once its equity falls under the maintenance margin, or whatever its equity once a delisted market passes its seventh day. Auto-deleveraging (ADL) reduces a winning position when the vault cannot safely back the profit its side holds. **Both closes happen without your consent.** Each page below owns one part of the trade.

| Page | What it covers |
| --- | --- |
| [Positions](./positions.md) | What a position is, how a fill changes it, and what a close returns to you. |
| [Orders](./orders.md) | The order kinds, the terms you sign, the escrow each kind takes, and how you cancel. |
| [Margin and leverage](./margin-and-leverage.md) | The collateral behind a position, the leverage the market allows, and the two margin lines. |
| [Fees](./fees.md) | The charges a fill pays, what sets each one, and where each one goes. |
| [Funding rate](./funding-rate.md) | The transfer between the two sides of a market, and how the rate moves. |
| [Borrowing interest](./borrowing-interest.md) | The cost of the vault liquidity a side reserves, and the rate that sets it. |
| [Claimable credit](./claimable-credit.md) | The balance the market holds in your name, how it fills up, and what a claim pays. |
| [Profit and loss](./pnl.md) | How your gain or loss is marked while a position is open, and when it becomes cash. |
| [Liquidation](./liquidation.md) | When a keeper can close your position, what the close costs, and what returns to you. |
| [Auto-deleveraging](./adl.md) | When a keeper closes a winning position, in part or in full, to protect the vault. |
