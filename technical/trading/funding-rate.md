---
sidebar_position: 5
title: Funding Rate
---

# Funding Rate

The funding rate mechanism incentivizes balanced open interest between longs and shorts. The dominant side (more open interest) pays the minority side continuously.

## Rate Formula

$$
\text{funding\_rate} = \text{base\_hourly\_rate} \times \frac{|\text{long\_notional} - \text{short\_notional}|}{\text{long\_notional} + \text{short\_notional}}
$$

The sign is determined by which side is dominant. When `long_notional > short_notional`, the rate is positive (longs pay shorts). When `short_notional > long_notional`, the rate is negative (shorts pay longs). Equal open interest produces a rate of zero.

The rate is naturally bounded in `[-base_hourly_rate, +base_hourly_rate]`. A fully one-sided market produces a rate equal to `base_hourly_rate`, while a perfectly balanced market produces zero.

## Accrual

Funding accrues continuously via `data.accrue(e)`, which is called on every market-touching operation (open, close, modify, execute).

$$
\text{hours\_elapsed} = \frac{\text{seconds\_elapsed} \times \text{SCALAR\_18}}{\text{3600}}
$$

$$
\text{pay\_delta} = \frac{|\text{funding\_rate}| \times \text{hours\_elapsed}}{\text{SCALAR\_18}}
$$

For the paying side, `pay_delta` is added to that side's funding index. For the receiving side, the delta is scaled by `dominant_notional / minority_notional` and subtracted from the index. This scaling factor ensures that total paid equals total received. If longs have 2x the notional of shorts, each short receives 2x the per-unit funding rate. The system is perfectly self-balancing.

## Rate Update Cadence

### Lazy Accrual (Every Action)

Every operation that touches market data calls `data.accrue(e)`, which computes funding accrued since `last_update`, updates both funding indices, and sets `last_update = now`. This means funding is always up to date when any position action occurs.

### Explicit Update (Hourly)

`apply_funding()` is a permissionless function that enforces a minimum 1-hour interval (`ONE_HOUR_SECONDS`). It calls `data.accrue(e)` on every registered market, recomputes `funding_rate` from current open interest balances, and emits `ApplyFunding { rates }` with all market rates. This ensures rates are recalculated at least hourly, even if no positions are opened or closed.

## Per-Position Settlement

When a position is closed, its funding cost or credit is computed as:

$$
\text{funding} = \text{notional} \times \frac{\text{current\_index} - \text{entry\_index}}{\text{SCALAR\_18}}
$$

Positive funding represents a cost (position paid funding during its lifetime). Negative funding represents a credit (position received funding).

## Vault Skim

When a position received funding (negative funding), the vault takes a cut before paying the user:

$$
\text{vault\_skim} = |\text{funding}| \times \frac{\text{vault\_skim\_rate}}{\text{SCALAR\_7}}
$$

The skim is capped at `user_payout`. This provides the vault with additional yield beyond base trading fees.

## Design Rationale

Continuous accrual (rather than discrete hourly payments) prevents manipulation of the exact accrual timestamp. The dominant/minority scaling makes the mechanism self-balancing, ensuring no value is created or destroyed. Per-market rates allow different asset pairs to have independent funding dynamics. The vault skim compensates LPs for providing the counterparty liquidity that enables short-side funding collection.
