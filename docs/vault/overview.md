---
sidebar_position: 1
title: Overview
---

# Vault Overview

The Zenex **strategy vault** is the liquidity pool that acts as the counterparty to every trade in its market. Liquidity providers deposit the market's collateral token (e.g., USDC), and traders take leveraged positions against that liquidity. In return, depositors earn yield from [trading fees](../trading/fees.md), [borrowing interest](../trading/borrowing-interest.md), and net trader losses.

Each market has exactly one vault. The factory deploys the vault together with its trading contract as an isolated pair, and the trading contract is registered as the vault's immutable strategy. There is no global, multi-market vault: your deposit backs one market and is exposed only to that market's traders.

### How It Works

When a trader opens a position, the vault reserves capacity to cover their potential profit. When the position closes, the vault settles the PnL: losing trades add collateral to the vault, winning trades are paid out from it. The vault's value therefore rises and falls with aggregate trader performance. When traders lose, depositors profit. When traders win, depositors pay.

### The Vault Token

Depositing mints **vault shares**, a fungible token representing your proportional claim on the vault's total assets. Share value tracks the vault's assets net of pending trader PnL, so it already reflects the unrealized profit or loss of open positions rather than only settled balances:

$$
sharePrice = \frac{totalAssets - pendingTraderPnl}{totalShares}
$$

If the vault earns fees and interest over time, share value rises and each share redeems for more underlying tokens than it cost. If traders are collectively in profit, share value falls.

### Deposits and Redeems Are Orders

This is the key change in v2: deposits and redeems are **vault orders**, not instant transfers. When you deposit, your assets are escrowed inside the trading contract at creation; when you redeem, your shares are escrowed. A permissionless [keeper](../keepers/overview.md) then fills the order at a verified oracle price, minting or burning shares net of the vault fill fee.

Routing through the trading contract lets the protocol price your entry or exit against the same verified price the market trades at, and apply the protective gates that stop deposits and redeems from being timed against a stale share value. See [Depositing & Withdrawing](./depositing.md) for the full flow.

### Risks

Vault depositors take on **counterparty risk**. The vault loses value while traders are net profitable. The protocol includes several mechanisms to bound this risk, including the skew-split trade fee, price impact fees, the funding rate, utilization caps, a realized-profit haircut, and auto-deleveraging. For a full breakdown, see [Risks & Rewards](./risks-and-rewards.md).

### Getting Started

To learn how to deposit into and redeem from a vault, see [Depositing & Withdrawing](./depositing.md).
