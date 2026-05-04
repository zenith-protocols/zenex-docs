---
sidebar_position: 1
title: Overview
---

# Markets Overview

A **market** on Zenex represents a specific asset (e.g. BTC, XLM) that can be traded. Prices are denominated in the vault's collateral token, so if the vault uses USDC, all positions and PnL are settled in USDC. Each market has its own configuration and risk parameters.

### Market Configuration

Every market is defined by a set of [configurable parameters](./market-parameters.md) that govern its behavior. These include the initial margin requirement (`margin`) which determines the maximum leverage, the liquidation threshold (`liq_fee`), the price impact fee divisor (`impact`), a per-market utilization cap (`max_util`), and a per-market variable borrowing rate (`r_var_market`).

These parameters vary per asset to reflect differences in liquidity and volatility. The current settings for all assets can be found on the [Supported Assets](./supported-assets.md) page.

### Oracle Price Feeds

Each market is linked to an **oracle** that provides real-time price data. The oracle price is used for position execution, PnL calculations, and liquidation checks.

### Open Interest

Markets track **open interest**, the total notional value of all open positions, separately for longs and shorts. This long/short breakdown is critical because it drives both the [funding rate](../trading/funding-rate.md) and the [borrowing interest](../trading/borrowing-interest.md). When one side dominates, funding rates adjust to incentivize balance. Borrowing interest also increases with utilization, discouraging excessive concentration and reducing directional risk for the vault.

### Supported Assets

Zenex currently supports a select set of assets, and that list will expand over time. Anyone can also deploy additional vaults via the factory contract, and those external deployments may list other asset classes. Each asset has tailored parameter settings based on its liquidity profile. See [Supported Assets](./supported-assets.md) for full details.

### Adding New Markets

New markets can only be created by the **contract owner**. Market parameters are configurable and can be adjusted over time, ensuring the protocol can adapt to changing market conditions and community needs.
