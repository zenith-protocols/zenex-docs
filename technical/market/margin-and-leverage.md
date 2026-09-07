---
sidebar_position: 11
title: Margin & Leverage
---

# Margin & Leverage

Every position carries two margin lines: an **initial-margin** floor enforced when opening or growing, and a lower **maintenance-margin** floor that triggers liquidation. Both are `SCALAR_18` fractions of notional, set per market in `Config`.

## Two Margin Lines

| Line | Config field | Enforced against | Enforced at |
|---|---|---|---|
| Initial margin | `init_margin` | Margin, measured PnL-free | Every Increase fill and every partial Decrease fill (size reduction or margin withdrawal) |
| Maintenance margin | `maintenance_margin` | Settled equity (margin + unrealized PnL, less the close's costs) | Every increase/decrease fill, and the liquidation check |

The two are measured differently, and that difference is the point. The initial-margin check looks at **posted margin alone**, ignoring unrealized PnL, so a position cannot be opened or topped up on the strength of a favorable price move. The maintenance-margin check looks at **settled equity**: margin plus unrealized PnL, less the base and impact fees a full-size close would pay, the accrued borrowing, and any funding owed. A position is liquidated once that net worth erodes past the floor, whether the price or the accruals alone took it there. The unrealized PnL in that equity is marked at the exit side of the verified price, bid for a long and ask for a short.

The initial-margin floor is held against the remainder of every voluntary partial Decrease, even one that withdraws no margin. A partial close whose fees or realized loss leave margin under `ceil(init_margin * notional / SCALAR_18)` on the remainder aborts with `InsufficientMargin` (713). Only a full close settles without the check, since nothing remains to hold to a floor.

Config validation enforces the ladder `liq_fee < maintenance_margin < init_margin`, and sizes the gap between the two margin lines against the unavoidable cost of an exit: `init_margin > maintenance_margin + fee_non_dom + MIN_CHUNK_IMPACT_CAP` (`SCALAR_18 / 1000`, 0.1%), with `impact_scalar` large enough that a minimum-size chunk's impact rate stays under that cap. That gap is the safety buffer absorbing adverse PnL and fee accrual before liquidation triggers, and it leaves a position sitting at the initial line an exit in minimum-size chunks that does not cross the maintenance line. The `MIN_MARGIN` (`SCALAR_18 / 1000`, 0.1%) and `MAX_MARGIN` (`SCALAR_18 / 2`, 50%) bounds apply to `init_margin` only. `maintenance_margin` has no absolute bounds beyond the ladder.

## Maximum Leverage

Initial margin sets the leverage cap:

$$
\text{max leverage} = \frac{1}{\text{init\_margin}}
$$

An `init_margin` of 1% (`SCALAR_18 / 100`) caps leverage at 100x, and halving it doubles the cap. On an Increase fill the check runs after the fill's fees are debited: the base fee, impact fee, accrued borrowing, and any positive funding come out of the escrowed margin first, and what remains must satisfy `margin >= ceil(init_margin * notional / SCALAR_18)`, else the fill aborts with `InsufficientMargin` (713). A trader who posts exactly `init_margin * notional` fails the check, because the fees erode the margin below the floor before it runs.

## Margin Withdrawal

Withdrawing margin is a margin-only Decrease. The remaining position must still clear both floors. Because the initial-margin check is PnL-free, a user cannot withdraw down to the point where only a favorable unrealized move keeps the position solvent. A withdrawal that would breach the floor aborts with `InsufficientMargin` (713).

## Forced Reductions Waive the Initial Floor

A **forced** reduction (ADL) skips the initial-margin floor on the remainder and applies only the maintenance line. Otherwise a partially deleveraged position could be left in a state its own owner could never have opened, and would be stuck. The maintenance floor still applies, so the remainder is never left immediately liquidatable by the reduction itself. The delisted-market wind-down is not a partial reduction: it force-closes the whole position through the liquidation path, so no remainder exists and no margin floor applies.
