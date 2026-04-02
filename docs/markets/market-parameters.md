---
sidebar_position: 3
title: Market Parameters
---

# Market Parameters

Each market on Zenex is defined by a set of parameters that control trading fees, leverage limits, risk thresholds, and interest behavior. These parameters can be adjusted through governance and vary per asset. The current values for all supported assets can be found on the [Supported Assets](./supported-assets.md) page.

### Per-Market Parameters (MarketConfig)

| Parameter | Description | Example |
|-----------|-------------|---------|
| **margin** | Initial margin requirement. Determines maximum [leverage](../trading/leverage.md): max leverage = 1 / margin. | 0.01 (1% = 100x) |
| **liq_fee** | Liquidation threshold. Position is liquidatable when equity < notional × liq_fee. Must be less than margin. See [Liquidation](../trading/liquidation.md). | 0.005 (0.5%) |
| **impact** | Divisor used in the [price impact fee](../trading/fees.md) calculation. Higher values result in lower price impact. Varies by asset. | 8,000,000,000 (BTC) |
| **max_util** | Per-market utilization cap. Limits how much of the vault's capacity a single market can consume. | 5x (50,000,000) |
| **r_var_market** | Per-market variable borrowing rate. Scales cubically with market utilization. | Configurable |
| **enabled** | Whether the market accepts new positions. Disabled markets allow existing positions to close. | true |

### Global Parameters (TradingConfig)

| Parameter | Description | Example |
|-----------|-------------|---------|
| **fee_dom / fee_non_dom** | Base trading fee rates for dominant and non-dominant sides. See [Fees](../trading/fees.md). | 0.06% / 0.04% |
| **r_funding** | Base hourly funding rate. Applied to all markets. See [Funding Rate](../trading/funding-rate.md). | Configurable |
| **r_base** | Base hourly borrowing rate. Applied to all markets. | Configurable |
| **r_var** | Vault-level variable borrowing rate. Scales with overall vault utilization. | Configurable |
| **min_notional / max_notional** | Notional size bounds per position. | 10 / 1,000,000 |
| **max_util** | Global utilization cap across all markets. | 10x |
| **caller_rate** | Keeper's share of trading fees. | Up to 50% |

### How Parameters Interact

The **margin** and **liq_fee** together define the leverage envelope. The margin sets the maximum leverage at entry, while liq_fee determines how far a position can deteriorate before [liquidation](../trading/liquidation.md) is triggered. The gap between them is the safety buffer.

The **fee_dom/fee_non_dom** and **impact** combine to form the total trading cost. For large positions, the price impact fee becomes significant. See [Fees](../trading/fees.md) for the full calculation.

The **r_funding** governs the [funding rate](../trading/funding-rate.md) mechanism. As the long/short imbalance grows, the rate scales up for the dominant side while the minority side receives a rebate. The **r_base**, **r_var**, and **r_var_market** govern the [borrowing interest](../trading/fees.md), which compensates vault depositors for the liquidity risk of open positions.
