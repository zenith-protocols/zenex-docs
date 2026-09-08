---
sidebar_position: 11
title: Funding rate
---

# Funding rate

Funding is a transfer between the two sides of the book. The market holds one signed rate, `MarketData.funding_rate` (`SCALAR_18` per second). A positive rate means longs pay shorts, and a negative rate means shorts pay longs. The rate is a velocity. Each accrual window evolves it from its stored value by the token skew, then charges the whole window at the evolved rate. Every charged amount lands in the credit pool, which funds the credits to the receiver side.

Funding moves in two stages. An accrual moves the payer index in `MarketData.funding_idx`, and the receiver index when the receiving side holds notional. Both move for whole sides at once. A position change then settles its side's index against the snapshot stored on the position. The position pays funding as a settled cost, and earns funding as a claimable balance backed by the credit pool. This page holds the rate model, the funding indices, the settlement of both accrual legs into a position, the credit pool, and the claim entry.

This page uses four units. token-dec is the settlement token's decimals. base-dec is the `tokens` scale. `SCALAR_18` is `1_000_000_000_000_000_000`, and a per-second rate times a plain seconds count stays `SCALAR_18`. Seconds are the unix ledger timestamp. The [units page](../units.md) gives the rounding helpers that `floor` and `ceil` name below.

The accrual clock belongs to the loader. `Market::load` computes `elapsed = now - MarketData.accrued_at`. It then runs `MarketData::accrue_borrowing`, then `MarketData::accrue_funding`, then stamps `accrued_at = now`. The details are on [Pricing](./pricing.md). The guard that ties a funding-parameter change to an accrued ledger is on [Config](./config.md).

## The config fields

| Field | Unit | Meaning |
| --- | --- | --- |
| `funding_increase` | `SCALAR_18` per second per second | The acceleration of the rate, scaled down from this value by the skew fraction. |
| `funding_decrease` | `SCALAR_18` per second per second | The flat decay speed of the rate magnitude. Skew does not scale it. |
| `threshold_stable_funding` | `SCALAR_18` | The skew above which a same-direction rate keeps accelerating. |
| `threshold_decrease_funding` | `SCALAR_18` | The skew below which a same-direction rate decays. |
| `funding_min` | `SCALAR_18` per second | The floor on the charged rate magnitude. |
| `funding_max` | `SCALAR_18` per second | The cap on the stored rate magnitude, applied on both signs. |

`Config::check_valid` bounds all six. The ordering and the constant `MAX_FUNDING_RATE` are on [Config](./config.md).

## The saved rate

```rust
fn funding_rate(e: &Env, saved: i128, long_tokens: i128, short_tokens: i128, elapsed: i128, funding_increase: i128, funding_decrease: i128, threshold_stable: i128, threshold_decrease: i128, funding_max: i128) -> i128;
```

`funding_rate` returns the next stored rate (`SCALAR_18` per second, signed). `threshold_stable` and `threshold_decrease` are the config fields `threshold_stable_funding` and `threshold_decrease_funding`, passed under shorter parameter names. `saved` is the stored rate. `long_tokens` and `short_tokens` are the two sides of `MarketData.tokens` (base-dec). `elapsed` is the window in seconds. An `elapsed` at or below zero returns `saved` unchanged. A total of zero tokens returns `0`, so an empty market resets the rate.

The rate steers by the token skew, measured on the two base sizes:

```text
imbalance = long_tokens - short_tokens                          (base-dec, signed)
skew      = floor(|imbalance| * SCALAR_18 / total)              (SCALAR_18, in [0, SCALAR_18])
direction = signum(imbalance)                                   (+1 longs dominant, -1 shorts dominant, 0 balanced)
```

`total` is `long_tokens + short_tokens`, and `math::to_ratio_floor` computes `skew`. Because `|imbalance| <= total`, the skew sits between `0` and `SCALAR_18`. A one-sided book has a skew of `SCALAR_18`.

`same_direction` is true when `saved` and `direction` are both positive or both negative. A `saved` of zero is never same-direction. The window then picks one `RateChange`, and the first matching case wins:

| Condition | `RateChange` |
| --- | --- |
| `direction == 0` | `Hold` |
| `!same_direction` | `Increase` |
| `skew > threshold_stable` | `Increase` |
| `skew < threshold_decrease` | `Decrease` |
| every other case | `Hold` |

A fresh rate and a rate that opposes the dominant side both ramp, whatever the skew. Between the two thresholds a same-direction rate stands still. A token-balanced book holds the rate even inside the decay band, because the book names no side to steer toward.

