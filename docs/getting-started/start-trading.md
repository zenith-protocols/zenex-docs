---
sidebar_position: 2
title: Start Trading
---

# How to Start Trading

### Prerequisites

Zenex currently runs on **Stellar testnet**, so trading uses test tokens — no real funds are at risk. Before you begin, you need:

- A way to sign in. You have three options:
  - **Social login** (Google, X, or Discord) via Privy — creates a smart account in one click. No extension, no seed phrase. This is the first option in the Connect dialog.
  - **Smart account**: Create a **passkey-based smart account** directly from Zenex. No seed phrase, no extension. Just your device's biometrics (fingerprint, Face ID) or a security key.
  - **Browser wallet**: Zenex supports xBull, Freighter, Lobstr, Albedo, Hana, Ledger, and Hot Wallet. An advanced **Ed25519 key** import flow is also available.
- The vault's **collateral token** (USDC on testnet) in your account. New accounts are walked through funding automatically — see Step 2 below.

### Step 1: Connect or Create an Account

Click **Connect** in the top-right corner on desktop, or at the top of the page on mobile. From here you can sign in with a social login (Privy), connect an existing browser wallet, connect an existing passkey account, or **create a new smart account** using a passkey. No wallet extension needed.

### Step 2: Fund Your Testnet Account

Because Zenex is on testnet, the app shows a banner walking you through three free funding steps when needed:

1. **Fund the account** via Stellar's friendbot (creates the account on-chain).
2. **Add a USDC trustline** so your account can hold USDC.
3. **Claim test USDC** from the built-in faucet to use as collateral.

Click each banner action as it appears. Once your account holds USDC, you're ready to trade.

### Quick Trading: One-Click Trading

When using a smart account, each trade normally requires a passkey prompt (biometric confirmation). To streamline this, Zenex offers **Quick Trading** (a session key under the hood): a temporary signing key that lets you trade with a single click for up to **4 hours**, without repeated passkey prompts.

To enable it, click the **Quick Trading** (fish icon) button in the top bar after connecting your smart account, then click **Enable**. An ephemeral key is generated and authorized on your account. When the session expires, simply re-enable it. Quick Trading keys can only be used for trading actions and can be revoked at any time.

### Step 3: Select a Market

Choose the asset you want to trade — XLM, BTC, or ETH.

### Step 4: Choose Your Direction

Select **Long** if you expect the price to go up, or **Short** if you expect it to go down.

### Step 5: Set Your Collateral and Leverage

Enter the amount of collateral you want to allocate (the input is labeled **Amount**, denominated in USDC) and choose a **leverage** multiplier (up to 100x). Your notional position size equals collateral multiplied by leverage. For more details, see [Leverage](../trading/leverage.md) and [Collateral](../trading/collateral.md).

### Step 6: Set Entry Price

Choose your order type. A **market order** executes at the current oracle price. A **limit order** lets you specify the exact price at which you want to enter.

### Step 7: Set Stop-Loss and Take-Profit (Optional)

Add **stop-loss** and **take-profit** triggers to automate your risk management. A stop-loss closes your position if the price moves against you beyond a threshold, while a take-profit locks in gains at a target price. See [Liquidation](../trading/liquidation.md) for more on how positions are protected.

### Step 8: Review and Submit

Review your position details: direction, collateral, leverage, entry price, and any triggers. When everything looks correct, click **LONG/BUY** or **SHORT/SELL** (the action button matches the direction you chose), confirm in the order dialog, and sign the transaction in your wallet.

### Managing Your Position

Once your position is open, you can modify it at any time: add or remove [collateral](../trading/collateral.md), update your stop-loss and take-profit triggers, or close the position entirely. See [PnL Calculations](../trading/pnl.md) to understand how your profit and loss are computed, and [Fees](../trading/fees.md) for applicable trading costs.
