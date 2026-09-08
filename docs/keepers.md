---
title: Keepers
sidebar_position: 5
---

# Keepers

A keeper is an account that submits a fill, a liquidation, or an auto-deleveraging close to a market. Any account can do that work, and you can be your own keeper. The call names the account the market pays.

Your order never fills on its own, and your position never changes on its own. Some account must submit a call, and that call must carry a price report the market accepts. You create an order and escrow the funds behind it. A keeper then submits a price report, and the market fills your order against the price it takes from that report. You create the order in one call, a keeper fills it in a second call, and any account can make the second one.

The same shape holds for a liquidation, for an auto-deleveraging close, and for a vault deposit or redeem. Each one is a call an account makes with a price report in hand. Refer to [Prices](./markets/prices.md) for the checks a report must pass and the price each call runs at.

## What a keeper does

A keeper can run six kinds of work on a market. Each one is a separate call, and a keeper can run any subset of them.

| What the keeper does | What the call pays |
| --- | --- |
| Fills a trade order: an open, a close, a take-profit, or a stop-loss | A share of the trade fee and the impact fee on the fill, plus the execution fee your order escrowed |
| Fills a vault order: a deposit or a redeem | A share of the vault fee on the fill, plus the execution fee that order escrowed |
| Liquidates a position the market allows a liquidation on | A share of the trade fee, the impact fee, and the liquidation fee the close charges |
| Reduces a winning position on a flagged side | A share of the trade fee and the impact fee the close charges |
| Brings a market's borrowing and funding up to date | Nothing |
| Refreshes the auto-deleveraging measurement on both sides | Nothing |

The first four rows pay. The keeper's share of the trade fee, the impact fee, the liquidation fee, and the vault fee is a rate the market sets. The treasury and the vault take the rest. The execution fee goes to the keeper in full. A liquidation and an auto-deleveraging close consume no order, so neither one carries an execution fee. Refer to [Fees](./trading/fees.md) for each charge and where it goes. Refer to [Liquidation](./trading/liquidation.md) for the liquidation fee. Refer to [Deposits and redeems](./vault/depositing.md) for the vault fee.

The last two rows pay nothing. Neither call takes a reward recipient, and neither one moves a position. A keeper runs that upkeep alongside the work that pays, because both need a fresh price.

## What the market checks in place of the caller

The market checks the price, and it checks the terms you signed. It never checks who sent the call.

Every call a keeper makes carries a price report, and the oracle checks that report before the market acts on it. A report that fails any check takes the whole call down with it. A keeper cannot invent a price, and cannot submit a report that expired. A delisted market with a flat settlement price is the one case where the market checks no report. It runs every call at that price instead.

The market then reads your order out of its own storage, not out of the keeper's call. The size, the margin, the trigger, the bound, and the expiry are the ones you signed. A keeper names which order to fill and nothing inside it. The market refuses a fill against an uncrossed trigger and a fill outside your bound. Your order rests and your escrow stays where it is. It also refuses a fill after your expiry. An expired order never fills again, and a cancel returns its escrow to you in full.

A liquidation and an auto-deleveraging close consume no order, so there the market checks the position instead. A liquidation runs on a position whose equity falls under the maintenance margin. Seven days after a delist it runs on any position left in that market, at any level of health. An auto-deleveraging close runs on a winning position on a flagged side, and only up to a bounded amount. The market refuses a call that names a position outside those tests. Refer to [Liquidation](./trading/liquidation.md) and to [Auto-deleveraging](./trading/adl.md) for each test.

The market pays the account the call names, and it never checks that account. On an auto-deleveraging close a keeper also names which winning position to reduce, and by how much inside those bounds.

## What you do not control

You control the terms of your order. You do not control which keeper fills it, at what moment, or at what price inside your bound.

A stop-loss fills when the price of a fill reaches your stop level or passes it. It does not fill at the moment the market itself reaches that level. The fill can land late, and the price it lands at can sit past the level you named. A bound on the order caps that gap. An order without a bound accepts any price the market takes from a report it accepts. Refer to [Orders](./trading/orders.md) for triggers and bounds.

A vault order waits the same way. A deposit rests until a keeper fills it, and a redeem serves out its cooldown first. Until a fill lands, the market holds your escrow and your order rests.

Work reaches a keeper because it pays. A resting order whose conditions hold pays the account that fills it, and a position under its maintenance margin pays the account that closes it. The reward is what makes an account act.
