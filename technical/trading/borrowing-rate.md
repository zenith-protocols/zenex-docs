---
sidebar_position: 6
title: Borrowing Rate
---

# Borrowing Rate

The borrowing rate compensates vault depositors for the liquidity risk that open positions impose on the pool. Unlike the funding rate, which is a peer-to-peer transfer between longs and shorts, borrowing fees flow to the protocol. They are split between the vault (liquidity providers) and the treasury (protocol revenue) according to the treasury rate. The borrowing system ensures that traders holding positions pay a continuous cost proportional to how much of the vault's capacity they consume, with the rate increasing sharply as utilization approaches its limits.

## The Dual-Utilization Formula

Zenex uses an additive dual-utilization model that combines a global vault term with a per-market term. The instantaneous borrowing rate is:

$$
\text{rate} = r_{\text{base}} + r_{\text{var}} \times u_{\text{vault}}^5 + r_{\text{var\_market}} \times u_{\text{market}}^3
$$

Each component serves a distinct purpose. The base rate $r_{\text{base}}$ provides a constant floor that applies regardless of utilization, ensuring that holding a position is never free. The vault variable term $r_{\text{var}} \times u_{\text{vault}}^5$ responds to aggregate protocol utilization across all markets. The market variable term $r_{\text{var\_market}} \times u_{\text{market}}^3$ responds to congestion within a single market. Because the terms are additive, a position's borrowing cost reflects both the global demand for vault liquidity and the local demand within its specific market.

## Vault Utilization

Vault utilization measures how much of the vault's lending capacity is consumed by all open positions across every market. It is computed as:

$$
u_{\text{vault}} = \frac{\text{total\_notional}}{\text{vault\_balance} \times \text{max\_util} / \text{SCALAR\_7}}
$$

`total_notional` is the sum of all open position notional across all markets. `vault_balance` is total assets in the strategy vault. `max_util` is the global utilization cap from `TradingConfig` (SCALAR_7). The denominator is the effective lending capacity: vault balance times the cap.

The result is clamped to the range $[0, \text{SCALAR\_7}]$. A value of `0` means no utilization. A value of `SCALAR_7` (representing 100%) means the protocol has reached or exceeded its configured capacity. The clamping prevents the utilization ratio from exceeding 1.0 in the fixed-point representation, which would produce unexpected behavior in the exponential term.

When the vault balance is zero or negative, or when there are no open positions, utilization returns zero and the variable vault term contributes nothing to the rate.

## Market Utilization

Market utilization works identically to vault utilization but scoped to a single market:

$$
u_{\text{market}} = \frac{\text{market\_notional}}{\text{vault\_balance} \times \text{max\_util\_market} / \text{SCALAR\_7}}
$$

Here, `market_notional` is the sum of long and short notional within the specific market (`l_notional + s_notional`), and `max_util_market` is the per-market utilization cap from `MarketConfig`. This allows the protocol to set different capacity limits for different assets. A volatile, low-liquidity asset might have a tighter `max_util_market` than a major asset like BTC.

The same clamping to $[0, \text{SCALAR\_7}]$ applies. The ceiling division used in the implementation (`fixed_div_ceil`) ensures that the utilization is rounded up, which means the rate is always at least as high as the true mathematical value.

## Why Quintic and Cubic

The vault term uses a fifth-power (quintic) curve while the market term uses a third-power (cubic) curve. This design choice reflects the different risk profiles of global versus local utilization.

The quintic curve $u^5$ is very flat at low utilization levels. At 50% utilization it contributes only $0.5^5 = 3.125\%$ of its maximum value, making borrowing cheap when the vault has ample headroom. The curve steepens dramatically near full utilization, creating a strong economic deterrent against positions that would push the protocol toward its capacity limit. This gentle-then-aggressive shape is appropriate for the vault term because global utilization changes slowly (it requires significant aggregate position changes) and the protocol can tolerate moderate utilization levels without much concern.

The cubic curve $u^3$ is steeper at intermediate utilization levels. At 50% it contributes $0.5^3 = 12.5\%$ of its maximum, roughly four times the quintic contribution at the same utilization. This faster reaction is appropriate for the market term because individual markets can experience sudden congestion from a few large positions. A cubic response raises borrowing costs sooner, discouraging concentration in a single market before it becomes a systemic risk.

At full utilization (100%), both curves reach their maximum and contribute the full configured rate. At zero utilization, both contribute nothing. The qualitative difference lies in how quickly each curve transitions between these extremes.

## Parameters

The borrowing rate formula has five configurable parameters spread across two configuration structures.

From `TradingConfig` (global, applies to all markets):

| Parameter | Scale | Description |
|---|---|---|
| `r_base` | SCALAR_18 | Constant base hourly borrowing rate. Applies regardless of utilization. |
| `r_var` | SCALAR_18 | Maximum hourly variable rate from vault utilization (at $u_{\text{vault}} = 1$). |
| `max_util` | SCALAR_7 | Global utilization cap. Defines the denominator for vault utilization. |

From `MarketConfig` (per-market):

| Parameter | Scale | Description |
|---|---|---|
| `r_var_market` | SCALAR_18 | Maximum hourly variable rate from market utilization (at $u_{\text{market}} = 1$). |
| `max_util` | SCALAR_7 | Per-market utilization cap. Defines the denominator for market utilization. |

