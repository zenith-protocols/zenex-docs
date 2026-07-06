---
sidebar_position: 9
title: FAQ
---

# Frequently Asked Questions

### What is Zenex?

Zenex is a decentralized perpetual futures exchange built on Stellar Soroban. It lets traders open long and short leveraged positions on assets without intermediaries, expiry dates, or centralized custody of funds.

### What blockchain is Zenex built on?

Zenex is built on **Stellar Soroban**, Stellar's smart contract platform. Soroban provides fast finality, low transaction costs, and a robust execution environment for DeFi applications. The current deployment runs on **Stellar testnet**: trading uses test tokens, and the app guides new users through Stellar friendbot funding plus a built-in USDC faucet.

### How does a trade get executed?

You **create an order** signed by you, and a permissionless **keeper** fills it at a price it verifies against the market's oracle feed. Your order is price-free but sets the bounds a keeper must respect: a size, a slippage price bound, an expiration, and, for stop-loss and take-profit, a trigger price. Your collateral is pulled from a token allowance at the moment of the fill. A market order is one you expect a keeper to fill right away; a limit or trigger order rests until its price condition is met. See [Start Trading](./getting-started/start-trading.md).

### Can anyone run a keeper?

Yes. Keepers are permissionless: anyone can fill orders, run liquidations, and keep a market's accounting current, and they earn a fee for doing so. A keeper can only act within the limits your signed order allows and at a price verified against the oracle, so it cannot trade against you on its own terms. You can even fill your own order, in which case the keeper reward routes back to you.

### What wallets are supported?

Zenex supports several sign-in methods:

- **Social login** (Google, X, or Discord) via Privy, which creates a smart account in one click, no extension or seed phrase required. This is the first option in the Connect dialog.
- **Passkey-based smart wallets**: sign in with biometrics (Face ID, fingerprint, or a security key) directly from the browser, no extension needed.
- **Browser wallets**: **xBull**, **Freighter**, **Lobstr**, **Albedo**, **Hana**, **Ledger**, and **Hot Wallet**.
- **Ed25519 key import** (advanced): bring your own keypair.

### What is the maximum leverage?

Maximum leverage is set per market by governance and equals one divided by that market's initial margin requirement. Higher leverage amplifies both gains and losses, so it is important to manage your risk carefully. See [Leverage](./trading/leverage.md) for more details.

### What are the trading fees?

A fill pays a **trade fee** that is split by its effect on market balance: the side that worsens the long/short imbalance pays a higher rate, and the side that improves it pays a lower one. A **price impact fee** applies to the part of a trade that pushes the book further out of balance. Positions also accrue **borrowing interest** over time following a kink curve, and longs and shorts exchange a **funding rate** based on market imbalance. Fee rates are set per market by governance. For a detailed breakdown, see [Fees](./trading/fees.md).

### How do I receive funding I have earned?

Funding is held in an internal pool with a per-user claimable balance. When you are on the side that earns funding, it accrues to your claimable balance and you **claim** it when you want it, rather than it being credited to your position automatically.

### How does the vault work?

Each market has its own strategy vault, a liquidity pool that backs that market's trades and stands as the counterparty to every position. Depositors earn yield from trading fees, borrowing interest, and net trader losses. Deposits and redeems are routed through the trading contract as vault orders: they escrow first and a keeper fills them, minting or burning shares net of the vault fee. See [Vault Overview](./vault/overview.md) for more details.

### Can I get liquidated?

Yes. A position becomes liquidatable when its **equity falls below the maintenance margin**, a per-market parameter set by governance. A keeper then closes the whole position. If enough equity remains to cover the liquidation fee, the leftover is returned to you (a soft liquidation); if not, the liquidation fee is charged and the remainder is forfeited to the vault (a hard liquidation). You can monitor your position health and add collateral to avoid liquidation. See [Liquidation](./trading/liquidation.md) for the full mechanics.

### What is the collateral token?

Each market has its own **settlement token**, chosen at deployment. All positions in a market are collateralized, denominated, and settled in that token. The initial Zenex markets settle in USDC, but the protocol supports any Stellar token as a market's settlement token.

### Is Zenex audited?

Zenex is committed to security and transparency. For information on audit status and reports, see the [Audits](./audits.md) page.
