---
sidebar_position: 2
title: Start Trading
---

# How to Start Trading

### How Trading Works on Zenex

Before the steps, it helps to know what happens under the hood. On Zenex you **create an order** signed by you, and a permissionless **keeper** fills it at a price it verifies against the market's oracle feed. Your order is price-free: it carries the size and collateral you want, a **price bound** that caps the slippage you will accept, an **expiration**, and, for limit, stop-loss, and take-profit orders, a **trigger price**. A keeper can only fill within those limits. When you create an order, your collateral moves into the market contract as escrow, along with a small flat execution fee that pays the keeper who fills it. If a keeper fills the order, the escrowed collateral becomes your position's margin. If you cancel, the full escrow, fee included, is refunded.

The app presents all of this as a familiar trading form. The steps below map onto it.

### Prerequisites

Zenex currently runs on **Stellar testnet**, so trading uses test tokens and no real funds are at risk. Before you begin, you need:

- A way to sign in. You have two options:
  - **Smart account**: create a **passkey-based smart account** directly from Zenex. No seed phrase, no extension. Just your device's biometrics (fingerprint, Face ID) or a security key.
  - **Browser wallet**: Zenex supports xBull, Freighter, Lobstr, Albedo, Hana, Ledger, and Hot Wallet. An advanced **Ed25519 key** import flow is also available.
- The market's **settlement token** (USDC on testnet) in your account. New accounts are walked through funding automatically. See Step 2 below.

### Step 1: Connect or Create an Account

Click **Connect** in the top-right corner on desktop, or at the top of the page on mobile. From here you can connect an existing browser wallet, connect an existing passkey account, or **create a new smart account** using a passkey. No wallet extension needed.

### Step 2: Fund Your Testnet Account

Because Zenex is on testnet, the app shows a banner walking you through three free funding steps when needed:

1. **Fund the account** via Stellar's friendbot (creates the account on-chain).
2. **Add a USDC trustline** so your account can hold USDC.
3. **Claim test USDC** from the built-in faucet to use as collateral.

Click each banner action as it appears. Once your account holds USDC, you are ready to trade.

### Quick Trading: One-Click Trading

When using a smart account, each action normally requires a passkey prompt (biometric confirmation). To streamline this, Zenex offers **Quick Trading** (a session key under the hood): a temporary signing key that lets you create orders with a single click for up to **4 hours**, without repeated passkey prompts.

To enable it, click the **Quick Trading** (fish icon) button in the top bar after connecting your smart account, then click **Enable**. An ephemeral key is generated and authorized on your account. When the session expires, simply re-enable it. Quick Trading keys can only be used for trading actions and can be revoked at any time.

### Step 3: Select a Market

Choose the asset you want to trade: XLM, BTC, or ETH. Each market is its own contract with its own vault. All markets settle in USDC on testnet.

### Step 4: Choose Your Direction

Select **Long** if you expect the price to go up, or **Short** if you expect it to go down.

### Step 5: Set Your Collateral and Leverage

Enter the amount of collateral you want to allocate (the input is labeled **Amount**, denominated in USDC) and choose a **leverage** multiplier (up to the market's maximum). Your notional position size equals collateral multiplied by leverage. For more details, see [Margin and Leverage](../trading/margin-and-leverage.md) and [Collateral](../trading/collateral.md).

### Step 6: Choose Your Order Type

- A **market order** is an order you expect to fill right away: a keeper fills it at the current verified price, within the price bound you set. The app translates your slippage tolerance into that bound.
- A **limit order** carries a trigger price and rests until the market reaches it, at which point a keeper can fill it. A long limit fills at or below your price, a short limit at or above.

Either way, you also set an **expiration**. Your order stays fillable until it expires, after which a keeper can no longer fill it. You can cancel any of your orders at any time, before or after expiration, and cancelling refunds the escrowed collateral and fee.

### Step 7: Set Stop-Loss and Take-Profit (Optional)

Add **stop-loss** and **take-profit** orders to automate your risk management. Each is a closing order that carries a trigger price: a stop-loss closes your position once the price moves against you past a threshold, and a take-profit closes it once the price reaches your target. A keeper fills the trigger once the market crosses it. Each trigger order escrows the flat execution fee when you place it, refunded if the order is cancelled. See [Liquidation](../trading/liquidation.md) for more on how positions are protected.

### Step 8: Review and Submit

Review your order details: direction, collateral, leverage, order type and price, price bound, expiration, and any triggers. When everything looks correct, click **LONG/BUY** or **SHORT/SELL** (the action button matches the direction you chose), confirm in the order dialog, and sign the transaction. When you submit, your collateral and the execution fee are escrowed with the order, and cancelling refunds them in full. Your order is now live for a keeper to fill.

### Managing Your Position

Each position on Zenex is netted: you hold at most one long and one short per market, and every order adjusts that single position. Once your position is open you can:

- **Add or remove [collateral](../trading/collateral.md)** with a collateral-only order.
- **Reduce** the position with a partial closing order, or **close it fully** with a full-close order (the app submits a close for your entire size).
- **Update your stop-loss and take-profit** by cancelling the old trigger order and placing a new one. Trigger orders accumulate rather than replace each other, so an uncancelled old trigger stays live. When your position fully closes, any remaining trigger orders are cancelled automatically and their escrowed fees refunded.
- **Claim funding** you have earned. Funding you are owed accrues into a claimable balance that you can claim whenever you like.

See [PnL Calculations](../trading/pnl.md) for how profit and loss are computed, and [Fees](../trading/fees.md) for the applicable trading costs.
