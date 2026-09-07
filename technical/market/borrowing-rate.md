---
sidebar_position: 7
title: Borrowing Rate
---

# Borrowing Rate

The borrowing fee compensates vault depositors for the liquidity that open positions reserve. Unlike funding, which is a peer-to-peer transfer between longs and shorts, borrowing revenue flows to the protocol: it is split between the vault (liquidity providers) and the treasury. Zenex prices it with a **kink model**, a piecewise-linear rate on each side's vault utilization that stays cheap while the vault has headroom and climbs steeply as it fills.

## Utilization

Utilization is computed per side. Each side's reserve is the value the vault must stand behind: longs mark their base tokens at the ask, rounded up, and shorts count their entry notional. The capacity each side is measured against is half the vault scaled by `max_util_open`:

$$
\text{capacity} = \left\lfloor \frac{\text{vault\_balance}}{2} \times \frac{\text{max\_util\_open}}{\text{SCALAR\_18}} \right\rfloor
$$

$$
u_{\text{side}} = \min\left(\left\lceil \frac{\text{side\_reserved} \times \text{SCALAR\_18}}{\text{capacity}} \right\rceil,\ \text{SCALAR\_18}\right)
$$

A side with no reserve has zero utilization. A non-empty reserve against zero capacity is full utilization (`SCALAR_18`). The halving floors, the capacity floors, and the quotient ceils, all pushing toward a higher rate. `max_util_open` is the same `SCALAR_18` cap that gates new opens, where each side's reserve is checked against the same half-vault capacity.

## The Kink Rate

The per-second rate for a side is piecewise-linear in its utilization `u`, hinged at the kink utilization `target_util`. Both `u` and `target_util` are raw `SCALAR_18` values, so the fixed-point formulas divide by `SCALAR_18`. The linear leg is

$$
\text{base} = \left\lceil \frac{\text{borrow\_rate} \times u}{\text{SCALAR\_18}} \right\rceil
$$

Below the kink (`u <= target_util`) the rate is `base`, a gentle linear slope while the vault has room. Above the kink a steeper term is added:

$$
\text{rate} = \text{base} + \left\lceil \frac{(\text{increased\_borrow\_rate} - \text{borrow\_rate}) \times (u - \text{target\_util})}{\text{SCALAR\_18} - \text{target\_util}} \right\rceil
$$

Both ceils round toward a higher rate. The two anchors are the linear leg's value at full utilization and the total rate at full utilization: the rate at the kink is `borrow_rate * target_util`, and at `u = SCALAR_18` the formula returns exactly `increased_borrow_rate`. The kink point itself takes the linear branch.

The two anchor rates are `SCALAR_18` per-second config values with `borrow_rate <= increased_borrow_rate`, both capped at `MAX_BORROW_RATE` (`10 * SCALAR_18 / SECONDS_PER_YEAR`, roughly 1000% APR). `target_util` is a `SCALAR_18` fraction below 1.

## Which Side Pays

Borrowing is charged to the dominant side. On each accrual, a side whose base tokens are strictly less than the other side's accrues nothing. The side holding strictly more base tokens advances its `borrowing_idx` by `rate * elapsed`, at the kink rate computed from its own per-side utilization. A token tie charges both sides, each at the rate from its own utilization (an empty book has zero utilization on both sides, so neither index moves).

## Index-Based Accrual

Rather than touching every position on each accrual, the market keeps a cumulative borrowing index per side. On each price-bearing accrual the paying side's index advances by `rate * seconds_elapsed` at the rate from its own utilization (see Which Side Pays). The index only ever rises: there is no receiving leg, so nothing is redistributed to the other side of the book. A position snapshots its side's index at each change (`borrowing_idx`), and at settlement its borrowing fee is charged against its stored entry `notional`:

$$
\text{borrowing\_fee} = \left\lceil \text{notional} \times \frac{\text{side\_borrowing\_idx} - \text{position.borrowing\_idx}}{\text{SCALAR\_18}} \right\rceil
$$

This is O(1) per position regardless of how many intervals elapsed. Fixed-point rounding favors the protocol so it never under-collects over many intervals.

Borrowing accrual is **price-bearing**: the long side's reserve is ask-marked and the rate needs the vault balance, so the index advances only inside a price-verifying call (order fills, vault-order fills, liquidations, ADL, and the permissionless `accrue`). Borrowing and funding share the single `accrued_at` clock, with borrowing advancing first over the one elapsed window measured on the ledger timestamp (see [Funding Rate](./funding-rate.md#accrual)). The `accrual_update` receipt marks the `accrue` poke, including a call where the elapsed window is zero. It carries no payload. The post-accrual state is read from `get_market_data`.

Because of this, changing `target_util`, `borrow_rate`, `increased_borrow_rate`, or `max_util_open` through `set_config` requires that the market was already accrued in the same ledger, else the call reverts with `MarketNotAccrued` (703). This guarantees a rate change never applies retroactively across an un-accrued interval. The guard is waived while the market is `Frozen`, where nothing accrues anyway.