All rate parameters are expressed in SCALAR_18 (10^18) and represent hourly rates. The maximum allowed value for `r_var` and `r_var_market` is `MAX_R_VAR = MAX_R_VAR_MARKET = 100_000_000_000_000`, which corresponds to 0.01% per hour or approximately 88% APR. The same bound applies to `r_base` via `MAX_RATE_HOURLY`. These caps prevent misconfiguration from creating unreasonably expensive borrowing.

## Dominant-Side-Only Accrual

Borrowing fees are not charged symmetrically. Only the dominant side of the market (the side with more open interest) accrues borrowing costs. The rationale is that the dominant side represents the net directional exposure that the vault is absorbing, and therefore it should bear the cost of that liquidity risk.

When longs have more notional than shorts (`l_notional > s_notional`), only the long borrowing index `l_borr_idx` advances. Short positions in that market accumulate no borrowing cost during that period. When shorts dominate, only `s_borr_idx` advances.

There is one edge case: when both sides have exactly equal notional (`l_notional == s_notional` and both are positive), both indices advance by the same delta. This prevents a discontinuity where a tiny imbalance would cause one side to pay the full rate while the other pays nothing. In practice, exact equality is rare on-chain, but the contract handles it correctly.

When a market has no open positions on either side, accrual is skipped entirely and no indices change.

## Index-Based Accounting

Rather than updating every position on each accrual, Zenex uses cumulative indices to track borrowing costs efficiently. Each market maintains two borrowing indices, `l_borr_idx` and `s_borr_idx`, that start at zero and monotonically increase over time. When a position is opened or filled, it snapshots the current index for its side into `position.borr_idx`.

At settlement (close, liquidation, or any equity calculation), the borrowing fee for a position is:

$$
\text{borrowing\_fee} = \text{notional} \times \frac{\text{current\_borr\_idx} - \text{position.borr\_idx}}{\text{SCALAR\_18}}
$$

This approach has two important properties. First, it is O(1) per position regardless of how many accrual periods have elapsed. The difference between the current index and the snapshot captures all accumulated borrowing since the position was opened, without iterating over time intervals. Second, positions that were not on the dominant side during certain intervals naturally accumulate zero cost for those intervals, because the index for their side did not advance during those periods.

The indices are stored in `MarketData` and persisted to ledger storage after every mutation.

## Accrual Mechanics

Borrowing accrual happens inside the `MarketData::accrue` method, which is called on every market-touching operation (open, close, modify, execute, apply_funding). The method computes the time elapsed since the last update, calculates both utilization values, derives the borrowing rate from the formula, and advances the appropriate index.

The accrual delta for a single interval is:

$$
\text{borrow\_delta} = \text{rate} \times \frac{\text{seconds\_elapsed}}{\text{3600}}
$$

This division by 3600 converts the hourly rate to a per-second rate scaled by the elapsed time. The computation uses ceiling multiplication (`fixed_mul_ceil`), which ensures the protocol never under-collects due to rounding.

Borrowing is always accrued before funding within the same `accrue` call. This ordering matters because both mechanisms share the same timestamp tracking (`last_update`), and accruing borrowing first ensures that the borrowing index reflects the full elapsed interval before any funding calculations run.

## Rounding Behavior

All fixed-point operations in the borrowing rate calculation use ceiling rounding (`fixed_mul_ceil`, `fixed_div_ceil`). This is a deliberate protocol-favoring design choice. Utilization is rounded up, the rate is rounded up, the accrual delta is rounded up, and the settlement fee is computed using ceiling operations. The cumulative effect of these rounding choices means the protocol systematically collects slightly more than the true mathematical borrowing fee. The difference is negligible for individual positions but prevents the protocol from slowly leaking value over millions of accrual intervals.

## Interaction with apply_funding

The permissionless `apply_funding` function, called at least once per hour, accrues both borrowing and funding for every registered market. Inside each market's accrual, borrowing indices are updated first, then funding indices are updated. After accrual, `apply_funding` also recalculates the funding rate from the current open interest balance. This means that borrowing costs are always settled before funding adjustments take effect within the same block.

## Worked Example

Consider a market with the following state: `r_base = 10_000_000_000_000` (0.001%/hr), `r_var = 10_000_000_000_000`, `r_var_market = 10_000_000_000_000`, vault utilization at 50%, and market utilization at 90%.

The vault term: $0.5^5 = 0.03125$, so the vault contribution is $10{,}000{,}000{,}000{,}000 \times 0.03125 = 312{,}500{,}000{,}000$.

The market term: $0.9^3 = 0.729$, so the market contribution is $10{,}000{,}000{,}000{,}000 \times 0.729 = 7{,}290{,}000{,}000{,}000$.

The total rate: $10{,}000{,}000{,}000{,}000 + 312{,}500{,}000{,}000 + 7{,}290{,}000{,}000{,}000 = 17{,}602{,}500{,}000{,}000$ in SCALAR_18, or approximately 0.00176% per hour (15.4% APR).

If one hour elapses and longs are dominant, `l_borr_idx` increases by approximately $17{,}602{,}500{,}000{,}000$. A long position with 100,000 USDC notional (at 7 decimals: $1{,}000{,}000{,}000{,}000$) would owe:

$$
\text{borrowing\_fee} = 1{,}000{,}000{,}000{,}000 \times \frac{17{,}602{,}500{,}000{,}000}{10^{18}} \approx 17{,}603 \text{ (in token units, } \approx 0.00176 \text{ USDC)}
$$

Over a full day (24 hours), this position would pay approximately 0.042 USDC in borrowing fees at this utilization level.
