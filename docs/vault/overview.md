---
sidebar_position: 1
title: Overview
---

# Vault Overview

The Zenex **strategy vault** is the liquidity pool that acts as the counterparty to every trade in its market. Liquidity providers deposit the market's collateral token (e.g., USDC), and traders take leveraged positions against that liquidity. In return, depositors earn yield from [trading fees](../trading/fees.md), [borrowing interest](../trading/borrowing-interest.md), and net trader losses.

Each market has exactly one vault. The factory deploys the vault together with its trading contract as an isolated pair, and the trading contract is registered as the vault's immutable strategy. Your deposit therefore backs exactly one market and is exposed only to that market's traders.

### How It Works

When a trader opens a position, the vault reserves capacity to cover their potential profit. When the position closes, the vault settles the PnL: losing trades add collateral to the vault, winning trades are paid out from it. The vault's value therefore rises and falls with aggregate trader performance. When traders lose, depositors profit. When traders win, depositors pay.

### The Vault Token

Depositing mints **vault shares**, a fungible token representing your proportional claim on the vault's total assets. Share value is the vault's total assets divided by the total shares outstanding, and it moves only when value actually settles into or out of the vault: trading fees, borrowing interest, and realized trader PnL. The unrealized profit or loss of open positions is not yet in the share price. That gap is why the protocol gates deposits and redeems while pending PnL is large (see [Risks & Rewards](./risks-and-rewards.md)).

For example, say a vault holds 1,040,000 USDC and has 1,000,000 shares outstanding. Each share is worth 1,040,000 / 1,000,000 = 1.04 USDC. If a trader then closes a position at a 40,000 USDC loss, that collateral settles into the vault and each share is worth 1,080,000 / 1,000,000 = 1.08 USDC.

If the vault earns fees and interest over time, share value rises and each share redeems for more underlying tokens than it cost. When traders close in profit, the vault pays out and share value falls.

### Deposits and Redeems Are Orders

Deposits and redeems on Zenex happen through **vault orders**. When you deposit, your assets are escrowed inside the trading contract at creation. When you redeem, your shares are escrowed instead. A permissionless [keeper](../keepers/overview.md) then fills the order, minting or burning shares net of the vault fill fee.

Routing through the trading contract lets the protocol measure the market's pending trader PnL at the same verified price the market trades at, and apply the protective gates that stop deposits and redeems from being timed while share value has not yet caught up with that pending PnL. The keeper's verified price feeds those gates rather than setting the share conversion rate. See [Depositing & Withdrawing](./depositing.md) for the full flow.

### Risks

Vault depositors take on **counterparty risk**. The vault loses value while traders are net profitable. The protocol includes several mechanisms to bound this risk, including the skew-split trade fee, price impact fees, the funding rate, utilization caps, a realized-profit haircut, and auto-deleveraging. For a full breakdown, see [Risks & Rewards](./risks-and-rewards.md).

### Getting Started

To learn how to deposit into and redeem from a vault, see [Depositing & Withdrawing](./depositing.md).
