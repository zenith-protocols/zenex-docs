---
sidebar_position: 8
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

## Underwater Liquidations

Zenex is a synthetic perp protocol: the vault holds only the collateral token (USDC), never the underlying asset that positions reference. There is no traditional insolvency risk because the vault has no debt obligations beyond paying PnL from its USDC balance, and a trader's downside is always capped at their posted collateral.

What can still happen is a per-position drawdown for the vault. If a fast price move makes a position's loss outrun its collateral before a keeper triggers liquidation, the vault collects only the remaining collateral, which may be less than the position's negative PnL would otherwise warrant. The difference is absorbed by the vault as a USDC drawdown. The maintenance-margin buffer (`margin > liq_fee`) and `MAX_LEVERAGE` cap make this rare in normal conditions, but volatile assets and gaps can produce it.

In aggregate, the protocol prevents the vault from running out of USDC through two further mechanisms: the [circuit breaker](./auto-deleveraging.md#circuit-breaker-hysteresis) transitions the contract to `OnIce` at 95% utilization to block new positions from compounding the imbalance, and [auto-deleveraging](./auto-deleveraging.md) proportionally reduces winning positions when realized payouts would exceed available vault balance.

## Liquidation Incentives

Keepers earn `caller_rate` (a percentage of trading fees plus liquidation fee) for each successful liquidation. This incentivizes timely liquidation, which keeps per-position drawdowns small. The fee is capped at the position's collateral to prevent the keeper fee from exceeding available funds.

Since the `execute` function is fully permissionless (no authentication required), anyone can run a keeper bot and earn liquidation fees.
