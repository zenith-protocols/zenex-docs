---
title: Claimable credit
sidebar_position: 8
---

# Claimable credit

Claimable credit is money a market owes you and holds for you. It waits in one balance in your name until you take it. A claim is a call you sign yourself, and your own signature is all it needs.

## What fills the balance

Two sources fill the same credit balance. The first is the funding you earn. A settlement covers the whole span since the last one, and it banks one net amount. If that net is earned, it goes to your credit balance. If it is owed, your position pays it and the balance does not move. A fill, a close, and a liquidation all settle the position. The credit stays apart from your collateral, so it does not change how close your position sits to liquidation. For which side pays and which side earns, see [Funding rate](./funding-rate.md).

The second source is a payout the market could not send. A close, a partial decrease, a liquidation, an auto-deleveraging fill, and a vault redemption all pay you in the market's settlement token. If that transfer fails, for example after you remove your trustline for the token, the market keeps the amount and parks it in your credit balance. The rest of the fill still completes, and nothing else about it changes.

## What a claim pays

A claim pays the smaller of two amounts: your credit balance, and what the market's credit pool holds at that moment. The pool holds the funding that paying positions have settled, and every payout the market parked. The market sends the amount to the account that signs the claim.

If the pool holds less than your credit balance, you receive what the pool has and the rest stays claimable. A shortfall opens when you earn funding before the paying side settles its share. One pool backs every trader in the market, so a claim by another trader can leave less in it for you today. If the pool is empty, or your balance is empty, the claim fails and nothing moves.

**A wait does not shrink the amount you can claim.** A claim costs no protocol fee, and your credit balance holds its value over time. What the pool cannot cover today stays in your name. Later funding and later parked payouts refill the pool, and each claim you make is capped by the pool at that moment.

## When a claim runs

A frozen market refuses a claim. Your balance stays as it is, and you can reach it again once the market owner lifts the freeze. Every other state allows a claim, and a retired market pays one like any other. For the states a market moves through, see [Market status](../markets/status.md).

## A balance left untouched

Your credit balance holds its place in the ledger on a lease. Every change to the balance renews the lease, whether new credit arrives or you claim. A balance that sits untouched for about four months loses its lease, and the ledger archives the record.

A claim on an archived balance restores the record first, and the account that sends the claim pays the network fee for that restore. The record comes back exactly as it was, so nothing is lost and the full amount stays claimable.
