---
sidebar_position: 6
title: Funding Rate
---

# Funding Rate

Funding is a peer-to-peer transfer between longs and shorts that pushes open interest toward balance. The dominant side pays the minority side, with no protocol cut. Zenex uses a **velocity model** (GMX-style): the market stores a signed funding rate that accelerates, holds, or decays over time based on the token skew, rather than being recomputed from scratch each interval.

## The Saved Rate

The market stores a single signed `funding_rate` (`SCALAR_18` per second). Positive means longs pay shorts, negative means shorts pay longs. It evolves according to the **token skew**:

$$
\text{skew} = \frac{|\text{long\_tokens} - \text{short\_tokens}|}{\text{long\_tokens} + \text{short\_tokens}}
$$

Three regimes govern how the saved rate moves each second:

- **Accelerate.** When the rate is fresh (zero) or its sign opposes the current token-dominant side (as after the book flips), or when the skew is above `threshold_stable_funding`, the rate accelerates toward the dominant side by `funding_increase * skew` per second. Persistent imbalance ramps the rate up.
- **Decay.** When the skew is below `threshold_decrease_funding`, the rate decays flat by `funding_decrease` per second toward zero. A full decay parks at the smallest signed step, preserving the sign until a flip ramps back through it.
- **Hold.** Between the two thresholds, or on a token-balanced book, the rate holds.

Config validation enforces `threshold_decrease_funding <= threshold_stable_funding <= SCALAR_18` and `funding_min <= funding_max <= MAX_FUNDING_RATE` (the per-second equivalent of 1000% APR), and caps both velocity parameters `funding_increase` and `funding_decrease` at `MAX_FUNDING_RATE`.

## Caps and Floors

The saved rate is hard-capped at `+/- funding_max`. An empty market resets it to zero. The **charged** magnitude is floored at `funding_min`: while the stored rate is nonzero but below the floor, the charge steps up to `funding_min`. The **stored** rate itself is not floored, so it can decay through the floor and flip sign as the book rebalances. Only a stored rate of exactly zero charges nothing.

## Settlement and the Internal Pool

Funding is settled through an internal pool with per-user claimable balances, tracked on `MarketData` as `funding_pool` and `funding_owed`. Two steps happen at two different times.

At **accrual**, the indices move for whole sides at once: the paying side's `funding_idx` rises by the charged rate times the elapsed seconds, and the receiving side's `funding_idx` falls by the paid total spread over the receiver's notional (floored, with the remainder left in the pool). When one side has no opposing side to receive its payment, the paid funding accumulates as pool surplus instead.

When a **position settles**, the cash leg runs: the position's accrued delta, `ceil(notional * idx_delta / SCALAR_18)`, is debited from its collateral and banked into `funding_pool` if the position is on the paying side, or credited to the user's `ClaimableFunding` balance and to `funding_owed` if it is on the receiving side. The position then re-snapshots its side's index.

## Claiming

A trader redeems their earned funding with `claim_funding`. It pays the claimable balance from the pool, capped at the pool's holdings (any remainder stays claimable), and shrinks both `funding_pool` and `funding_owed`. `NothingToClaim` (760) if the balance is empty or the pool currently holds nothing to pay it with. `claim_funding` is blocked while the market is `Frozen` (`MarketFrozen` 704) but remains available in every other status, including `Retired`.

The pool surplus sweeps to the vault a single time, when the market enters `Retired`.

## Accrual

Every fill, liquidation, ADL execution, and vault-order execution accrues funding to the current timestamp before touching a position. Two maintenance calls advance the indices without a position operation: `accrue_funding` is price-free and advances only funding, while the price-bearing `accrue` advances both funding and borrowing. Both are blocked with `MarketFrozen` (704) while the market is `Frozen` or `Retired`. Funding accrues continuously per second, so there is no periodic settlement moment to trade around.

Each accrual first evolves the saved rate over the full elapsed window, then charges the whole window at that single end-of-window rate: `max(|funding_rate|, funding_min) * elapsed` is added to the payer index. The ramp is not integrated, so the amount charged across a ramp or decay depends on how often accrual runs (frequent accrual approximates the integrated ramp, one lump accrual at the end charges the final rate over the whole window). The parked decay value is independent of how elapsed time is chopped into windows.

A config change that touches any funding-velocity parameter (`funding_increase`, `funding_decrease`, `threshold_stable_funding`, `threshold_decrease_funding`, `funding_min`, `funding_max`) first accrues funding to now under the outgoing parameters, so no window is ever charged under parameters that were not live during it.
