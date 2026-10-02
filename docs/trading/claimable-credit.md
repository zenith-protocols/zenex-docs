---
title: Claimable credit
sidebar_position: 8
---

# Claimable credit

Claimable credit is one balance in your name that a market holds for the funding you earn and for payouts it could not send you. You collect it with a claim. You sign the claim in your wallet, no keeper is involved, and the market pays the account that signed. You can read your balance at any time, and reading it changes nothing.

## Two sources fill the balance

**Funding you earn.** Each time your position changes, the market settles it. A settlement adds up the funding since the previous settlement into one net amount. An increase, a decrease, a close, a liquidation, and an auto-deleveraging fill all settle a position. If the net is earned, the market adds it to your credit balance. If the net is owed, your position pays it and the balance stays where it is. The balance sits apart from your collateral, so it does not move your liquidation price. For which side pays and which side earns, see [Funding rate](./funding-rate.md).

**Payouts the market could not send.** Several events pay you in the market's settlement token. They are a close, a partial decrease, a liquidation, an auto-deleveraging fill, a vault redeem, and the refund of a vault deposit that a keeper rejected because it fell under your minimum. Suppose the market cannot send that payout to your account. One cause is a dropped trustline, the Stellar setting that lets an account hold a token. The market then keeps the tokens and adds the amount to your credit balance. A fill that someone else submits therefore never stalls on your account. The rest of the fill completes as it would have.

## A claim pays what the credit pool holds

The credit pool is the reserve that one market keeps for claims. It holds the funding that paying positions have settled, plus every payout the market parked. One pool backs every trader because funding that one trader pays is funding that another earns, and the market holds it in one place until the receiver claims.

A claim pays the smaller of your credit balance and the pool at that moment. Any remainder stays in your balance. If the pool is empty or your balance is empty, the claim fails and nothing moves.

A shortfall opens when you earn funding before the paying side settles its share. Funding builds by the second, but a payer's share reaches the pool only when that payer's position next settles. A claim by another trader can also take from the pool first. Later settlements and later parked payouts refill it.

**A claim pays at most what the pool holds today.** The rest waits in your name, and each later claim faces the same cap at that moment. A claim carries no protocol fee. Like any transaction, it pays the network fee described in [Fees](./fees.md).

The claim also fails if the market cannot send the tokens to your account, for example after a dropped trustline. A claim payout has no parking step, so the whole claim reverts and your balance stays where it was.

## A frozen market refuses a claim

Your balance stays as it is until the owner of the market lifts the freeze. Every other state accepts a claim. On a retired market the pool backs every balance in full. For the states a market moves through, see [Market status](../markets/status.md).

## An untouched balance is archived after about 120 days

The network stores your balance for a limited time. Credit that arrives and a claim you make each renew that time, and a read does not. After about 120 days without either, the network archives the balance.

A claim on an archived balance restores it first. The restore adds to the network fee of that claim transaction. The balance returns exactly as it was, so the full amount stays claimable.
