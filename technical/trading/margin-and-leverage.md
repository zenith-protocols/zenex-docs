---
sidebar_position: 9
title: Margin & Leverage
---

# Margin & Leverage

## Leverage Bounds

Every position must satisfy two leverage constraints.

### Minimum Leverage

$$
\text{notional\_size} \geq \text{collateral} \times \text{MIN\_LEVERAGE}
$$

`MIN_LEVERAGE = 2`. Positions must be at least 2x levered. This prevents using the trading contract as a simple spot swap mechanism.

### Maximum Leverage

$$
\text{notional\_size} \times \text{init\_margin} \leq \text{collateral} \times \text{SCALAR\_7}
$$

Equivalently: `leverage <= 1 / init_margin`.

| `init_margin` | Max Leverage |
|---|---|
| `1_000_000` (10%) | 10x |
| `500_000` (5%) | 20x |
| `200_000` (2%) | 50x |
| `100_000` (1%) | 100x |
| `50_000` (0.5%) | 200x |

## Initial vs Maintenance Margin

| Property | Initial Margin | Maintenance Margin |
|---|---|---|
| **Rate** | Configurable per market | Fixed at 0.5% |
| **Source** | `MarketConfig.init_margin` | `SCALAR_7 / MAINTENANCE_MARGIN_DIVISOR` |
| **Enforced at** | Open, modify collateral | Liquidation check |
| **Minimum value** | 0.5% (must be >= maintenance) | 0.5% (hardcoded) |
| **Purpose** | Buffer between opening and liquidation | Liquidation threshold |

The validation rule `init_margin >= SCALAR_7 / MAINTENANCE_MARGIN_DIVISOR` ensures that initial margin is always at least equal to maintenance margin.

## Collateral Bounds

| Constraint | Enforced by |
|---|---|
| `collateral >= min_collateral` | `TradingConfig.min_collateral` |
| `collateral <= max_collateral` | `TradingConfig.max_collateral` |

Both are validated at open and on collateral modification.

## Collateral Modification

When withdrawing collateral from a filled position, an additional margin check is applied:

$$
\text{equity} = \text{new\_collateral} + \text{pnl} - \text{total\_fee} - \text{vault\_skim}
$$

$$
\text{equity} \geq \text{notional} \times \frac{\text{init\_margin}}{\text{SCALAR\_7}}
$$

If this check fails, the withdrawal is rejected with `WithdrawalBreaksMargin`. This prevents users from extracting collateral to the point where their position becomes immediately liquidatable.

Collateral withdrawal uses the initial margin requirement, not the maintenance margin. This provides an extra buffer. A user cannot withdraw collateral down to the maintenance margin level.
