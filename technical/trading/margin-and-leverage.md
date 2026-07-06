---
sidebar_position: 11
title: Margin & Leverage
---

# Margin & Leverage

Every position carries two margin lines: an **initial-margin** floor enforced when opening or growing, and a lower **maintenance-margin** floor that triggers liquidation. Both are `SCALAR_18` fractions of notional, set per market by governance.

## Two Margin Lines

| Line | Config field | Enforced against | Enforced at |
|---|---|---|---|
| Initial margin | `init_margin` | Collateral, measured PnL-free | Increase fill, collateral withdrawal |
| Maintenance margin | `maintenance_margin` | Equity (collateral + unrealized PnL) | Liquidation check |

The two are measured differently, and that difference is the point. The initial-margin check looks at **collateral alone**, ignoring unrealized PnL, so a position cannot be opened or topped up on the strength of a favorable price move. The maintenance-margin check looks at **equity**, collateral plus unrealized PnL, so a losing position is liquidated only once its actual net worth erodes past the floor.

Config validation enforces `maintenance_margin < init_margin`. The gap between them is the safety buffer that absorbs adverse PnL and fee accrual before liquidation triggers. The bounds are `MIN_MARGIN` (`SCALAR_18 / 1000`, 0.1%) and `MAX_MARGIN` (`SCALAR_18 / 2`, 50%).

## Maximum Leverage

Initial margin sets the leverage cap:

$$
\text{max leverage} = \frac{1}{\text{init\_margin}}
$$

An `init_margin` of 1% (`SCALAR_18 / 100`) caps leverage at 100x; halving it doubles the cap. On an Increase fill, the collateral must satisfy `collateral >= init_margin * notional`, else the fill aborts with `InsufficientMargin` (713).

## Collateral Withdrawal

Withdrawing margin is a collateral-only Decrease. The remaining position must still clear both floors. Because the initial-margin check is PnL-free, a user cannot withdraw down to the point where only a favorable unrealized move keeps the position solvent. A withdrawal that would breach the floor aborts with `InsufficientMargin` (713).

## Forced Reductions Waive the Initial Floor

A **forced** reduction (ADL or the delisted-market wind-down) skips the initial-margin floor on the remainder and applies only the maintenance line. Otherwise a partially deleveraged position could be left in a state its own owner could never have opened, and would be stuck. The maintenance floor still applies, so the remainder is never left immediately liquidatable by the reduction itself.
