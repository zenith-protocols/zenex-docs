---
sidebar_position: 7
title: Borrowing Rate
---

# Borrowing Rate

The borrowing fee compensates vault depositors for the liquidity that open positions reserve. Unlike funding, which is a peer-to-peer transfer between longs and shorts, borrowing revenue flows to the protocol: it is split between the vault (liquidity providers) and the treasury. Zenex prices it with a **kink model**, a piecewise-linear rate on vault utilization that stays cheap while the vault has headroom and climbs steeply as it fills.

## Utilization

Utilization measures how much of the vault's lending capacity the open book reserves:

$$
u = \frac{\text{reserved}}{\text{max\_util\_open} \times \text{vault\_balance}}
$$

clamped to `[0, 1]`. `reserved` marks longs at the ask (their base tokens) and shorts at their entry notional, so it tracks the value the vault must stand behind. `max_util_open` is the same `SCALAR_18` cap that gates new opens, which makes it the borrow-reserve denominator here. A zero-utilization book accrues no borrowing.

## The Kink Rate

The per-second rate is piecewise-linear in `u`, hinged at the kink utilization `target_util`:

- **Below the kink** (`u <= target_util`): `rate = borrow_rate * u`. A gentle linear slope while the vault has room.
- **Above the kink** (`u > target_util`): add a steeper term,

$$
\text{rate} = \text{borrow\_rate} \times u + (\text{increased\_borrow\_rate} - \text{borrow\_rate}) \times \frac{u - \text{target\_util}}{1 - \text{target\_util}}
$$

so the rate reaches exactly `increased_borrow_rate` at full utilization.

The two anchor rates are `SCALAR_18` per-second config values with `borrow_rate <= increased_borrow_rate`, both capped at `MAX_BORROW_RATE` (`10 * SCALAR_18 / SECONDS_PER_YEAR`, roughly 1000% APR). `target_util` is a `SCALAR_18` fraction below 1.

## Both Sides Pay

Borrowing is symmetric: both the long and short sides pay the same kink rate, and each side's `borrowing_idx` advances equally. This is because open interest on either side reserves vault capacity, so both sides impose the liquidity cost the fee is meant to price.

## Index-Based Accrual

Rather than touching every position on each accrual, the market keeps a cumulative borrowing index per side. Each advances by `rate * seconds_elapsed` on every price-bearing accrual. A position snapshots the index at each change (`borrowing_idx`), and at settlement its borrowing fee is:

$$
\text{borrowing\_fee} = \text{notional} \times \frac{\text{current\_borrowing\_idx} - \text{position.borrowing\_idx}}{\text{SCALAR\_18}}
$$

This is O(1) per position regardless of how many intervals elapsed. Fixed-point rounding favors the protocol so it never under-collects over many intervals.

Borrowing accrual is **price-bearing**: it advances through `accrue(price)` (which also advances funding) and on every price-bearing fill. Because of this, changing a borrowing parameter through `set_config` requires a same-ledger `accrue`, else the call reverts with `BorrowingNotAccrued` (703). This guarantees a rate change never applies retroactively across an un-accrued interval.
