---
sidebar_position: 1
title: Start Trading
---

# How to Start Trading

### Prerequisites

Before you begin, you need:

- A **Stellar wallet** or a **smart account**. You have two options:
  - **Browser wallet**: [Freighter](https://www.freighter.app/) is recommended for beginners. Zenex also supports Ledger, xBull, Lobstr, Albedo, Hana, and Hot Wallet.
  - **Smart account**: Create a **passkey-based smart account** directly from Zenex. No seed phrase, no extension. Just your device's biometrics (fingerprint, Face ID) or a security key.
- **USDC** in your account to use as collateral.

### Step 1: Connect or Create an Account

Click **Connect** in the bottom-left corner. From here you can either select an existing browser wallet, connect an existing passkey account, or **create a new smart account** using a passkey. No wallet extension needed.

### Session Keys: One-Click Trading

When using a smart account, each trade normally requires a passkey prompt (biometric confirmation). To streamline this, Zenex offers **session keys**: a temporary signing key that lets you trade with a single click for up to **4 hours**, without repeated passkey prompts.

To enable session keys, toggle **Session Key** after connecting your smart account. An ephemeral key is generated and authorized on your account. When the session expires, simply re-enable it. Session keys can only be used for trading actions and can be revoked at any time.

### Step 2: Select a Market

Choose the asset you want to trade like XLM and BTC.

### Step 3: Choose Your Direction

Select **Long** if you expect the price to go up, or **Short** if you expect it to go down.

### Step 4: Set Your Collateral and Leverage

Enter the amount of **USDC** you want to allocate as collateral and choose a **leverage** multiplier (up to 100x). Your notional position size equals collateral multiplied by leverage. For more details, see [Leverage](../trading/leverage.md) and [Collateral](../trading/collateral.md).

### Step 5: Set Entry Price

Choose your order type. A **market order** executes at the current oracle price. A **limit order** lets you specify the exact price at which you want to enter.

### Step 6: Set Stop-Loss and Take-Profit (Optional)

Add **stop-loss** and **take-profit** triggers to automate your risk management. A stop-loss closes your position if the price moves against you beyond a threshold, while a take-profit locks in gains at a target price. See [Liquidation](../trading/liquidation.md) for more on how positions are protected.

### Step 7: Review and Submit

Review your position details: direction, collateral, leverage, entry price, and any triggers. When everything looks correct, click **Submit** and sign the transaction in your wallet.

### Managing Your Position

Once your position is open, you can modify it at any time: add or remove [collateral](../trading/collateral.md), update your stop-loss and take-profit triggers, or close the position entirely. See [PnL Calculations](../trading/pnl.md) to understand how your profit and loss are computed, and [Fees](../trading/fees.md) for applicable trading costs.
