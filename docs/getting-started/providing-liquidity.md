---
title: Start providing liquidity
description: Make a first vault deposit and understand how you leave.
---

# Start providing liquidity

A vault deposit gives you shares in the liquidity behind one market. Your return depends on fees, trader results, and the value of those shares.

:::warning A vault deposit can lose value
The vault pays trader profits and absorbs bad debt. Fees are income, but they do not guarantee a positive return. Withdrawals need available liquidity and can remain blocked after the cooldown. See [Risks](../risks.md).
:::

## Make your first deposit

1. Open the [Zenex app](https://app.zenex.trade) and connect a wallet funded with the market's settlement token.
2. Open the market's **Vault** and choose **Deposit**.
3. Enter an amount and review the estimated shares, minimum received, and fees.
4. Review the transaction permissions, then sign.
5. Follow the vault order until it fills or is rejected.

The deposit amount and execution fee move into escrow when the creation transaction confirms. A keeper fills the order later and sends the shares to your wallet. The share estimate can change before that fill. Your minimum received bounds the result after the vault fee.

## Understand the exit before you deposit

The **Withdraw** action creates a redeem order for your shares. It serves a cooldown, then needs a keeper and sufficient available liquidity. Cancellation returns escrow while the market allows it. A frozen market blocks cancellations and withdrawals. Read [Deposits and withdrawals](../vault/depositing.md) for the full order flow. Read [Share value](../vault/share-value.md) for what changes your return.
