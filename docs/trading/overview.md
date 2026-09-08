---
title: Trading
sidebar_position: 1
---

# Trading

A trade on Zenex starts with an order that you sign with your own key. You escrow the margin and the keeper's fee with the order, so your own funds cover the keeper's reward. A keeper fills that order against a price that the oracle checks. On a fill that opens or adds to a position, the escrow covers the costs and the remainder posts as margin. On a fill that reduces a position, the costs come out of the margin and the profit already on it. Your position runs until you close it, or until a keeper closes part of it or all of it for you. The pages below cover each part of a trade.

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
