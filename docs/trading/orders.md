---
title: Orders
sidebar_position: 3
---

# Orders

This page covers the order kinds, the terms you sign, what an order escrows, when a fill can land, and how you cancel. An order is a signed request to change your long or your short in one market by a size and a margin amount. The [Positions](./positions.md) page explains what a long and a short are.

You sign the order with your own key, and your funds move into the market as escrow at that moment. The order then rests on chain. A [keeper](../keepers.md) fills it against a verified price, or you cancel it and take your escrow back. You set the conditions a fill must meet. The price a keeper submits decides the fill price, and the [Prices](../markets/prices.md) page gives the checks that price passes.

## Six order kinds split into increases and decreases

Every order belongs to one of two families. An increase adds size or margin to a side. A decrease takes size or margin out of it. Each family has a market form, a limit form, and a stop form.

| Order | What it does | Fills when |
| --- | --- | --- |
| Market increase | Opens a side, or grows it | The next verified price arrives |
| Limit increase | Enters on a pullback | The price falls to your level for a long, or rises to it for a short |
| Stop increase | Enters on a breakout | The price rises to your level for a long, or falls to it for a short |
| Market decrease | Shrinks a side, or takes margin out | The next verified price arrives |
| Limit decrease | Takes profit | The price rises to your level for a long, or falls to it for a short |
| Stop decrease | Stops a loss | The price falls to your level for a long, or rises to it for a short |

A market order, a limit order, and a stop order name the fill rule. An increase and a decrease name the family. A take profit is a limit decrease, and a stop loss is a stop decrease. Each one is created on chain as an order of its own and escrows its own execution fee. A side holds at most eight resting decrease orders. The market refuses a ninth at creation until one of the eight is filled or cancelled.

You can place a decrease order before your position on that side exists. It can fill only once the position does. When a close empties the side, the market cancels every decrease order still resting there, as the [Positions](./positions.md) page describes.

## You sign the terms a fill must meet

A limit order or a stop order carries a trigger, the level the price must cross. The trigger must be above zero. A market order carries no trigger and fills at the next verified price a keeper submits.

An order of any kind can carry a bound, a one-sided limit on the price you accept. An increase on a long and a decrease on a short are buys. On a buy the bound caps the fill price. An increase on a short and a decrease on a long are sells. On a sell the bound floors it. The direction follows the family and the side, so a margin-only order carries a bound the same way. A bound left unset accepts any verified price.

Take a long increase with a bound of 105. A fill at an ask of 105 passes, and a fill at an ask of 105.5 is refused. The order keeps resting. The market judges the trigger and the bound against the side of the quote your fill takes. The [Prices](../markets/prices.md) page gives that side for each fill.

The expiry is a ledger number and not a clock time. A ledger is the batch of transactions the network settles together, about every five seconds. A keeper can fill your order while the current ledger is at or below your expiry. After that no fill is possible. The market refuses an expiry already behind the current ledger at creation.

An order names a size and a margin amount. A size of zero moves margin alone, and a margin amount of zero moves size alone. An order that names zero for both moves nothing and is refused at creation. The market sets a floor on the size an order moves and a floor on the margin it moves. A value above zero must reach its floor, or the market refuses the order at creation. These floors differ from the position minimum, which the fill checks on the position it leaves behind. The [Market parameters](../markets/market-parameters.md) page gives the floors.

The market also refuses an increase at creation when its size is above the largest position the market allows. The fill then checks the position it leaves behind. The [Margin and leverage](./margin-and-leverage.md) page gives the size and margin bounds that check applies.

## An order escrows its fee, and its margin on an increase {#what-an-order-escrows}

An increase escrows the margin you post plus a flat execution fee. A decrease escrows the execution fee alone. The market copies the fee amount into your order at creation, so a later change to the market's fee leaves a resting order alone. A fill pays the execution fee to the keeper named on the fill.

A fill of an increase settles its costs from the escrowed margin, and what remains joins the margin behind the position. The [Positions](./positions.md) page gives how a fill folds in. The [Fees](./fees.md) page gives the rest of what a fill costs you, and the network fee you pay on the transaction itself.

## A fill lands only when the market and the price allow it

A frozen or retired market stops every fill and every new order. An on ice or delisted market fills no increase that adds size. Neither does an active market on a side that auto-deleveraging has flagged. You can still create that increase. It rests, with its escrow held, until the state changes, the order expires, or you cancel. An increase that adds margin alone is exempt, so it still fills and you can defend a position you hold. The [Market status](../markets/status.md) page gives each state, and the [Auto-deleveraging](./adl.md) page gives the flag.

A fill also needs a verified price published at or after the moment you created the order. When you already hold the position, the price must also be at or after the price that last marked it. A keeper cannot reach back for an older report. A refused fill leaves your order resting until a fresher price arrives. The [Prices](../markets/prices.md) page gives both rules.

A fill that would leave the position outside a limit of the market is refused too, and the order keeps resting. Those limits cover the position size, the margin, and how much of the vault's liquidity a side may reserve. The [Margin and leverage](./margin-and-leverage.md) page gives them.

## A cancel returns the whole escrow unless the market is frozen {#cancels}

A cancel returns the whole escrow to you. An increase returns the margin and the execution fee. A decrease returns the execution fee. **An order that expires unfilled keeps its escrow in the market until you cancel it.** That cancel refunds in full.

A frozen market refuses a cancel, and your escrow stays in the market until the freeze lifts. Every other state allows a cancel, a retired market included. The [Market status](../markets/status.md) page gives the states a market moves through and what each one stops.

## The app can create and fill an order in one transaction

The app can create an order and fill it in the same transaction, and this is how a market order reaches you as one action. Two shapes exist, and the app picks one. In the first shape the fill must land. If the fill fails, the creation unwinds with it and nothing rests. In the second shape a fill that the market refuses leaves the order resting, ready for a later keeper.

The same transaction can create further orders alongside the one it fills. A take profit or a stop loss created that way rests while the position stays open. If the fill closes the position in full, the market cancels every decrease order resting on that side. That includes the ones the same transaction created, and each escrow comes back to you.

One exception relaxes the price rule for the order. A market order created and filled in the same ledger can fill against a verified price published shortly before you created it. The rule on your position's last mark still applies.

## Your terms bound the fill, and the keeper picks the rest

**A keeper cannot change the size, the margin, the trigger, the bound, or the expiry that you signed.** The keeper chooses which of your orders to fill and when. It also chooses which verified price to submit, and that price must meet your terms and the rules above. An order without a bound accepts any verified price that meets its trigger. The bound is therefore the one term that limits how far the fill price can sit from your trigger. The [Keepers](../keepers.md) page gives what a keeper does and what it earns.