Each variant produces `next` from `saved`, and `math::apply_factor_floor` computes `velocity`:

```text
Increase: velocity = floor(funding_increase * skew / SCALAR_18)  (SCALAR_18 per second per second)
          next     = saved + direction * velocity * elapsed      (SCALAR_18 per second)
Decrease: decay    = funding_decrease * elapsed                  (SCALAR_18 per second)
          next     = signum(saved)                     if |saved| <= decay
          next     = (|saved| - decay) * signum(saved) otherwise
Hold:     next     = saved
```

`funding_increase` and `funding_decrease` are `SCALAR_18` per second per second. `threshold_stable`, `threshold_decrease`, and `skew` are `SCALAR_18`. `saved`, `next`, `decay`, and `funding_max` are `SCALAR_18` per second, and `elapsed` is a plain seconds count. The return is `clamp(next, -funding_max, funding_max)`. A decay that overshoots parks at `+1` or `-1`, the smallest signed step, so the sign survives into the next window's `same_direction` test. A rate that opposes the dominant side moves toward that side by a whole `velocity * elapsed` step. That step can carry it across zero in one window. `direction` names the dominant side alone. The paying side is the sign of `next`. That sign can still oppose `direction` after the step.

## Accrual

```rust
pub fn accrue_funding(&mut self, e: &Env, elapsed: i128, config: &Config);
```

`MarketData::accrue_funding` evolves the rate and moves the two funding indices. An `elapsed` of zero returns at once, and the caller still stamps `accrued_at`. Otherwise the method runs in this order:

1. `funding_rate` sets `MarketData.funding_rate` from the stored rate, the two sides of `MarketData.tokens`, `elapsed`, and five config fields: `funding_increase`, `funding_decrease`, `threshold_stable_funding`, `threshold_decrease_funding`, and `funding_max`.
2. A rate of `0` returns. No index moves.
3. `longs_pay = funding_rate > 0` names the payer. `MarketData::accrue_funding` computes `rate_magnitude = max(|funding_rate|, funding_min)` (`SCALAR_18` per second) inline.
4. The method computes `pay_delta = rate_magnitude * elapsed` (`SCALAR_18`) inline as well. The payer's `funding_idx` rises by `pay_delta`.
5. `payer_notional` and `receiver_notional` are the two sides of `MarketData.notional` (token-dec). If `receiver_notional > 0`, the receiver's `funding_idx` falls by `recv_delta` (`SCALAR_18`), which `fixed_mul_floor` computes as `floor(pay_delta * payer_notional / receiver_notional)`.

`funding_min` floors the charge alone. A stored rate below `funding_min` charges at `funding_min`, and the stored value stays unfloored for the next window's velocity. Only a stored rate of exactly zero charges nothing.

The receiver credit spreads the paid total over the receiver's notional and rounds down, so the indices distribute at most what the payers owe. If the receiver's notional is zero, the paid funding stays in the credit pool as surplus.

The whole window charges at one rate, the rate that step 1 produced. The ramp inside the window is not integrated. The amount charged across a ramp or a decay therefore depends on how the elapsed time is cut into windows. The parked decay value at `+1` or `-1` is independent of that cut.

## Settlement into a position

```rust
fn settle_accruals(&mut self, e: &Env, market: &mut Market, user: &Address, is_long: bool) -> (i128, i128);
```

`Position::settle_accruals` banks both accrual legs against the position's stored snapshots and returns `(funding, borrowing)` (token-dec, `funding` signed). `is_long` picks the side whose indices the position settles against. `market` carries those indices and takes the credit-pool writes, and `user` keys the claimable balance. If the side's `funding_idx` and `borrowing_idx` both equal `Position.funding_idx` and `Position.borrowing_idx`, the call returns `(0, 0)` and touches nothing. A second settlement inside one call therefore banks nothing.

Otherwise `math::accrued_amount` prices each leg on the position's notional before the action changes it:

```text
funding   = ceil(notional * (side funding_idx   - Position.funding_idx)   / SCALAR_18)
borrowing = ceil(notional * (side borrowing_idx - Position.borrowing_idx) / SCALAR_18)
```

`notional` is `Position.notional` (token-dec). The side and position `funding_idx` and `borrowing_idx` are `SCALAR_18`. The borrowing index never falls, so `borrowing` is at or above zero. The funding index moves in both directions, so `funding` carries a sign. A positive `funding` is owed by the position. A negative `funding` is earned by it. The `ceil` on a negative delta rounds toward zero, so an earned amount rounds down in magnitude.

