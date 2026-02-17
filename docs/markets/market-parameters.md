---
sidebar_position: 3
title: Market Parameters
---

# Market Parameters

Each market on Zenex is defined by a set of parameters that control trading fees, leverage limits, risk thresholds, and interest behavior. These parameters can be adjusted by governance (DAO) and vary per asset. The current values for all supported assets can be found on the [Supported Assets](./supported-assets.md) page.

### Parameter Reference

| Parameter | Description | Example |
|-----------|-------------|---------|
| **Base Fee** | Trading fee rate applied when opening or closing a position. Only charged to the dominant market side (longs if longs > shorts, and vice versa). | 0.05% |
| **Price Impact Scalar** | Divisor used in the [price impact fee](../trading/fees.md) calculation. Higher values result in lower price impact. Varies by asset based on expected liquidity and trading volume. | 8,000,000,000 (BTC) |
| **Base Hourly Rate** | The base [interest rate](../trading/interest.md) charged per hour on open positions. Dynamically adjusted based on long/short imbalance. | 0.001% |
| **Initial Margin** | Minimum collateral-to-notional ratio required to open a position. Determines maximum [leverage](../trading/leverage.md) (e.g. 0.01 = 1% = 100x max leverage). | 0.01 |
| **Maintenance Margin** | Collateral ratio at which a position becomes eligible for [liquidation](../trading/liquidation.md). Always lower than the initial margin. | 0.005 |
| **Min Collateral** | Minimum collateral required to open a position. Prevents dust positions. | 10 USDC |
| **Max Collateral** | Maximum collateral allowed per position. Limits single-position exposure. | 100,000 USDC |
| **Max Payout** | Maximum payout ratio for a single position, protecting the vault from catastrophic losses on highly leveraged winning trades. | 9x |
| **Ratio Cap** | Maximum long/short imbalance ratio used in interest rate calculations. Caps the adjustment multiplier to prevent extreme interest rates. | 5x |

### How Parameters Interact

The **initial margin** and **maintenance margin** together define the leverage envelope. The initial margin sets the maximum leverage at entry, while the maintenance margin determines how far a position can deteriorate before [liquidation](../trading/liquidation.md) is triggered.

The **base fee** and **price impact scalar** combine to form the total trading cost. For large positions, the price impact fee becomes significant. See [Fees](../trading/fees.md) for the full calculation.

The **base hourly rate** and **ratio cap** govern the [interest](../trading/interest.md) mechanism. As the long/short imbalance grows, the hourly rate scales up for the dominant side (capped by the ratio cap) while the minority side receives a rebate.
