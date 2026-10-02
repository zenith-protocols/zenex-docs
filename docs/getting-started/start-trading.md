---
title: Start trading
sidebar_position: 2
---

# Start trading

This page walks a funded wallet through the trade form, one field at a time. A trade has two parts. You sign an order, and a keeper fills it against a price the market verifies. The order carries the terms you set, and no keeper can fill outside them. A term you leave open puts no limit on the fill. For the checks a price must pass before any fill, refer to [Prices](../markets/prices.md). For the ideas behind the form, refer to [Trading](../trading/overview.md).

## Before you start

Connect a wallet that holds the market's settlement token. That token is your collateral. The market charges every fee in it and pays every payout in it.

## 1. Pick a market

Each market trades one asset, settles in one token, and sets its own parameters. The market you pick fixes your settlement token, your leverage ceiling, and your fee rates. Each market also has its own vault, and that vault stands on the other side of your trade. For what a market holds, refer to [Markets](../markets/overview.md).

The market status decides which fills run. If the market is on ice or delisted, no keeper fills an order that opens a position or adds size. A side that auto-deleveraging has flagged takes no new size either. For every status, refer to [Market status](../markets/status.md).

## 2. Pick a side

If you expect the price to rise, pick long. If you expect it to fall, pick short. You can hold one long and one short in the same market at the same time. Each side carries its own collateral. Every later order on a side folds into the position you already hold there.

## 3. Pick an order type

The form offers a market order, a limit order, and a stop order. A market order fills at the next price the market verifies. A limit order and a stop order carry a trigger price, and the form asks for it here.

A limit order enters on a pullback. For a long, the price must fall to your level. For a short, it must rise to it. A stop order enters on a breakout. For a long, the price must rise to your level. For a short, it must fall to it. A limit level therefore sits below the market price for a long and above it for a short. A stop level sits above the market price for a long and below it for a short. For every order kind, refer to [Orders](../trading/orders.md).

## 4. Set the collateral and the leverage

Collateral is the amount you post with this order. The trade form sets the size the order adds from that collateral and the leverage you pick. Each market sets a smallest order size, a smallest collateral amount, and a leverage ceiling.

:::note
The leverage you end up with can sit slightly under the leverage you set, because the fill takes its fees out of the collateral you post. An order placed exactly at the market's ceiling can fail for that reason. [Margin and leverage](../trading/margin-and-leverage.md) has the rule and the market's size limits.
:::

## 5. Set the expiry and the price bound

The expiry is the last ledger at which a keeper can fill the order. After the expiry passes, the order stops filling. The market keeps holding your escrow until you cancel. A cancel returns it in full, before or after the expiry. **A frozen market blocks a cancel**, and your escrow stays with the market until the freeze lifts. For what else a freeze stops, refer to [Market status](../markets/status.md).

The price bound is the worst fill price you accept. A keeper can fill at that price or better, never worse. The trade form sets the bound from the slippage tolerance in your settings.

**An empty bound lets a keeper fill at any verified price, however far it sits from the price you saw.**

## 6. Add a stop loss or a take profit

Both are decrease orders that rest against your position with a trigger price. A stop loss closes size when the price moves against you and reaches your trigger. A take profit closes size when the price moves in your favor and reaches your trigger. Each one carries its own size. A size at or above your open size closes the position in full. So does a size that would leave less than the market's smallest position size.

Every fill that adds size locks that size for a short window. A full close inside the window fails, so a trigger that fires there leaves the position open. That order stays where it is, and a keeper can fill it once the lock ends. For the lock and the size it covers, refer to [Positions](../trading/positions.md). For the length of the window, refer to [Market parameters](../markets/market-parameters.md).

A decrease order escrows its own execution fee. It posts no collateral. An entry order with a stop loss and a take profit therefore escrows three execution fees.

You can rest up to eight decrease orders on one side. The trade form can create them in the same signature as your entry order. A close that takes your position to zero makes the market cancel every decrease order left on that side and return each escrow to you. A close that leaves size behind keeps the other decrease orders resting.

**A stop loss or a take profit cannot close a position whose equity has fallen under the maintenance margin.** The fill is refused, and only a liquidation can close that position. A liquidation charges its fee and ignores your triggers and the lock. For when a liquidation runs, refer to [Liquidation](../trading/liquidation.md).

## 7. Review and sign

Check the market, the side, the order type, any trigger, the collateral, the leverage, the expiry, the bound, and any stop loss or take profit. Then sign.

**Once the market accepts your order, your wallet pays the escrow.** That escrow is the collateral of each increase order plus one execution fee for every order in the signature. If a keeper fills an order, the fill's costs come out of the collateral you posted, and the rest becomes the position's margin. The market holds the execution fee beside that collateral, and the fee never reduces it. The market pays the whole fee to the keeper that fills the order. A cancel returns the whole escrow of that order. The transaction itself also costs a network fee, and [Fees](../trading/fees.md) covers how you pay it.

## What happens next

The trade form can send your order and its fill in one transaction, so a market order often fills at once. If that fill fails, the trade form has chosen one of two outcomes when it built the transaction. In the first, the whole transaction unwinds, your escrow never leaves your wallet, and you pay no relayer fee. In the second, the order rests until a keeper fills it or you cancel it, on the escrow terms in step 5.

You control the side, the collateral, the leverage, the order type, the bound, the expiry, and the cancel. You do not control who fills your order, at what moment, or at which verified price inside your bound. For the costs a fill settles, refer to [Fees](../trading/fees.md). For the life of the position after it opens, refer to [Positions](../trading/positions.md).
