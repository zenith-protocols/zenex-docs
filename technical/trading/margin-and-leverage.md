---
sidebar_position: 10
title: Margin & Leverage
---

# Margin & Leverage

## Leverage Bounds

Every position must satisfy the maximum leverage constraint.

### Maximum Leverage

$$
\text{notional} \times \text{margin} \leq \text{col} \times \text{SCALAR\_7}
$$

Equivalently: `leverage <= 1 / margin`.

| `margin` | Max Leverage |
|---|---|
| `1_000_000` (10%) | 10x |
| `500_000` (5%) | 20x |
| `200_000` (2%) | 50x |
| `100_000` (1%) | 100x |
| `50_000` (0.5%) | 200x |

## Initial Margin vs Liquidation Threshold

| Property | Initial Margin | Liquidation Threshold |
|---|---|---|
| **Rate** | Configurable per market | Configurable per market |
| **Source** | `MarketConfig.margin` | `MarketConfig.liq_fee` |
| **Enforced at** | Open, modify collateral | Liquidation check |
| **Max value** | 50% (`MAX_MARGIN`) | 25% (`MAX_LIQ_FEE`) |
| **Purpose** | Buffer between opening and liquidation | Equity below this triggers liquidation |

The validation rule `margin > liq_fee` ensures there is always a gap between the opening margin requirement and the liquidation threshold. This gap is the safety buffer that absorbs PnL and fee accrual before liquidation triggers.

## Collateral Modification

When withdrawing collateral from a filled position, an additional margin check is applied:

$$
\text{equity} = \text{new\_col} + \text{pnl} - \text{total\_fee}
$$

$$
\text{equity} \geq \text{notional} \times \frac{\text{margin}}{\text{SCALAR\_7}}
$$

Where `total_fee` includes accrued funding and borrowing at current indices. If this check fails, the withdrawal is rejected with `WithdrawalBreaksMargin`. This prevents users from extracting collateral to the point where their position becomes immediately liquidatable.

Collateral withdrawal uses the initial margin requirement (`margin`), not the liquidation threshold (`liq_fee`). This provides an extra buffer. A user cannot withdraw collateral down to the liquidation threshold level.
