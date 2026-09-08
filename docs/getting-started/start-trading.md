---
title: Start trading
sidebar_position: 2
---

# Start trading

A trade on Zenex has two parts. You sign an order, and a keeper fills it against a price the market verifies. The order carries the terms you set, and no keeper can fill outside them. A term you leave open puts no limit on the fill. This page walks a funded wallet through the trade form once, field by field. For the checks a price must pass before any fill, refer to [Prices](../markets/prices.md). For the ideas behind the form, refer to [Trading](../trading/overview.md).

## Before you start

Connect a wallet that holds the market's settlement token. That token is your collateral. The market pays every fee and every payout in it.

## Step 1: Pick a market

Each market trades one asset, settles in one token, and sets its own parameters. The market you pick fixes your settlement token, your leverage ceiling, and your fee rates. Each market also has its own vault, and that vault stands on the other side of your trade. For what a market holds, refer to [Markets](../markets/overview.md).

## Step 2: Pick a side

If you expect the price to rise, pick long. If you expect it to fall, pick short. You can hold one long and one short in the same market at the same time. Each side carries its own collateral. Every later order on a side folds into the position you already hold there.

## Step 3: Pick an order type

A market order fills at the next price the market verifies. A limit order rests until the price reaches your trigger in your favor. A stop entry rests until the price passes your trigger against you. For every order kind and the family it belongs to, refer to [Orders](../trading/orders.md).

A limit order and a stop entry both carry a trigger price, and the form asks for it here. Set the level the price must cross. On a limit order that level sits below the market price for a long and above it for a short. On a stop entry it sits above the market price for a long and below it for a short.

## Step 4: Set the collateral and the leverage

Collateral is the amount you post with this order. The size the order adds is that collateral multiplied by the leverage you pick. Each market sets a smallest order size, a smallest collateral amount, and a leverage ceiling.

**On the order that opens a side, collateral posted at the exact leverage ceiling fails the fill.** The fill takes its costs out of the collateral you post with that order. What is left must still cover the whole position that the fill leaves you with. Pick leverage below the ceiling. An order that adds to a position already holding surplus collateral can pass at the ceiling. For the two margin lines and what each one measures, refer to [Margin and leverage](../trading/margin-and-leverage.md).

## Step 5: Set the expiry and the price bound

The expiry is the last ledger at which a keeper can fill the order. After it passes, the order stops filling. The market keeps holding your escrow until you cancel. A cancel returns it in full, before or after the expiry. **A frozen market blocks a cancel**, and your escrow stays with the market until the freeze lifts. For what else a freeze stops, refer to [Market status](../markets/status.md).

The price bound is the worst fill price you accept. A keeper can fill at that price or better, never worse. Leave the bound empty to accept a fill at any verified price. The app sets the bound from the slippage you allow.

## Step 6: Add a stop loss or a take profit

Both are decrease orders that rest against your position with a trigger price. A stop loss closes the position when the price passes your trigger against you. A take profit closes it when the price reaches your trigger in your favor. Every fill that adds size locks that size for a short window. A full close inside the window fails, so a trigger that fires there leaves the position open. That order stays where it is, and a keeper can fill it once the lock ends. For the lock and the size it covers, refer to [Positions](../trading/positions.md). For the length of the window, refer to [Market parameters](../markets/market-parameters.md).

A decrease order escrows its own execution fee. It posts no collateral. An entry order with a stop loss and a take profit therefore escrows three execution fees.

You can rest up to eight decrease orders on one side. The app can create them in the same signature as your entry order. When a close takes your position to zero, the market cancels every decrease order left on that side and returns each escrow to you. Liquidation can close your position whatever your triggers say. For the line that liquidation runs on, refer to [Liquidation](../trading/liquidation.md).

## Step 7: Review and sign

Check the market, the side, the order type, any trigger, the collateral, the leverage, the expiry, the bound, and any stop loss or take profit. Then sign.

**Your collateral and one execution fee for every order in the signature leave your wallet the moment you sign.** The market holds them as escrow against those orders. If a keeper fills an order, the fill's costs come out of the collateral you posted, and the rest becomes the position's margin. The market holds the execution fee beside that collateral, and the fee never reduces it. It pays the keeper in full. A cancel returns the whole escrow of that order. The transaction itself also costs a network fee, and [Fees](../trading/fees.md) covers how you pay it.

## What happens next

The app can send your order and its fill in one transaction, so a market order often fills at once. If that fill fails, one of two outcomes follows, and the app picks which one when it builds the transaction. Either the whole transaction unwinds and nothing leaves your wallet, or the order rests until a keeper fills it on the escrow terms in Step 5.

You control the side, the collateral, the leverage, the order type, the bound, the expiry, and the cancel. You do not control who fills your order, at what moment, or at which verified price inside your bound. For the costs a fill settles, refer to [Fees](../trading/fees.md). For the life of the position after it opens, refer to [Positions](../trading/positions.md).
