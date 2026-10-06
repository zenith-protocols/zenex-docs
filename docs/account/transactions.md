---
title: Pending and failed transactions
description: Follow submission, confirmation, and order execution without duplicating an action.
---

# Pending and failed transactions

A transaction changes the chain only when it confirms successfully. An order can remain unfilled after that confirmation.

## Read the result at the right stage

| Stage | What it means | What to check |
| --- | --- | --- |
| Prepared | The app simulated a proposed action. | Review terms and fees before signing. |
| Signed | You approved permissions or a transaction. | Submission still needs to happen. |
| Submitted | The service or network accepted the request. | Wait for the transaction's final result. |
| Confirmed | The transaction succeeded on chain. | Check which actions committed. |
| Order resting | The order exists and holds its escrow. | Check its trigger, bounds, expiry, and market status. |
| Filled | The market executed the order. | Check the resulting position, shares, or payout. |

A simulation is an estimate at one moment. Prices, liquidity, fees, and market status can change before execution.

## A confirmed transaction can leave an order resting

The router can attempt a fill after it creates the order. A recoverable fill failure can leave creation successful. Your order then waits on chain. Its escrow remains held. The relay fee for the successful creation transaction can remain charged. The app can also use a strict create-and-fill flow. If that fill fails, the entire transaction reverts and no order is created.

## Recover from an uncertain result

A timeout or lost response does not prove failure.

1. Refresh Orders, Positions, and wallet balances.
2. Check the transaction hash in the explorer, when one is available.
3. Allow account history time to catch up with the chain.
4. Retry only after you know which action remains incomplete.

A confirmed resting order needs a later fill or cancellation. Submitting another creation does not repair it.

:::warning Check before you sign a replacement
The transaction may already be submitted or confirmed. Signing another order can create duplicate exposure.
:::

## Understand common failures

| Symptom | Likely next check |
| --- | --- |
| Wallet refuses the signature | Confirm the network, active account, and supported signing mode. |
| Permission expired | Prepare a fresh request and review its new terms. |
| Insufficient funds | Check the fee cap, execution fees, collateral, and token trustline. |
| Fill refused | Check price bounds, margin, liquidity, market status, and any decrease lock. |
| Cancellation refused | Check whether the market is frozen. |
| Order expired | Cancel it to return escrow when cancellation is allowed. |
| Relay unavailable | Keep checking an existing submission before creating another request. |

## Know which fees remain

A reverted relayed transaction reverses its token fee and contract changes. The relayer still bears its own Stellar network cost. A directly submitted wallet transaction can consume an XLM network fee even when execution fails.

A cancelled order refunds its execution fee and remaining escrow. The fee for the cancellation transaction remains spent. For all charges, use [Fees](../trading/fees.md).
