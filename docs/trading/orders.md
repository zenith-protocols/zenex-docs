---
title: Orders
sidebar_position: 3
---

# Orders

An order is a signed request to change one side of your position by a size and a margin amount. You sign it with your own key, and your funds move into the market as escrow at that moment. The order then rests on chain. A keeper fills it against a verified price, or you cancel it and take your escrow back. An order that passes its expiry unfilled still holds your escrow until you cancel it. You never name the price you fill at. You name the conditions a fill must meet.

## Order kinds

Every order belongs to one of two families. An increase adds size or margin to a side. A decrease takes size or margin out of it. Each family has a market form, a limit form, and a stop form.

| Order | What it does | Fills when |
| --- | --- | --- |
| Market increase | Opens a side, or grows it | The next verified price arrives |
| Limit increase | Enters on a pullback | The price falls to your level for a long, or rises to it for a short |
| Stop increase | Enters on a breakout | The price rises to your level for a long, or falls to it for a short |
| Market decrease | Shrinks a side, or takes margin out | The next verified price arrives |
| Limit decrease | Takes profit | The price rises to your level for a long, or falls to it for a short |
| Stop decrease | Stops a loss | The price falls to your level for a long, or rises to it for a short |

A take-profit and a stop-loss are ordinary decrease orders with a trigger. Each one rests on chain as an order of its own. A side holds at most eight resting decrease orders. A ninth is refused at creation, until one of the eight is filled or cancelled. The [Positions](./positions.md) page describes what a close does to the orders still resting on that side.

## What you sign

A trigger is the level the price must cross for a limit order or a stop order. A market order carries no trigger. It fills at the next verified price a keeper submits.

An order of any kind can carry a bound, and the bound is a one-sided limit on the price you accept. An increase on a long and a decrease on a short are buys. On a buy the bound caps the fill price. An increase on a short and a decrease on a long are sells. On a sell the bound floors it. The direction follows the family and the side, so a margin-only order carries a bound the same way. A fill outside the bound is refused, and an order that already rests stays where it is. A bound left unset accepts any verified price. The market judges the trigger and the bound against the price your fill uses. Refer to [Prices](../markets/prices.md) for the side of the quote each fill takes.

The expiry is a ledger number, not a clock time. A keeper can fill your order while the current ledger is at or below your expiry. Once the ledger passes that number, no fill is possible. An expiry already behind the current ledger is refused at creation.

An order can name a size of zero and move margin alone. It can also name a margin amount of zero and move size alone. The market sets a floor on the size an order moves and a floor on the margin it moves. A value above zero must be at least its floor, and an order under either floor is refused at creation. So is an increase whose size is above the largest position the market allows. A decrease carries no size cap. Refer to [Margin and leverage](./margin-and-leverage.md) for the bounds a fill is checked against.

The keeper chooses which verified price to submit, and when. **The keeper cannot change the size, the margin, the trigger, the bound, or the expiry that you signed.**

## What an order escrows

An increase escrows the margin you post plus a flat execution fee. A decrease escrows the execution fee alone. The market copies the fee amount into your order at creation, so a later change to the market's fee leaves a resting order alone. The keeper that fills the order takes the fee. Refer to [Fees](./fees.md) for the rest of what a fill costs you, and for the network fee you pay on the transaction itself.

## Cancels

A cancel returns the whole escrow to you. An increase returns the margin and the execution fee. A decrease returns the execution fee. An order past its expiry cancels the same way and refunds in full.

A frozen market refuses a cancel, and your escrow stays in the market until the freeze lifts. Every other state allows a cancel, a retired market included. Refer to [Market status](../markets/status.md) for the states a market moves through and what each one stops.

## One transaction, create and fill

The app can create an order and fill it in the same transaction, and this is how a market order reaches you as one action. Two shapes exist, and the app picks one. In the first shape the fill must land. If the fill fails, the creation unwinds with it and nothing rests. In the second shape a failed fill leaves the order resting, ready for a later keeper.

The same transaction can create further orders alongside the one it fills. A take-profit or a stop-loss created that way rests while the position stays open. If the fill closes the position in full, the market cancels every decrease order resting on that side. That includes the ones the same transaction created, and each escrow comes back to you.

A keeper can fill your order only against a verified price the feed published at or after the moment you created it. A market order created and filled in the same ledger is the one exception. That order can fill against a verified price published shortly before you created it.
