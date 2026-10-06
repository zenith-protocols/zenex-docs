---
title: Claimable credit
description: Collect earned funding and payouts held in your name.
---

# Claimable credit

Claimable credit is a market balance in your name. It holds earned funding and payouts the market could not send to your wallet. Each market has its own balance. A claim pays the account that authorizes it.

## What adds credit

Earned funding becomes credit when the position settles. It does not add to margin or equity. A close, redeem, or other keeper payout can also become credit if the transfer fails. For example, a classic account may have removed its token trustline. The fill still completes. The market holds the failed payout for a later claim.

## Make a claim

A claim pays at most what the market's credit pool holds. Check the balance for the right market, confirm your wallet can receive the settlement token, and submit a claim. An empty balance or pool refuses the claim. A transfer failure reverts the claim and preserves the balance. The protocol takes no claim fee. The submission still costs a [transaction fee](./fees.md#transaction-fees).

:::info A claim can be partial
Any unpaid remainder stays in your name. Earned funding can be recorded before the paying positions settle enough funds into that pool.
:::

## When credit waits

A frozen market blocks claims until its owner lifts the freeze. Every other market state accepts them. An untouched credit entry can be archived by Stellar. A later claim restores it first, which can increase the transaction fee. Archival does not erase the balance. For market availability, use [Market status](../markets/status.md).