The two signs settle differently. A positive `funding` raises `MarketData.credit_pool` by that amount, and the position pays it through `Fees::debit`. A negative `funding` raises `MarketData.credit_owed` and `ClaimableCredit(user)` by `|funding|`, and the trader claims it later. `Fees::debit` takes `max(funding, 0)`, so an earned amount is credited and never debited. The call then sets both stored snapshots to the side indices.

`Position::increase` calls `settle_accruals` on the pre-fill notional, and `Position::settle` calls it for the decrease, close, liquidation, and validity paths. Both are on [Position lifecycle](./position-lifecycle.md). The `funding` and `borrowing` fields of `IncreaseFill`, `DecreaseFill`, `CloseFill`, and `Liquidation` carry these two amounts, under the payloads on [Events](./events.md). An open has no pre-fill notional, so both accruals are zero and `OpenFill` carries the fill amounts alone. The borrowing rate that moves the second index is on [Borrowing rate](./borrowing-rate.md).

## The credit pool

The market holds the funding tokens itself. `MarketData.credit_pool` (token-dec) is the ledger of what the contract holds against claims. `MarketData.credit_owed` (token-dec) is the total of every `ClaimableCredit(Address)` balance. The pool surplus is `credit_pool - credit_owed`. Five writers move the pair:

| Writer | `credit_pool` | `credit_owed` | `ClaimableCredit(user)` |
| --- | --- | --- | --- |
| Paid funding in `settle_accruals` | up by the paid amount | unchanged | unchanged |
| Earned funding in `settle_accruals` | unchanged | up by the earned amount | up by the earned amount |
| A failed direct payout in `pay_trader` | up by the payout amount | up by the payout amount | up by the payout amount |
| `claim_credit` | down by the paid amount | down by the paid amount | down by the paid amount |
| The surplus sweep in `retire` | down to `credit_owed` | unchanged | unchanged |

**Once every position realizes its accrued funding, `credit_pool >= credit_owed`.** Realization is lazy. A receiver that settles before its payer raises `credit_owed` with no matching inflow, so `credit_owed` can stand above `credit_pool` while positions are open. The empty book that retirement needs guarantees the realized state. `pay_trader` moves both totals by the same amount, so it leaves the surplus unchanged. The surplus is the funding that reached no receiver, plus three roundings that favor the pool. The `ceil` on a charge holds up to one token unit per settlement. The floor on the receiver credit holds back up to one `SCALAR_18` index unit per accrual. The round toward zero on an earned amount holds back up to one token unit per settlement. The [fees and settlement page](./fee-system.md) holds `pay_trader`, what makes a direct payout fail, and the rest of the settlement legs.

The surplus leaves the pool once. A transition to `Retired` transfers the surplus to the vault address. The [market status page](./status.md) holds that transition. The pool then backs `credit_owed` exactly, and a claim stays open on a retired market.

## Claim a credit balance

```rust
fn claim_credit(e: Env, user: Address) -> i128;
```

`user` is the only argument, and `user` must authorize the call. The call carries no price payload, so a claim advances no index. The return is the amount paid (token-dec).

- Errors, in this order: if `Status` is `Frozen`, `MarketFrozen` (704). If `min(ClaimableCredit(user), credit_pool) <= 0`, `NothingToClaim` (760). Every other status allows the call, `Retired` included.
- Amount: `amount = min(ClaimableCredit(user), MarketData.credit_pool)`. The pool caps the payout, and a remainder above it stays claimable.
- Effects: `ClaimableCredit(user)` falls by `amount`, `credit_pool` falls by `amount`, and `credit_owed` falls by `amount`. The market then transfers `amount` of the settlement token to `user`. A failed transfer traps the whole call.
- Storage read: `Status`, `MarketData`, `ClaimableCredit(user)`, `Token`. Written: `ClaimableCredit(user)`, `MarketData`.
- Event: `ClaimCredit`, with `user` as the topic and `amount` as the payload.

## Read a claimable balance

```rust
fn get_claimable_credit(e: Env, user: Address) -> i128;
```

`get_claimable_credit` needs no signer and raises no error. It returns the stored `ClaimableCredit(user)` balance (token-dec), or `0` when the entry is absent. Only a write through `add_claimable_credit` extends the entry's TTL. The tier and its TTL values are on [Storage](./storage.md).
