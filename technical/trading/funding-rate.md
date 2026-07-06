---
sidebar_position: 6
title: Funding Rate
---

# Funding Rate

Funding is a peer-to-peer transfer between longs and shorts that pushes open interest toward balance. The dominant side pays the minority side, with no protocol cut. Zenex uses a **velocity model** (GMX-style): the market stores a signed funding rate that accelerates, holds, or decays over time based on the token skew, rather than being recomputed from scratch each interval.

## The Saved Rate

The market stores a single signed `funding_rate` (`SCALAR_18` per second). Positive means longs pay shorts; negative means shorts pay longs. It evolves according to the **token skew**:

$$
\text{skew} = \frac{|\text{long\_tokens} - \text{short\_tokens}|}{\text{long\_tokens} + \text{short\_tokens}}
$$

Three regimes govern how the saved rate moves each second:

- **Accelerate.** When the rate is fresh (zero) or has just flipped sign, or when the skew is above `threshold_stable_funding`, the rate accelerates toward the dominant side by `funding_increase * skew` per second. Persistent imbalance ramps the rate up.
- **Decay.** When the skew is below `threshold_decrease_funding`, the rate decays flat by `funding_decrease` per second toward zero. A full decay parks at the smallest signed step, preserving the sign until a flip ramps back through it.
- **Hold.** Between the two thresholds, or on a token-balanced book, the rate holds.

Config validation enforces `threshold_decrease_funding <= threshold_stable_funding`.

## Caps and Floors

The saved rate is hard-capped at `+/- funding_max`. An empty market resets it to zero. The **charged** magnitude is floored at `funding_min`: below that floor nothing is charged, but the **stored** rate is not floored, so it can decay through the floor and flip sign as the book rebalances.

## Settlement and the Internal Pool

Funding is settled through an internal pool with per-user claimable balances, tracked on `MarketData` as `funding_pool` and `funding_owed`. When a position settles:

- The **paying** side's `funding_idx` rises, and the funding it owes is debited from its collateral and banked into `funding_pool`.
- The **receiving** side's `funding_idx` falls by the paid total spread over the receiver's notional (floored, with the remainder left in the pool), and the earned amount credits the user's `ClaimableFunding` balance.

With no opposing side to receive it, paid funding is never redistributed and simply accumulates as pool surplus.

## Claiming

A trader redeems their earned funding with `claim_funding(user)`. It pays the claimable balance from the pool, capped at the pool's holdings (any remainder stays claimable), and shrinks both `funding_pool` and `funding_owed`. `NothingToClaim` (760) if the balance is empty. `claim_funding` is blocked while the market is `Frozen` (`MarketFrozen` 704) but remains available in every other status, including `Retired`.

There is no live sweep of the pool surplus. It is swept once to the vault when the market enters `Retired`.

## Accrual

The funding index advances to now on every funding accrual, which is price-free: the maintenance call `accrue_funding()` advances only funding, while the price-bearing `accrue(price)` advances both funding and borrowing. Continuous accrual removes any incentive to manipulate the exact settlement timestamp.
