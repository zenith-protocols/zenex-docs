---
sidebar_position: 5
title: Funding Rate
---

# Funding Rate

Funding incentivizes balanced open interest between longs and shorts. The dominant side (more open interest) continuously pays the minority side, peer-to-peer with no protocol cut.

A market runs two funding rates side-by-side. The **pay rate** is what the dominant side pays per hour. It is recomputed once per hour by `apply_funding` and stored on the market as `fund_rate`, where it stays fixed until the next hourly update. The **receive rate** is what the minority side earns per hour. It equals the pay rate scaled by `dominant_notional / minority_notional` against the current notional balances, so it is recomputed on every accrue and tracks imbalance changes between the hourly pay-rate updates. By construction, the total paid by the dominant side equals the total received by the minority side at every accrue.

## Pay Rate

`apply_funding` recomputes the pay rate from the current open-interest imbalance:

$$
\text{pay\_rate} = \text{r\_funding} \times \frac{|\text{long\_notional} - \text{short\_notional}|}{\text{long\_notional} + \text{short\_notional}}
$$

Sign follows dominance: positive when longs dominate (longs pay), negative when shorts dominate (shorts pay), zero when balanced. The magnitude is bounded in `[0, r_funding]`. `r_funding` is a global SCALAR_18 parameter in `TradingConfig` shared across all markets; per-market variation comes from each market's own imbalance.

`apply_funding` is permissionless, runs across every market in one call, and enforces a 1-hour minimum interval (`ONE_HOUR_SECONDS`). Every-action `accrue` paths advance indices using whatever `fund_rate` the market last stored; they do not recompute the rate.

## Index Accrual

Both funding indices advance on every market-touching operation (`data.accrue` is called from open, close, modify, execute). The time component is shared:

$$
\text{hours\_elapsed} = \frac{\text{seconds\_elapsed} \times \text{SCALAR\_18}}{\text{3600}}
$$

$$
\text{pay\_delta} = \frac{|\text{pay\_rate}| \times \text{hours\_elapsed}}{\text{SCALAR\_18}}
$$

The dominant side's index advances by `pay_delta`. The minority side's index advances by `pay_delta * dominant_notional / minority_notional`, evaluated at the moment of accrual. If longs have 2× the notional of shorts, each short receives 2× the per-unit rate.

### Edge Cases

- **Empty market** (`l_notional == 0 && s_notional == 0`): rate is zero, accrual is a no-op.
- **One-sided market** (exactly one side is zero): pay rate equals `±r_funding`, but accrual is skipped because there is no counterparty. Indices only advance once both sides hold open interest.

## Per-Position Settlement

When a position is closed, its funding cost or credit is computed as:

$$
\text{funding} = \text{notional} \times \frac{\text{current\_index} - \text{entry\_index}}{\text{SCALAR\_18}}
$$

Positive means the position paid funding during its lifetime; negative means it received funding.

## Design Rationale

Continuous accrual prevents manipulation of the exact payment timestamp. Splitting pay and receive rates keeps the mechanism self-balancing without recomputing the pay rate on every action. LP compensation comes from the separate borrowing fee, which accrues to the vault via protocol fees.
