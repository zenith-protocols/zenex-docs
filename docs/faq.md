---
sidebar_position: 9
title: FAQ
---

# Frequently Asked Questions

### What is Zenex?

Zenex is a decentralized perpetual futures exchange built on Stellar Soroban. It allows traders to open long and short leveraged positions on assets without intermediaries, expiry dates, or centralized custody of funds.

### What blockchain is Zenex built on?

Zenex is built on **Stellar Soroban**, Stellar's smart contract platform. Soroban provides fast finality, low transaction costs, and a robust execution environment for DeFi applications. The current deployment runs on **Stellar testnet** — trading uses test tokens, and the app guides new users through Stellar friendbot funding plus a built-in USDC faucet.

### What wallets are supported?

Zenex supports several sign-in methods:

- **Social login** (Google, X, or Discord) via Privy — creates a smart account in one click, no extension or seed phrase required. This is the first option in the Connect dialog.
- **Passkey-based smart wallets** — sign in with biometrics (Face ID, fingerprint, or a security key) directly from the browser, no extension needed.
- **Browser wallets**: **xBull**, **Freighter**, **Lobstr**, **Albedo**, **Hana**, **Ledger**, and **Hot Wallet**.
- **Ed25519 key import** (advanced) — bring your own keypair.

### What is the maximum leverage?

The maximum leverage on Zenex is **100x**. Higher leverage amplifies both gains and losses, so it is important to manage your risk carefully. See [Leverage](./trading/leverage.md) for more details.

### What are the trading fees?

Trading fees consist of a **base fee** (0.04% for the non-dominant side, 0.06% for the dominant side) and a **price impact fee** that scales with position size and is charged on every open and close. Positions also accrue **borrowing interest** over time, and longs and shorts exchange a **funding rate** based on market imbalance. For a detailed breakdown, see [Fees](./trading/fees.md).

### How does the vault work?

The vault is a liquidity pool where depositors provide collateral for the exchange. In return, depositors earn yield from trading fees, borrowing interest, and net trader losses. Depositing mints vault shares that represent your proportional ownership. See [Vault Overview](./vault/overview.md) for more details.

### Can I get liquidated?

Yes. A position is liquidated when its **equity falls below the liquidation threshold** (`liq_fee`), a per-market configurable parameter. Liquidation results in the loss of all collateral in the position. You can monitor your position health and add collateral to avoid liquidation. See [Liquidation](./trading/liquidation.md) for the full mechanics.

### What is the collateral token?

The collateral token is determined by each vault. All positions within a vault are denominated and settled in that vault's collateral token. The first vault on Zenex uses USDC, but the protocol supports any Stellar token as collateral.

### Is Zenex audited?

Zenex is committed to security and transparency. For information on audit status and reports, see the [Audits](./audits.md) page.
