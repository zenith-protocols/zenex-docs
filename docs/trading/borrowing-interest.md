---
title: Borrowing interest
sidebar_position: 7
---

# Borrowing interest

Borrowing interest is the price of the vault liquidity that your position reserves. The vault stands behind every open position, and the market charges the side that holds more of the asset. The charge runs for as long as your side is not the smaller one.

## Who pays

The market compares the asset that all longs hold against the asset that all shorts hold. The larger side pays borrowing interest, and the smaller side pays nothing. If the two sides hold the same amount, both pay, and each pays at its own rate. The amount of the asset decides which side pays, so a price move alone does not switch the side that pays.

If your side holds less of the asset than the other side, you accrue nothing new. What you already owe stays owed until your next fill settles it. You accrue again once your side holds at least as much as the other side.

## How the rate is set

The vault backs each side of a market with half its balance. Each market sets the share of that half a side may reserve, and that share is the side's capacity. Utilization is how much of its capacity the side's open positions reserve, from nothing reserved to fully reserved. A fill that adds size must leave both sides within their capacity. Your own increase can fail because the other side sits above its capacity. Between fills a price move or a vault outflow can carry a side above its capacity, and a side above it counts as fully used.

The rate follows utilization. An unused side pays nothing at all. From there the rate climbs in step with utilization, gently at first. Each market sets a target utilization where the curve bends, and above the bend the rate climbs faster. At full utilization it reaches the highest rate the market sets. The curve holds the cost down while the vault has room, and it climbs steeply near the top. That protects the vault from backing more than it can carry.

The two sides measure their reserve differently. The long side reserves the current market value of the asset its positions hold, so its reserve moves with the price. The short side reserves the value its positions opened at.

The bend, the two rates that shape the curve, and the share each side may reserve are per-market parameters. For the values in force and who changes them, see [Market parameters](../markets/market-parameters.md). For the curve in full, see the [technical reference](/technical/market/borrowing-rate).

## What you pay

The market accrues borrowing interest in windows. Each accrual reads which side is larger once, and that one reading prices the whole window since the last accrual. The charge falls on the value your position opened at. Your side's rate for that window sets how much it costs. The market takes the amount from your collateral, not from your wallet. The charge settles at your next fill. An increase, a decrease, a close, a liquidation, and an auto-deleveraging fill all settle it. Each of them itemizes the amount.

What you owe counts against your equity before the market settles it, so it moves your liquidation price toward you over time. See [Liquidation](./liquidation.md). The longer you hold on the side that pays, the more you pay. The cost adds up on a position you hold open for days.

## Where it goes

Borrowing interest leaves the traders who pay it and goes to the vault, less the share the treasury takes. Keepers take no part of it, and no trader receives it. Funding works differently. It passes from one side of the market to the other and stays with traders. See [Funding rate](./funding-rate.md). For a liquidity provider, borrowing interest is one of the inflows that lift what a vault share is worth. See [Share value](../vault/share-value.md).
