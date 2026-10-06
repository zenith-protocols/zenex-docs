---
title: Fees
description: Understand charges at creation, execution, while holding, and on submission.
---

# Fees

A trade has costs at several stages. Order execution fees and transaction fees are separate from the fees settled against a position.

## What you pay and when

| Charge | When it applies | What pays it |
| --- | --- | --- |
| Trade fee | A fill moves size, including a close. | Posted collateral or the settled close. |
| Impact fee | A fill moves size. Larger fills pay more. | Posted collateral or the settled close. |
| Execution fee | Each order escrows it at creation and pays it to the keeper at execution. | Available settlement tokens in your wallet. |
| Borrowing interest | Accrues while your side pays for reserved liquidity. | Position settlement. |
| Funding | Accrues while your side is the paying side. | Position settlement. |
| Liquidation fee | A keeper liquidates the position. | Equity remaining after closing costs. |
| Vault fee | A deposit or redeem fills. | The assets the vault order moves. |
| Transaction fee | You submit an action. | XLM for a wallet transaction, or a token fee for a relayed action. |

A margin-only fill pays no size-based trade or impact fee. It still settles accrued costs and consumes its order's execution fee.

## Trade and impact fees

The trade fee has two rates. The lower rate applies to exposure that reduces the market's imbalance. The higher rate applies to exposure that increases it. One fill can cross balance and pay both rates on different portions. The impact fee grows faster than fill size until it reaches its rate cap. A large close can therefore cost more than its preview implied if the size changes.

On an increase, costs reduce the margin you post. On a decrease, realized profit pays costs first, then margin pays the remainder.

:::info The fill sets the final costs
The app accounts for estimated trading fees. Other trades can change the market's imbalance and the fee rate before your order fills. A higher fee leaves less collateral and higher leverage than previewed. A lower fee leaves more collateral and lower leverage. Your price bound protects the execution price. It does not fix these fee amounts.
:::

## Execution fees and refunds

Each order records its execution fee at creation. Take-profit and stop-loss orders each have their own fee.

| Outcome | Execution fee |
| --- | --- |
| Trade order fills | Paid to the keeper. |
| Resting order is cancelled | Refunded with escrow. |
| Order expires | Remains escrowed until cancellation. |
| Vault order is rejected below minimum received | Paid to the keeper. |
| Whole transaction reverts | Its escrow and contract changes revert. |

A liquidation or auto-deleveraging action consumes no order and has no execution fee. Liquidation has its separate penalty.

## Transaction fees

A directly submitted wallet transaction pays the Stellar network in XLM. A relayed action pays the signed recipient in the configured token, up to your signed cap. The forwarder can charge that fee when creation succeeds but a fill remains pending. Read [What you sign](../account/signing.md) for fee caps and forwarding. Read [Pending and failed transactions](../account/transactions.md) for uncertain results.

:::warning Cancellation still costs a transaction fee
Cancelling returns the order's escrow. It does not refund the transaction fees already spent. A failed wallet transaction can also consume its XLM network fee.
:::

## Where charges go

The keeper and treasury receive shares of trade, impact, liquidation, and vault fees. The vault keeps the remainder. Borrowing interest goes to the treasury and vault. Funding stays reserved for traders on the earning side. The relay fee goes to its signed recipient. Current rates are on [Deployments](../deployments.md). Ongoing costs are explained in [Funding rate](./funding-rate.md) and [Borrowing interest](./borrowing-interest.md).
