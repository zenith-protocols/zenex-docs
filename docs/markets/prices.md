---
title: Prices
sidebar_position: 2
---

# Prices

Every price Zenex acts on comes from the one price stream a market is bound to. A keeper fetches a signed report from that stream and submits it with the call. Nothing in the market moves until the report passes the checks below. A delisted market can instead carry a flat settlement price, and the last section on this page covers that case.

## What a report must pass

The publishers of the stream sign every report they put out. A separate verifier contract checks those signatures first, and it checks that the signing publishers are still an active set. A report that fails either check takes the whole call down inside the verifier, before any of the checks below run.

One case is bounded rather than blocked. Zenex remembers a report it verified once and does not send the same bytes to the verifier again while that memory lasts. A report whose publishers are retired after that point stays usable for as long as the memory lives. The age limits below still hold, so such a report can price a call only while it is fresh enough for that call.

The oracle then checks the report itself. The report must price the stream this market is bound to, so a report for another asset is refused. It must not be past its own expiry. Its observation must be fresh enough for the call, and it must not run too far ahead of the network clock. Its quote must be sane. A sane quote carries a positive bid, a positive ask, and a bid at or below the ask.

**A report that fails any of those checks takes the whole call down with it.** No price reaches the market, so no fill, no fee, and no change to your position happens. Your order keeps resting, and its escrow stays where it is.

## How fresh a report must be

Two age windows apply, and the call decides which one it uses. A fill of your trade order or your vault order uses the strict window. A liquidation, an auto-deleveraging close, and an interest accrual use the wider window. Both windows live on the oracle, not on the market, so every market that oracle serves shares them.

The owner of the oracle sets the strict window between 3 and 15 seconds. The wider window is never shorter than the strict one, and it reaches 120 seconds at most. For the two windows a market runs today, refer to [Market parameters](./market-parameters.md). A report whose observation sits more than the strict window ahead of the network clock is refused under either window.

**A gap in the feed delays a fill of your own order. It does not delay a liquidation.** The wider window exists for the same gap. It lets a liquidation, an auto-deleveraging close, or an interest charge land during a gap, at an age an ordinary fill refuses.

## A report older than your order cannot fill it

The price that fills your order must be at least as fresh as the order itself. A keeper cannot reach back for a report the stream observed before you signed, and then fill you at it. A report observed at the moment you created the order is fresh enough. The one exception is a market order that is created and filled in the same ledger. That order can fill at a report the stream observed shortly before you created it. A ledger is the batch of transactions the network settles together. A vault deposit or redeem gets no such exception, and it can never fill in the ledger you create it in.

## The bid and the ask

A report carries two prices, not one. The bid is the price the stream puts on a sale, and the ask is the price it puts on a purchase. The distance between them is the spread.

The oracle pulls both sides toward the middle before the market uses them. Both sides move by the same amount, so the quote stays centered and a fixed share of the spread is taken out of it. You meet a narrower spread. Nothing is paid back to you. That share is one setting on the oracle, and it applies to every market the oracle serves. At the bottom of its range the report's own quote stands, and you meet the full spread. At the top both sides land on the midpoint, and the spread costs you nothing. The owner of the oracle can change the share. Every price below is the pulled-in quote, never the raw one.

## Which side your fill takes

You trade against the side of the quote that works against you.

| What your fill does | Side it uses |
| --- | --- |
| Opens a long or adds to one | The ask |
| Closes a long or reduces one | The bid |
| Opens a short or adds to one | The bid |
| Closes a short or reduces one | The ask |

A liquidation and an auto-deleveraging close take the same side as a close you run yourself. Your open position is marked at the side a close would use, so it shows a small loss from the moment it opens. The trigger level and the bound on your order are tested against the side the fill would take. The spread is therefore a real cost on every round trip. You enter on one side of the quote and you leave on the other. Refer to [Profit and loss](../trading/pnl.md) for how that mark reaches your equity.

## A market with a flat settlement price

The owner of a delisted market can fix one flat settlement price on it. From that moment the market stops reading the stream. It makes no oracle call, and it prices every close, every liquidation, every interest charge, and every vault fill at that one value. The bid and the ask are the same number, so the spread is gone with them. The owner can replace that price while the market stays delisted. Refer to [Market status](./status.md) for the wind-down and the point in it at which the price can be set.
