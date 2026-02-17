---
sidebar_position: 7
title: FAQ
---

# Frequently Asked Questions

### What is Zenex?

Zenex is a decentralized perpetual futures exchange built on Stellar Soroban. It allows traders to open long and short leveraged positions on crypto assets without intermediaries, expiry dates, or centralized custody of funds.

### What blockchain is Zenex built on?

Zenex is built on **Stellar Soroban**, Stellar's smart contract platform. Soroban provides fast finality, low transaction costs, and a robust execution environment for DeFi applications.

### What wallets are supported?

Zenex supports a wide range of Stellar-compatible wallets, including **Freighter**, **Ledger**, **xBull**, **Lobstr**, **Albedo**, **Hana**, and **Hot Wallet**. Additionally, Zenex supports **passkey-based smart wallets**, allowing you to sign in with biometrics without needing a browser extension.

### What is the maximum leverage?

The maximum leverage on Zenex is **100x**. Higher leverage amplifies both gains and losses, so it is important to manage your risk carefully. See [Leverage](./trading/leverage.md) for more details.

### What assets can I trade?

Zenex currently supports perpetual contracts for **BTC**, **XLM**, **SOL**, **ETH**, and **ADA**. Each asset has its own market parameters. See [Supported Assets](./markets/supported-assets.md) for the full list.

### What are the trading fees?

Trading fees consist of a **base fee** (initially 0.05%) and a **price impact fee** that scales with position size. The base fee is only applied to the dominant market side. For a detailed breakdown, see [Fees](./trading/fees.md).

### How does the vault work?

The vault is a liquidity pool where depositors provide **USDC** as collateral for the exchange. In return, depositors earn yield from trading fees, interest payments, and net trader losses. Depositing mints vault shares that represent your proportional ownership. See [Vault Overview](./vault/overview.md) for more details.

### Can I get liquidated?

Yes. A position is liquidated when its **equity falls below the maintenance margin**. Liquidation results in the loss of all collateral in the position. You can monitor your position health and add collateral to avoid liquidation. See [Liquidation](./trading/liquidation.md) for the full mechanics.

### What is the collateral token?

The collateral token is **USDC**. All positions are denominated and settled in USDC, and the vault accepts USDC deposits.

### Is Zenex audited?

Zenex is committed to security and transparency. For information on audit status and reports, see the [Audits](./audits.md) page.
