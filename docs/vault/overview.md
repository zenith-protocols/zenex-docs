---
sidebar_position: 1
title: Overview
---

# Vault Overview

The Zenex **vault** is a liquidity pool that serves as the counterparty to every trade on the platform. Liquidity providers deposit collateral (e.g., USDC) into the vault, and traders borrow against that collateral to open leveraged positions. In return, depositors earn yield from [trading fees](../trading/fees.md), [borrowing interest](../trading/borrowing-interest.md), and trader losses.

### How It Works

When a trader opens a position, they effectively borrow from the vault. When they close, the vault settles the PnL: losing trades return collateral to the vault, while winning trades are paid out from it. This means the vault's value fluctuates based on aggregate trader performance. When traders lose, depositors profit, and vice versa.

### The Vault Token

Depositing into the vault mints **vault shares**, a fungible token that represents your proportional ownership of the vault's total assets. The **share price** changes dynamically as the vault earns fees or pays out profitable trades:

$$
sharePrice = \frac{totalAssets}{totalShares}
$$

If the vault earns yield over time, the share price increases, meaning each share is redeemable for more underlying tokens than originally deposited. Conversely, if traders are net profitable, the share price can decrease.

### Risks

Vault depositors take on **counterparty risk**. The vault can lose value during periods where traders are net profitable. The protocol includes several mechanisms to mitigate this risk, including dynamic interest rates, price impact fees, and max utilization limits. For a full breakdown, see [Risks & Rewards](./risks-and-rewards.md).

### Getting Started

To learn how to deposit into and withdraw from a vault, see [Depositing & Withdrawing](./depositing.md).
