---
sidebar_position: 1
title: Overview
---

# Markets Overview

A **market** on Zenex represents a specific asset (e.g. BTC, XLM) that can be traded. Prices are denominated in the vault's collateral token, so if the vault uses USDC, all positions and PnL are settled in USDC. Each market has its own configuration and risk parameters.

### Market Configuration

Every market is defined by a set of [configurable parameters](./market-parameters.md) that govern its behavior:

- **Fee settings**: Base fee rate and price impact scalar, determining trading costs.
- **Margin requirements**: Initial margin and maintenance margin, controlling maximum leverage and liquidation thresholds.
- **Interest rates**: Base hourly borrowing rate, dynamically adjusted based on market conditions.
- **Collateral limits**: Minimum and maximum collateral per position, plus maximum payout ratio.

These parameters vary per asset to reflect differences in liquidity and volatility. The current settings for all assets can be found on the [Supported Assets](./supported-assets.md) page.

### Oracle Price Feeds

Each market is linked to an **oracle** that provides real-time price data. The oracle price is used for position execution, PnL calculations, and liquidation checks.

### Open Interest

Markets track **open interest**, the total notional value of all open positions, separately for longs and shorts. This long/short breakdown is critical because it drives the dynamic [interest rate](../trading/interest.md) mechanism: when one side dominates, rates adjust to incentivize balance and reduce directional risk for the vault.

### Supported Assets

Zenex currently supports a select assets but that will expand over time, also with non-zenex vaults you can see other asset classes be added. Each asset has tailored parameter settings based on its liquidity profile. See [Supported Assets](./supported-assets.md) for full details.

### Adding New Markets

New markets can only be created by the **contract owner**. Market parameters are configurable and can be adjusted over time, ensuring the protocol can adapt to changing market conditions and community needs.
