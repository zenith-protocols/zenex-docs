---
title: Prices
sidebar_position: 2
---

# Prices

This page covers where a market gets its price. It also covers the checks a price report must pass, how fresh it must be, and which side of the quote your fill takes. A market is bound to one price stream. A price report is the stream's signed quote, and a [keeper](../keepers.md) submits it with the call it runs. The quote holds two prices, a bid and an ask, and the time at which the stream observed them. The market acts only on a report that passes the checks below. A delisted market can instead price at one flat settlement price, and the last section covers that case.

## A report must pass two layers of checks

The publishers of the stream sign every report. Chainlink's verifier contract checks those signatures and checks that the publishers' signing configuration is still active. The oracle is the contract that checks each price report. It runs its own checks on the report after the verifier.

- The report must price the stream this market is bound to. A report for another asset cannot price this market.
- The report must not be past its own expiry.
- The observation time must be recent enough for the call. The next section gives the two age limits.
- The observation time and the start of the report's validity may not run ahead of the network clock by more than the strict age limit. The network clock trails real time, so a fresh report can sit slightly ahead of it. The strict age limit bounds that gap.
- The quote must be usable. The bid and the ask must be positive, and the bid must not exceed the ask. The stream's reference price, which the market uses for nothing else, must be positive too. A crossed or zero quote has no sensible price to fill at.

**A report that fails any check fails the whole transaction.** No price reaches the market, so no fill, no fee, and no change to your position happens. Your order keeps resting, and its escrow stays with the market.

The oracle keeps each report it has verified for a short time. If the same report arrives again in that time, the oracle skips the signature check and still runs every check above. A report whose signing configuration is retired in that time can therefore still price a call. It can do so only while it is fresh enough for that call, which is at most the wider age limit after its observation time.

## Two age limits set how fresh a report must be

A fill of your trade order or your vault order uses the strict limit. A liquidation, an [auto-deleveraging](../trading/adl.md) close, and a borrowing and funding update use the wider limit. A keeper picks when to fill an order, so the strict limit keeps the price close to the market. A liquidation protects the vault, and closing at an older price beats not closing at all, so it accepts an older report. Both limits are settings of the oracle, and every market that oracle serves shares them.

The owner of the oracle sets the strict limit between 3 and 15 seconds. The wider limit is never shorter than the strict one, and it is at most 120 seconds. Refer to [Market parameters](./market-parameters.md) for the two limits a market runs today.

**A gap in the stream stops fills before it stops liquidations.** While the newest report is older than the strict limit and younger than the wider one, a liquidation still runs on a report too old to fill an order of yours. Once the newest report passes the wider limit, liquidations stop as well.

## A price cannot run backward for your order or your position

The price that fills your order must be at least as fresh as the order itself. A keeper cannot reach back for a report the stream observed before you signed and fill you at it. A report observed at the moment you created the order is fresh enough.

One exception exists for a market order that the app creates and fills in the same ledger. The [Orders](../trading/orders.md) page defines a ledger. The app must fetch the report before it submits that transaction, so the report always predates the order. Such a fill can use a report observed before you created the order, as long as it still meets the strict age limit. A vault deposit or redeem never gets this exception. It fills in a later ledger than the one that created it.

A second rule protects an open position. A fill, a liquidation, or an auto-deleveraging close is refused if its price is older than the price that last priced your position. A keeper cannot walk your position back to an older report.

## The market uses the newest price it has seen

The market remembers the newest verified price it has used. A liquidation, an auto-deleveraging close, a borrowing and funding update, and a vault fill run at the newer of two prices. One is the report the keeper submitted. The other is the remembered price. A keeper therefore cannot choose an older price inside the wider age limit. A fill of your trade order runs at the submitted report itself. Its trigger price and its bound are judged on the price the keeper chose.

## The oracle narrows the bid and the ask

The bid is the price the stream puts on a sale, and the ask is the price it puts on a purchase. The distance between them is the spread. The oracle pulls both sides toward the middle by the same amount before the market uses them. The quote stays centered, and a fixed share of the spread is taken out of it. That share decides how much of the stream's spread your fills pay.

The share is one setting of the oracle, and every market the oracle serves uses it. At 0% the report's own quote stands, and you meet the full spread. At 100% both sides land on the middle, and you pay no spread. Each side moves by a whole price unit rounded down, so the narrowing never goes further than the share says. The owner of the oracle can change the share. Refer to [Market parameters](./market-parameters.md) for the share a market runs today. The rest of this page refers to the narrowed quote.

## Your fill takes the side of the quote that works against you

You enter on one side of the quote and you leave on the other.

| What your fill does | Side it uses |
| --- | --- |
| Opens a long or adds to one | The ask |
| Closes a long or reduces one | The bid |
| Opens a short or adds to one | The bid |
| Closes a short or reduces one | The ask |

A liquidation and an auto-deleveraging close take the same side as a close you run yourself. The trigger price and the price bound of your order are tested against the side the fill would take. Refer to [Orders](../trading/orders.md) for both. The spread is therefore a real cost on every round trip. Your open position is valued at the side a close would use, so it shows a small loss from the moment it opens. Refer to [Profit and loss](../trading/pnl.md) for how that value reaches your equity.

## A delisted market can price at one flat number

The owner of a delisted market can fix one flat settlement price on it. From that moment the market ignores the report a keeper submits. It prices every fill, liquidation, auto-deleveraging close, borrowing and funding update, and vault fill at that one value. Bid and ask are the same number, so the spread is gone. The owner can replace the price while the market stays delisted. Refer to [Market status](./status.md) for the wind-down and the point in it at which the price can be set.
