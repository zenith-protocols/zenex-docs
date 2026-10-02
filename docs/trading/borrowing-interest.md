---
title: Borrowing interest
sidebar_position: 7
---

# Borrowing interest

Borrowing interest is the charge for the vault liquidity that your position reserves. This page says which side of a market pays it and how the rate follows the use of the vault. It then shows how the charge builds and settles, and what it costs on one 10,000 USDC position. USDC is the settlement token of the market in the example.

## The side that holds more of the asset pays

The market compares the base asset that all longs hold with the base asset that all shorts hold. The base asset is the token whose price the market tracks. The side that holds more pays borrowing interest. The smaller side pays nothing, because the larger side is the one whose extra exposure the vault carries.

The comparison uses amounts of the asset and not their value. A price move alone therefore never switches the side that pays. Opens and closes change the amounts, and they can switch it. If both sides hold exactly the same amount, neither is the smaller one. Both pay, each at the rate of its own utilization.

## Utilization sets the rate

The vault backs each side of a market with half of its balance. A market lets a side reserve only a set share of that half, and that share is the side's capacity. Utilization is the part of its capacity that the side's open positions reserve, from nothing to all of it.

The rate follows utilization. A side with nothing reserved pays nothing. Below a bend that the market sets, the rate climbs in proportion to utilization. Above the bend, the market's highest rate can make the climb steeper. At full utilization the rate reaches that highest rate. The rate rises with use, so vault liquidity costs more as it gets scarce.

The two sides count their reserve differently. A short can gain at most the size it opened at, so the short side reserves the size its positions opened at. A long has no such limit. The long side reserves the current value of the asset its positions hold. The utilization of the long side therefore moves with the price, and the utilization of the short side does not. A rising price lifts the rate that the long side would pay, and a falling price lowers it.

A fill that adds size must leave the side you increase within its capacity. The market does not check the other side. That side can sit above its capacity after a price move or a change to the market's settings, and it must not block you. A fill that only adds collateral reserves nothing and skips the check. A side above its capacity counts as fully used, so it pays the highest rate.

The bend, the two rates that shape the curve, and the share each side may reserve are per-market parameters. For the values in force and who changes them, see [Market parameters](../markets/market-parameters.md). For the curve in full, see the [technical reference](/technical/market/borrowing-rate).

## Your charge builds on the size you entered with

The market brings its interest up to date each time an action reaches it. At that moment it reads which side holds more, and it prices the whole time since the previous update with that one reading. If your side is the larger one, you pay for the whole stretch. If your side is the smaller one, you accrue nothing for it. A frozen market keeps counting, as [Market status](../markets/status.md) explains.

The charge falls on the size your position opened at, and your side's rate sets its price. The rate of a long can move with the price. The size it applies to does not move. The charge grows with your size, with the rate, and with the time you hold the position.

The market takes the interest from the collateral behind your position and never from your wallet. It settles at the next change to your position. An increase, a decrease, a close, a liquidation, and an auto-deleveraging fill each settle it. What you owe stays owed until then, even if your side turns into the smaller one. The [Fees](./fees.md) page gives what a fill takes first when it settles the interest.

Unsettled interest counts against your equity, so the liquidation line moves toward your entry price the longer you hold. The [Liquidation](./liquidation.md) page gives that line.

## What it costs on one position

Take the position from the Liquidation page. It is a long of 10,000 USDC in size, entered at 2.50 USDC, at 20x leverage with 500 USDC of collateral. Its side holds more of the asset, so it pays. The table shows the charge at three rates. The rates are illustrations and not rates in use.

| Rate paid | After 1 day | After 10 days | After 30 days |
| --- | --- | --- | --- |
| 10% a year | 2.74 USDC | 27.40 USDC | 82.19 USDC |
| 20% a year | 5.48 USDC | 54.79 USDC | 164.38 USDC |
| 40% a year | 10.96 USDC | 109.59 USDC | 328.77 USDC |

At 20% a year the position pays about 5.48 USDC a day. That is a third of its collateral after 30 days. The liquidation line sits 300 USDC of equity under the collateral. At 40% a year the interest alone takes that 300 USDC in about 27 days, before any fee, any funding, or any price move.

The charge falls on size, so leverage does not change it. The same 10,000 USDC of size pays the same interest at 5x, with 2,000 USDC of collateral behind it. The extra collateral gives the interest 1,800 USDC of room before the liquidation line, and not 300 USDC.

## Where the interest goes

The interest leaves the traders who pay it. The treasury takes its share and the vault keeps the rest. The [Fees](./fees.md) page gives that split. For a liquidity provider, borrowing interest is one of the inflows that lift what a vault share is worth. See [Share value](../vault/share-value.md). Funding is a separate charge that passes between the two sides. See [Funding rate](./funding-rate.md).

## What it means for you

Borrowing interest is a cost of time on the side that holds more of the asset. It stops accruing while your side is the smaller one and starts again when your side holds at least as much as the other side. It depends on your size and never on your profit or your leverage. The table above shows how it adds up over weeks.
