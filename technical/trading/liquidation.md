---
sidebar_position: 7
title: Liquidation
---

# Liquidation

Liquidation protects the vault from positions that have lost more than their collateral can cover. It is triggered by keepers via the permissionless `execute` batch function.

## Liquidation Condition

A position is liquidatable when its equity falls below the liquidation threshold:

$$
\text{equity} = \text{col} + \text{pnl} - \text{total\_fee}
$$

$$
\text{liq\_threshold} = \text{notional} \times \frac{\text{liq\_fee}}{\text{SCALAR\_7}}
$$

$$
\text{is\_liquidatable} = \text{equity} < \text{liq\_threshold}
$$

`liq_fee` is a per-market configurable parameter in `MarketConfig` (SCALAR_7), capped at `MAX_LIQ_FEE` (25%). The `total_fee` includes accrued funding and borrowing. A position can become liquidatable purely from fee accrual, even if the underlying price has not moved.

## Margin Gap

There is a structural gap between initial margin and liquidation threshold:

| Margin Type | Rate | Source |
|---|---|---|
| Initial margin | Configurable per market (`margin`) | `MarketConfig` |
| Liquidation threshold | Configurable per market (`liq_fee`) | `MarketConfig` |

The validation rule `margin > liq_fee` enforces a buffer between the opening margin requirement and the liquidation threshold.

## Liquidation Execution

When a keeper submits a position via the `execute` batch, the contract checks whether `equity < liq_threshold`. Unlike a normal close, there is no PnL payout to the user.

The position's remaining collateral is redistributed: `liq_fee = max(equity, 0)` is the remaining equity. The treasury receives `revenue * treasury_rate / SCALAR_7` where `revenue = min(protocol_fee + liq_fee, col)`. The keeper receives `min(trading_fee + liq_fee, col) * caller_rate / SCALAR_7`. The vault receives `col - treasury_fee - caller_fee`. There is no `MIN_OPEN_TIME` enforcement, so a position can theoretically be liquidated in the same block it was opened if parameters are at extreme values.

The position is removed from storage, market stats are decremented, and the contract emits `Liquidation { market_id, user, position_id, notional, price, base_fee, impact_fee, funding, borrowing_fee, liq_fee }`. The `notional` is the post-ADL settled notional, which may be smaller than the original position size if ADL has occurred since fill.

## Insolvency Risk

If a position's loss exceeds its collateral (deeply underwater), the vault absorbs the deficit implicitly. The vault only receives the position's remaining collateral, which may be less than the actual loss. This systemic risk is mitigated by the maintenance margin buffer (positions are liquidated before losses exceed collateral in most cases), the circuit breaker (transitions to `OnIce` at 95% utilization, preventing new positions from increasing risk), and auto-deleveraging (proportionally reduces winning positions to cover deficits when the vault cannot absorb them).

## Liquidation Incentives

Keepers earn `caller_rate` (a percentage of trading fees plus liquidation fee) for each successful liquidation. This incentivizes timely liquidation to minimize insolvency risk. The fee is capped at the position's collateral to prevent the keeper fee from exceeding available funds.

Since the `execute` function is fully permissionless (no authentication required), anyone can run a keeper bot and earn liquidation fees.
