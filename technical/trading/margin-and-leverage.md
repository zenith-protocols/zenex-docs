---
sidebar_position: 11
title: Margin & Leverage
---

# Margin & Leverage

Every position carries two margin lines: an **initial-margin** floor enforced when opening or growing, and a lower **maintenance-margin** floor that triggers liquidation. Both are `SCALAR_18` fractions of notional, set per market by governance.

## Two Margin Lines

| Line | Config field | Enforced against | Enforced at |
|---|---|---|---|
| Initial margin | `init_margin` | Collateral, measured PnL-free | Every Increase fill and every partial Decrease fill (size reduction or collateral withdrawal) |
| Maintenance margin | `maintenance_margin` | Equity (collateral + unrealized PnL) | Every increase/decrease fill, and the liquidation check |

The two are measured differently, and that difference is the point. The initial-margin check looks at **collateral alone**, ignoring unrealized PnL, so a position cannot be opened or topped up on the strength of a favorable price move. The maintenance-margin check looks at **equity**, collateral plus unrealized PnL, so a losing position is liquidated only once its actual net worth erodes past the floor.

The initial-margin floor is held against the remainder of every voluntary partial Decrease, even one that withdraws no collateral. A partial close whose fees or realized loss leave collateral under `ceil(init_margin * notional)` on the remainder aborts with `InsufficientMargin` (713). Only a full close settles without the check, since nothing remains to hold to a floor.

Config validation enforces the ladder `liq_fee < maintenance_margin < init_margin`. The gap between the two margin lines is the safety buffer that absorbs adverse PnL and fee accrual before liquidation triggers. The `MIN_MARGIN` (`SCALAR_18 / 1000`, 0.1%) and `MAX_MARGIN` (`SCALAR_18 / 2`, 50%) bounds apply to `init_margin` only. `maintenance_margin` has no absolute bounds beyond the ladder.

## Maximum Leverage

Initial margin sets the leverage cap:

$$
\text{max leverage} = \frac{1}{\text{init\_margin}}
$$

An `init_margin` of 1% (`SCALAR_18 / 100`) caps leverage at 100x, and halving it doubles the cap. On an Increase fill, the collateral must satisfy `collateral >= init_margin * notional`, else the fill aborts with `InsufficientMargin` (713).

## Collateral Withdrawal

Withdrawing margin is a collateral-only Decrease. The remaining position must still clear both floors. Because the initial-margin check is PnL-free, a user cannot withdraw down to the point where only a favorable unrealized move keeps the position solvent. A withdrawal that would breach the floor aborts with `InsufficientMargin` (713).

## Forced Reductions Waive the Initial Floor

A **forced** reduction (ADL) skips the initial-margin floor on the remainder and applies only the maintenance line. Otherwise a partially deleveraged position could be left in a state its own owner could never have opened, and would be stuck. The maintenance floor still applies, so the remainder is never left immediately liquidatable by the reduction itself. The delisted-market wind-down is not a partial reduction: it force-closes the whole position through the liquidation path, so no remainder exists and no margin floor applies.
