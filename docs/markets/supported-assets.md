---
sidebar_position: 2
title: Supported Assets
---

# Supported Assets

The parameter settings for each asset are summarized below. Note that these settings can be subject to change through governance over time.

## Per-Market Parameters

Each market has its own `MarketConfig` with the following per-asset settings:

| Asset | Impact Scalar | Margin | Liq Fee | r_var_market |
|-------|---------------|--------|---------|-------------|
| **XLM** | 700,000,000 | 1% (100x) | 0.5% | Configurable |
| **BTC** | 8,000,000,000 | 1% (100x) | 0.5% | Configurable |
| **ETH** | 5,000,000,000 | 1% (100x) | 0.5% | Configurable |

## Global Parameters

These apply to all markets (set in `TradingConfig`):

| Parameter | Value | Description |
|-----------|-------|-------------|
| `fee_dom` | 0.06% | Base fee for dominant side |
| `fee_non_dom` | 0.04% | Base fee for non-dominant side |
| `r_funding` | Configurable | Base hourly funding rate |
| `r_base` | Configurable | Base hourly borrowing rate |
| `r_var` | Configurable | Vault-level variable borrowing rate |
