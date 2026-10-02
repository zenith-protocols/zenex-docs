---
title: Keepers
sidebar_position: 5
---

# Keepers

A keeper is an account that submits the calls that move a market. Those calls fill orders, liquidate positions, reduce winning positions, and refresh the market's measurements. Any account can be a keeper, and you can be your own.

Nothing on Zenex moves on its own. An account must submit a call, and that call must carry a signed price report the market accepts. You create an order and escrow the funds behind it, so the market holds them until a fill or a cancel. A keeper then fills the order in a second call against the price in its report. Liquidations, auto-deleveraging closes, and vault deposits and redeems follow the same shape. Most of these calls pay their keeper, and that pay is why someone acts. For the checks a report must pass and the price each call uses, see [Prices](./markets/prices.md).

## What a keeper does

A keeper can make six kinds of call on a market. Each kind is separate, and a keeper can make any of them.

| What the keeper does | What the call pays |
| --- | --- |
| Fills a trade order, meaning an open, a close, a take profit, or a stop loss | A share of the trade fee and the impact fee on the fill, plus the execution fee your order escrowed |
| Fills a vault order, meaning a deposit or a redeem | A share of the vault fee on the fill, plus the execution fee that order escrowed |
| Liquidates a position whose equity has fallen under its maintenance margin, or any position left in a market seven days after its delisting | A share of the trade fee, the impact fee, and the liquidation fee the close charges |
| Reduces a winning position on a flagged side, meaning a side whose pending profit has grown too large against the vault | A share of the trade fee and the impact fee the close charges |
| Brings a market's borrowing and funding up to date | Nothing |
| Measures both sides' pending profit and sets or clears their flags | Nothing |

The first four rows pay. Each market sets one keeper share, and it applies alike to the trade fee, the impact fee, the liquidation fee, and the vault fee. The treasury takes its own share of the same fee, at the rate the treasury sets for every market, and neither share reduces the other. The vault keeps the rest. The execution fee goes to the keeper in full. A liquidation and an auto-deleveraging close consume no order, so neither one carries an execution fee. See [Market parameters](./markets/market-parameters.md) for the current share.

A keeper names the account that receives the reward, and that account need not be the keeper's own.

A vault fill that would pay less than your minimum received rejects the order instead of filling it. The keeper then earns the execution fee alone, because the market charges no vault fee on a rejected order.

Each fee has a home page:

- [Fees](./trading/fees.md) for the trade fee, the impact fee, the execution fee, and where each goes.
- [Liquidation](./trading/liquidation.md) for the liquidation fee.
- [Deposits and redeems](./vault/depositing.md) for the vault fee and the minimum received.

The last two rows pay nothing. A keeper runs the measurement refresh because a side must be flagged before any auto-deleveraging close can run. See [Auto-deleveraging](./trading/adl.md) for how a flag is set and cleared.

## The market checks the price and your terms, not the caller

Any account can send any keeper call. The market checks the price report and the terms you signed instead.

Every call carries a price report, and the market checks that report before it acts. A report that fails any check fails the whole call. A keeper cannot invent a price or submit an expired report, and a report older than your order cannot fill it, unless it is a market order filled in the ledger that created it. A delisted market with a flat settlement price checks no report. It prices every call at that value.

The market reads your order from its own records, not from the call. A keeper names which order to fill and nothing inside it. The size, the margin, the trigger, the bound, and the expiry are the ones you signed. The trigger is the level a limit or stop order waits for, and the bound is the worst price you accept. A fill fails if the price has not crossed your trigger or if it lands outside your bound. The order then keeps resting and the market keeps your escrow. A fill after your expiry fails too. An expired order never fills, and a cancel returns its escrow in full.

A liquidation and an auto-deleveraging close consume no order, so the market checks the position instead. A liquidation needs a position that fails the health test, except that seven days after a delisting it can close any position left in that market. An auto-deleveraging close needs a winning position on a flagged side. On that close a keeper also names which winning position to reduce and by how much, inside the limits the auto-deleveraging page gives. See [Liquidation](./trading/liquidation.md) and [Auto-deleveraging](./trading/adl.md) for each test.

## What you do not control

You control the terms of your order. You do not control which keeper fills it, when the fill lands, or the price inside your bound.

A stop loss fills when the price in the keeper's report reaches your stop level or passes it. The market tests that price on the side of the quote your fill uses. The fill can land after the price first reached the level, and the price it lands at can sit past the level. A bound caps that gap. **An order without a bound fills at any price the market accepts from a report.** See [Orders](./trading/orders.md) for triggers and bounds.

A vault order waits the same way. A deposit rests until a keeper fills it in a later ledger, on a report at least as new as the order. A redeem serves out its cooldown first. A rejected order ends at the first attempt, and your assets or shares come back. Any other refused fill leaves the order resting.

A frozen market accepts no keeper call, so nothing fills until the freeze lifts. See [Market status](./markets/status.md) for what each state stops.

A keeper decides which valid call to make and when. The terms you signed and the price checks limit every fill, and timing is the risk that remains. See [Risks](./risks.md) for what a late or absent keeper costs you.
