---
title: Wallets and funds
description: Understand connected wallets, trading addresses, and available balances.
---

# Wallets and funds

The connected wallet owns your orders, positions, vault shares, and claimable credit. Check the active account before every transfer or trade.

## Choose a wallet

The app supports browser wallets and passkey smart wallets. Available submission modes depend on the wallet's signing capabilities.

| Mode | What you approve | Transaction fee |
| --- | --- | --- |
| Browser direct | A complete transaction in your browser wallet. | XLM from the transaction source. |
| Relay | Contract permissions for the relayer to submit. | The configured fee token, within your signed cap. |
| Relay + One-Click | A session permission first, then local signatures for eligible actions. | Relayed token fees. |

Passkey wallets use contract permissions and a separate submitter. One-click trading is available for supported passkey wallets. See [What you sign](./signing.md) and [One-click trading](./one-click-trading.md).

## Fund the trading address

A passkey smart wallet has its own trading address. Use the account's receive details in the app. Confirm the network, address, token, and issuer before you send funds. Any buy or transfer service shown in the app has its own availability and terms. Follow its receive instructions.

The market's settlement token pays margin and market fees. Relayed actions also need enough of the configured fee token to cover their fee cap. Classic Stellar accounts need the appropriate token trustline and sufficient XLM reserves. A wallet transaction also needs XLM for its network fee.

:::warning Use the address shown for your active wallet
Funds sent to a different wallet address do not fund its trades. Mainnet and testnet balances are separate. A token with the same name can also have a different issuer.
:::

## Know where your balance sits

| Balance | Where it sits | How it returns |
| --- | --- | --- |
| Available wallet funds | Your wallet. | Transfer from the wallet. |
| Order escrow | The market while an order rests. | Cancellation, or settlement at the fill. |
| Position margin | Behind your open position. | A decrease or close that passes the market's checks. |
| Vault shares | Your wallet, or escrow for a redeem. | Redeem shares through a vault order. |
| Claimable credit | A separate market balance in your name. | Submit a claim. |

The wallet's send action transfers available funds. It does not withdraw margin or redeem shares. For funds held by the market, use [Orders](../trading/orders.md), [Positions](../trading/positions.md), [Deposits and withdrawals](../vault/depositing.md), or [Claimable credit](../trading/claimable-credit.md).
