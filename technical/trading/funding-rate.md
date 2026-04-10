---
sidebar_position: 5
title: Funding Rate
---

# Funding Rate

The funding rate mechanism incentivizes balanced open interest between longs and shorts. The dominant side (more open interest) pays the minority side continuously.

## Rate Formula

$$
\text{funding\_rate} = \text{r\_funding} \times \frac{|\text{long\_notional} - \text{short\_notional}|}{\text{long\_notional} + \text{short\_notional}}
$$

The sign is determined by which side is dominant. When `long_notional > short_notional`, the rate is positive (longs pay shorts). When `short_notional > long_notional`, the rate is negative (shorts pay longs). Equal open interest produces a rate of zero.

`r_funding` is a global parameter in `TradingConfig` (SCALAR_18) that applies to all markets. The rate is naturally bounded in `[-r_funding, +r_funding]`. A fully one-sided market produces a rate equal to `r_funding`, while a perfectly balanced market produces zero.

## Accrual

Funding accrues continuously via `data.accrue(e, ...)`, which is called on every market-touching operation (open, close, modify, execute). Borrowing indices are accrued in the same call before funding.

**One-sided markets**: When either `l_notional == 0` or `s_notional == 0`, funding accrual is skipped entirely even if `fund_rate` is non-zero. This is because funding is peer-to-peer — there is no counterparty to receive payment. The rate is still SET via `apply_funding` (reflecting the imbalance), but no indices advance until both sides have open interest.

$$
\text{hours\_elapsed} = \frac{\text{seconds\_elapsed} \times \text{SCALAR\_18}}{\text{3600}}
$$

$$
\text{pay\_delta} = \frac{|\text{funding\_rate}| \times \text{hours\_elapsed}}{\text{SCALAR\_18}}
$$

For the paying side, `pay_delta` is added to that side's funding index (`l_fund_idx` or `s_fund_idx`). For the receiving side, the delta is scaled by `dominant_notional / minority_notional` and subtracted from the index. This scaling factor ensures that total paid equals total received. If longs have 2x the notional of shorts, each short receives 2x the per-unit funding rate. The system is purely peer-to-peer with no protocol cut.

## Rate Update Cadence

### Lazy Accrual (Every Action)

Every operation that touches market data calls `data.accrue(e)`, which computes funding accrued since `last_update`, updates both funding indices, and sets `last_update = now`. This means funding is always up to date when any position action occurs.

### Explicit Update (Hourly)

`apply_funding()` is a permissionless function that enforces a minimum 1-hour interval (`ONE_HOUR_SECONDS`). For every registered market, it accrues both borrowing and funding indices, then recomputes the funding rate from current open interest balances. It emits `ApplyFunding` after updating all markets. This ensures rates are recalculated at least hourly, even if no positions are opened or closed.

## Per-Position Settlement

When a position is closed, its funding cost or credit is computed as:

$$
\text{funding} = \text{notional} \times \frac{\text{current\_index} - \text{entry\_index}}{\text{SCALAR\_18}}
$$

Positive funding represents a cost (position paid funding during its lifetime). Negative funding represents a credit (position received funding).

## Design Rationale

Continuous accrual (rather than discrete hourly payments) prevents manipulation of the exact accrual timestamp. The dominant/minority scaling makes the mechanism self-balancing, ensuring no value is created or destroyed — funding is purely peer-to-peer with 100% flowing between longs and shorts. LP compensation comes from the separate borrowing fee system, which accrues to the vault via protocol fees. Per-market variation comes naturally from each market's open interest imbalance, even though `r_funding` is a single global parameter in `TradingConfig`.
