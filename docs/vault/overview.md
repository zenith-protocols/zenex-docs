---
sidebar_position: 1
title: Overview
---

# Vault Overview

The Zenex **strategy vault** is the liquidity pool that acts as the counterparty to every trade in its market. Liquidity providers deposit the market's collateral token (e.g., USDC), and traders take leveraged positions against that liquidity. In return, depositors earn yield from [trading fees](../trading/fees.md), [borrowing interest](../trading/borrowing-interest.md), and net trader losses.

Each market has exactly one vault. The factory deploys the vault together with its market contract as an isolated pair, and the market contract is registered as the vault's immutable strategy. Your deposit therefore backs exactly one market and is exposed only to that market's traders.

### How It Works

When a trader opens a position, the vault reserves capacity to cover their potential profit. When the position closes, the vault settles the PnL: losing trades add collateral to the vault, winning trades are paid out from it. The vault's value therefore rises and falls with aggregate trader performance. When traders lose, depositors profit. When traders win, depositors pay.

### The Vault Token

Depositing mints **vault shares**, a fungible token representing your proportional claim on the vault's assets. The resting share value is the vault's settled assets divided by shares outstanding, and it moves as fees, interest, and realized trader PnL settle. When you deposit or redeem, however, the conversion is priced against the vault's effective backing at the fill's verified price: its assets minus the unrealized profit currently owed to the market's open positions. Unrealized trader losses count the other way and raise the backing above the raw balance. Deposits mark that unrealized PnL conservatively against the depositor, and redeems conservatively against the redeemer, so neither can be timed to capture value from open positions (see [Share Value](./depositing.md#share-value)).

For example, say a vault holds 1,040,000 USDC and has 1,000,000 shares outstanding, so the resting share value is 1,040,000 / 1,000,000 = 1.04 USDC. If the market's open positions are collectively 40,000 USDC in profit, that is money the vault will owe when they close, so a deposit or redeem at that moment prices shares at (1,040,000 - 40,000) / 1,000,000 = 1.00 USDC. If the open positions are instead 40,000 USDC underwater, the vault stands to collect that amount and a fill prices shares at 1.08 USDC. Once a trader actually closes at a 40,000 USDC loss, the collateral settles into the vault and the resting share value itself rises to 1,080,000 / 1,000,000 = 1.08 USDC.

If the vault earns fees and interest over time, share value rises and each share redeems for more underlying tokens than it cost. When traders close in profit, the vault pays out and share value falls.

### Deposits and Redeems Are Orders

Deposits and redeems on Zenex happen through **vault orders**. When you deposit, your assets are escrowed inside the market contract at creation. When you redeem, your shares are escrowed instead. Along with the deposit assets or redeem shares, a small flat execution fee in the settlement token is escrowed to pay the keeper that fills the order, and cancelling the order refunds everything. A permissionless [keeper](../keepers/overview.md) then fills the order, with the vault fill fee taken from the deposit amount or the redeem proceeds.

Routing through the market contract lets the protocol measure the market's pending trader PnL at the same verified price the market trades at and price it directly into the share conversion: the measurement marks the backing up for a deposit and down for a redeem, always in the direction that protects existing depositors. Redeems additionally observe a cooldown and cannot leave the vault too exposed to open positions. See [Depositing & Withdrawing](./depositing.md) for the full flow.

### Risks

Vault depositors take on **counterparty risk**. The vault loses value while traders are net profitable. The protocol includes several mechanisms to bound this risk, including the skew-split trade fee, price impact fees, the funding rate, utilization caps, a realized-profit haircut, and auto-deleveraging. For a full breakdown, see [Risks & Rewards](./risks-and-rewards.md).

### Getting Started

To learn how to deposit into and redeem from a vault, see [Depositing & Withdrawing](./depositing.md).
