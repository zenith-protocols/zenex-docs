---
sidebar_position: 6
title: Liquidation
---

# Liquidation

Liquidation protects the vault from positions that have lost more than their collateral can cover. It is triggered by keepers via the permissionless `execute` batch function.

## Liquidation Condition

A position is liquidatable when its equity falls below the maintenance margin:

$$
\text{equity} = \text{collateral} + \text{pnl} - \text{total\_fee}
$$

$$
\text{maintenance\_margin} = \frac{\text{notional}}{200}
$$

$$
\text{is\_liquidatable} = \text{equity} < \text{maintenance\_margin}
$$

The maintenance margin is 0.5% of notional, a fixed, non-configurable constant (`MAINTENANCE_MARGIN_DIVISOR = 200`).

Note that `total_fee` includes accrued funding. A position can become liquidatable purely from funding payments, even if the underlying price has not moved.

## Margin Gap

There is a structural gap between initial margin and maintenance margin:

| Margin Type | Rate | Source |
|---|---|---|
| Initial margin | Configurable per market (`init_margin`) | `MarketConfig` |
| Maintenance margin | Fixed at 0.5% | `MAINTENANCE_MARGIN_DIVISOR = 200` |

At `init_margin = 1%` (100x leverage), there is a 0.5% buffer between opening and liquidation. At `init_margin = 0.5%` (200x, the minimum allowed), there is zero initial buffer.

The validation rule `init_margin >= SCALAR_7 / 200` ensures initial margin is always at least equal to maintenance margin.

## Liquidation Execution

When a keeper submits a `Liquidate` request in an `execute` batch, the contract first verifies through `check_liquidation()` that the position's equity is below the maintenance margin. Unlike a normal close, there is no profit/loss calculation for the user.

The position's remaining collateral is redistributed: the keeper receives `min(total_fee * caller_take_rate, collateral)`, and the vault receives `collateral - caller_fee`. The treasury receives nothing on liquidation. There is no `min_open_time` enforcement, so a position can theoretically be liquidated in the same block it was opened if parameters are at extreme values.

The position is removed from storage, market stats are decremented, and the contract emits `Liquidation { feed_id, user, position_id, price, pnl, base_fee, impact_fee, funding }`. The event includes PnL and fee fields for informational purposes, even though they do not affect settlement.

## Insolvency Risk

If a position's loss exceeds its collateral (deeply underwater), the vault absorbs the deficit implicitly. The vault only receives the position's remaining collateral, which may be less than the actual loss. This systemic risk is mitigated by the maintenance margin buffer (positions are liquidated before losses exceed collateral in most cases), the circuit breaker (transitions to `OnIce` at 95% utilization, preventing new positions from increasing risk), and auto-deleveraging (proportionally reduces winning positions to cover deficits when the vault cannot absorb them).

## Liquidation Incentives

Keepers earn `caller_take_rate` (a percentage of the position's total fee) for each successful liquidation. This incentivizes timely liquidation to minimize insolvency risk. The fee is capped at the position's collateral to prevent the keeper fee from exceeding available funds.

Since the `execute` function is fully permissionless (no authentication required), anyone can run a keeper bot and earn liquidation fees.
