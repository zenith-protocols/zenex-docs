---
sidebar_position: 11
title: Funding rate
description: Funding-rate evolution, payer and receiver indices, earned credit, and claims.
---

# Funding rate

Funding is a transfer between the two sides of the book. The market holds one signed rate, `MarketData.funding_rate` (`SCALAR_18` per second). A positive rate means longs pay shorts, and a negative rate means shorts pay longs. Each accrual window evolves the stored rate by the token skew, then charges the whole window at the evolved rate. Every paid amount lands in the credit pool, which funds the credits of the receiving side.

Funding moves in two stages. An accrual moves the payer index in `MarketData.funding_idx`, and it moves the receiver index when the receiving side holds notional. Both indices move for a whole side at once. A position change then settles the position's side index against the snapshot stored on the position. The position pays funding as a settled cost and earns funding as a claimable balance backed by the credit pool. This page holds the rate model, the funding indices, the settlement of both accrual legs into a position, the credit pool, and the claim entry.

The page uses four units. token-dec is the settlement token's decimals. base-dec is the `tokens` scale. `SCALAR_18` is `1_000_000_000_000_000_000`, and a per-second rate times a plain seconds count stays `SCALAR_18`. Seconds are a duration in whole seconds, measured on the unix ledger timestamp. The [units page](../units.md) gives the rounding helpers that `floor` and `ceil` name below.

The accrual clock belongs to the loader. `Market::load` computes `elapsed = now - MarketData.accrued_at`, runs `MarketData::accrue_borrowing`, then runs `MarketData::accrue_funding`, and stamps `accrued_at = now`. The [Pricing](./pricing.md) page gives the details. The [Config](./config.md) page gives the guard that ties a funding-parameter change to an accrued ledger.

## Six config fields set the rate

| Field | Unit | Meaning |
| --- | --- | --- |
| `funding_increase` | `SCALAR_18` per second per second | The acceleration of the rate at full skew. The skew fraction scales it down. |
| `funding_decrease` | `SCALAR_18` per second per second | The flat decay speed of the rate magnitude. Skew does not scale it. |
| `threshold_stable_funding` | `SCALAR_18` | The skew above which a same-direction rate keeps accelerating. |
| `threshold_decrease_funding` | `SCALAR_18` | The skew below which a same-direction rate decays. |
| `funding_min` | `SCALAR_18` per second | The floor on the charged rate magnitude. |
| `funding_max` | `SCALAR_18` per second | The cap on the stored rate magnitude, applied on both signs. |

`Config::check_valid` bounds all six. The [Config](./config.md) page gives the ordering rule and the constant `MAX_FUNDING_RATE`.

## Token skew decides how the stored rate evolves

```rust
fn funding_rate(e: &Env, saved: i128, long_tokens: i128, short_tokens: i128, elapsed: i128, funding_increase: i128, funding_decrease: i128, threshold_stable: i128, threshold_decrease: i128, funding_max: i128) -> i128;
```

`funding_rate` returns the next stored rate (`SCALAR_18` per second, signed). `threshold_stable` and `threshold_decrease` are the config fields `threshold_stable_funding` and `threshold_decrease_funding` under shorter parameter names. `saved` is the stored rate. `long_tokens` and `short_tokens` are the two sides of `MarketData.tokens` (base-dec). `elapsed` is the window in seconds.

If `elapsed` is zero or below, the function returns `saved` unchanged. If the two sides hold zero tokens in total, it returns `0`, so an empty market resets the rate. The reason is that an empty book has no skew to steer by.

The token skew measures how one-sided the book is, on the two base sizes:

```text
imbalance = long_tokens - short_tokens                          (base-dec, signed)
total     = long_tokens + short_tokens                          (base-dec)
skew      = floor(|imbalance| * SCALAR_18 / total)              (SCALAR_18, in [0, SCALAR_18])
direction = signum(imbalance)                                   (+1 longs dominant, -1 shorts dominant, 0 balanced)
```

`math::to_ratio_floor` computes `skew`. Because `|imbalance| <= total`, the skew sits between `0` and `SCALAR_18`. A one-sided book has a skew of `SCALAR_18`.

`same_direction` is true when `saved` and `direction` are both positive or both negative. A `saved` of zero is never same-direction. The window then picks one `RateChange`, and the first matching case wins.

| Condition | `RateChange` |
| --- | --- |
| `direction == 0` | `Hold` |
| `!same_direction` | `Increase` |
| `skew > threshold_stable` | `Increase` |
| `skew < threshold_decrease` | `Decrease` |
| every other case | `Hold` |

A fresh rate and a rate that opposes the dominant side both ramp, whatever the skew. Between the two thresholds, a same-direction rate stands still. A token-balanced book holds the rate even inside the decay band, because the book names no side to steer toward.

Each variant produces `next` from `saved`. The label `acceleration` names the intermediate value that the source holds in a local variable. `math::apply_factor_floor` computes it.

```text
Increase: acceleration = floor(funding_increase * skew / SCALAR_18)  (SCALAR_18 per second per second)
          next         = saved + direction * acceleration * elapsed   (SCALAR_18 per second)
Decrease: decay        = funding_decrease * elapsed                   (SCALAR_18 per second)
          next         = signum(saved)                     if |saved| <= decay
          next         = (|saved| - decay) * signum(saved) otherwise
Hold:     next         = saved
result = clamp(next, -funding_max, funding_max)
```

Where:

- `funding_increase` and `funding_decrease` are `SCALAR_18` per second per second.
- `threshold_stable`, `threshold_decrease`, and `skew` are `SCALAR_18`.
- `saved`, `next`, `decay`, and `funding_max` are `SCALAR_18` per second.
- `elapsed` is a plain seconds count.

A ramping rate gains `funding_increase * skew` per second in the direction of the heavier side. A decaying rate loses `funding_decrease` per second of its magnitude. A holding rate keeps its value. The clamp caps the result on both signs.

If `decay` is greater than or equal to `|saved|`, `next` is `signum(saved)`, which is `+1` or `-1`. This is the smallest signed step. The sign survives into the next window's `same_direction` test.

A rate that opposes the dominant side moves toward that side by a whole `acceleration * elapsed` step. That step can carry the rate across zero in one window.

`direction` names the dominant side alone. The paying side is the sign of `next`. That sign can still oppose `direction` after the step.

The rows below use example parameters, not deployed values: `funding_increase = 1_000_000_000`, `funding_decrease = 100_000_000`, `threshold_stable = 5 * 10^16` (5 percent), `threshold_decrease = 2 * 10^16` (2 percent), `funding_max = 80_000_000_000`, and `elapsed = 100`.

| `saved` | `long_tokens` | `short_tokens` | `skew` | `RateChange` | Result |
| --- | --- | --- | --- | --- | --- |
| `0` | `300` | `100` | `5 * 10^17` | `Increase`, because a zero rate is not same-direction | `50_000_000_000` |
| `50_000_000_000` | `300` | `100` | `5 * 10^17` | `Increase` | `80_000_000_000`, the clamp, from a `next` of `100_000_000_000` |
| `-20_000_000_000` | `300` | `100` | `5 * 10^17` | `Increase`, because the rate opposes the dominant side | `30_000_000_000`, which crosses zero |
| `80_000_000_000` | `101` | `99` | `10^16` | `Decrease` | `70_000_000_000` |
| `5_000_000_000` | `101` | `99` | `10^16` | `Decrease`, with `decay` of `10_000_000_000` | `1` |
| `80_000_000_000` | `100` | `100` | `0` | `Hold`, because `direction == 0` | `80_000_000_000` |

The three `Increase` rows share an `acceleration` of `500_000_000`, which is `floor(1_000_000_000 * 5 * 10^17 / 10^18)`. Over 100 seconds it moves the rate by `50_000_000_000`.

:::info Funding follows the stored rate
The current token imbalance does not identify the payer by itself. The rate can retain its sign while the imbalance reverses.
:::

## An accrual moves the payer index up and the receiver index down

```rust
pub fn accrue_funding(&mut self, e: &Env, elapsed: i128, config: &Config);
```

`MarketData::accrue_funding` evolves the rate and moves the two funding indices. If `elapsed` is zero, it returns at once and the caller still stamps `accrued_at`. Otherwise it runs in this order:

1. `funding_rate` sets `MarketData.funding_rate` from the stored rate, the two sides of `MarketData.tokens`, `elapsed`, and five config fields. These are `funding_increase`, `funding_decrease`, `threshold_stable_funding`, `threshold_decrease_funding`, and `funding_max`.
2. If `MarketData.funding_rate` is `0`, the method returns and no index moves.
3. `longs_pay = MarketData.funding_rate > 0` names the payer. The method computes `rate_magnitude = max(|MarketData.funding_rate|, funding_min)` (`SCALAR_18` per second) inline.
4. The method computes `pay_delta = rate_magnitude * elapsed` (`SCALAR_18`) inline. The payer's `funding_idx` rises by `pay_delta`.
5. `payer_notional` and `receiver_notional` are the two sides of `MarketData.notional` (token-dec). If `receiver_notional > 0`, the receiver's `funding_idx` falls by `recv_delta` (`SCALAR_18`).

```text
recv_delta = floor(pay_delta * payer_notional / receiver_notional)   (fixed_mul_floor)
```

`funding_min` floors the charge alone. A stored rate below `funding_min` charges at `funding_min`, and the stored value stays unfloored so the next window evolves from the true rate. Only a stored rate of exactly zero charges nothing.

The receiver credit spreads the paid total over the receiver's notional and rounds down. The indices therefore distribute at most what the payers owe. If the receiver's notional is zero, the paid funding stays in the credit pool as surplus.

Continue the ramp from the first row of the table above. The stored rate is `50_000_000_000`, `funding_min` is `1_000_000_000`, `elapsed` is `100`, the long notional is `3_000_000_000`, and the short notional is `1_000_000_000` (token-dec at 7 decimals).

| Quantity | Value |
| --- | --- |
| `longs_pay` | true |
| `rate_magnitude` | `max(50_000_000_000, 1_000_000_000)` = `50_000_000_000` |
| `pay_delta` | `5_000_000_000_000` |
| long `funding_idx` | up by `5_000_000_000_000` |
| `recv_delta` | `floor(5_000_000_000_000 * 3_000_000_000 / 1_000_000_000)` = `15_000_000_000_000` |
| short `funding_idx` | down by `15_000_000_000_000` |

The whole window charges at one rate, the rate that step 1 produced. The ramp inside the window is not integrated. The amount charged across a ramp or a decay therefore depends on how the elapsed time is cut into windows. The parked decay value at `+1` or `-1` is independent of that cut.

## A position banks both accrual legs against its snapshots

```rust
fn settle_accruals(&mut self, e: &Env, market: &mut Market, user: &Address, is_long: bool) -> (i128, i128);
```

`Position::settle_accruals` banks both accrual legs against the position's stored snapshots and returns `(funding, borrowing)` (token-dec, `funding` signed). `is_long` picks the side whose indices the position settles against. `market` carries those indices and takes the credit-pool writes. `user` keys the claimable balance.

If the side's `funding_idx` and `borrowing_idx` both equal `Position.funding_idx` and `Position.borrowing_idx`, the call returns `(0, 0)` and writes nothing. A second settlement inside one call therefore banks nothing. Otherwise `math::accrued_amount` prices each leg on the position's notional before the action changes it:

```text
funding   = ceil(notional * (side funding_idx   - Position.funding_idx)   / SCALAR_18)
borrowing = ceil(notional * (side borrowing_idx - Position.borrowing_idx) / SCALAR_18)
```

Where:

- `notional` is `Position.notional` (token-dec).
- The side and position `funding_idx` and `borrowing_idx` are `SCALAR_18`.
- `funding` and `borrowing` are token-dec, and `funding` is signed.

The borrowing index never falls, so `borrowing` is at or above zero. The funding index moves in both directions, so `funding` carries a sign. A positive `funding` is owed by the position, and a negative `funding` is earned by it. The `ceil` on a negative delta rounds toward zero, so an earned amount rounds down in magnitude. A payer never underpays and a receiver never over-claims.

The two signs settle differently. A positive `funding` raises `MarketData.credit_pool` by that amount, and the position pays it through `Fees::debit`. A negative `funding` raises `MarketData.credit_owed` and `ClaimableCredit(user)` by `|funding|`, and the trader claims it later. `Fees::debit` takes `max(funding, 0)`, so an earned amount is credited and never debited. The call then sets both stored snapshots to the side indices.

The rows below continue the accrual above, on a position whose snapshot is `0`.

| Position | `notional` | Index delta | `funding` | Effect |
| --- | --- | --- | --- | --- |
| Long payer | `3_000_000_000` | `+5_000_000_000_000` | `15_000` | `credit_pool` up by `15_000`, debited from the margin |
| Short receiver | `1_000_000_000` | `-15_000_000_000_000` | `-15_000` | `credit_owed` and `ClaimableCredit(user)` up by `15_000` |
| Short receiver | `333_333_333` | `-15_000_000_000_000` | `-4_999`, from a product of `-4_999.999995` | `credit_owed` and `ClaimableCredit(user)` up by `4_999` |

`Position::increase` calls `settle_accruals` on the pre-fill notional. `Position::settle` calls it on the decrease, close, and liquidation paths, and on the fourth check of `Position::require_valid`. That check re-prices the survivor and banks nothing, because the snapshots already equal the side indices. The [Position lifecycle](./position-lifecycle.md) page and the [Margin and leverage](./margin-and-leverage.md) page give those paths.

The `funding` and `borrowing` fields of `IncreaseFill`, `DecreaseFill`, `CloseFill`, and `Liquidation` carry these two amounts. The [Events](./events.md) page gives the payloads. An open has no pre-fill notional, so both accruals are zero and `OpenFill` carries the fill amounts alone. The [Borrowing rate](./borrowing-rate.md) page gives the rate that moves the second index.

## The credit pool backs every earned balance

The market holds the funding tokens itself. `MarketData.credit_pool` (token-dec) is the ledger of what the contract holds against claims. `MarketData.credit_owed` (token-dec) is the total of every `ClaimableCredit(Address)` balance. The pool surplus is `credit_pool - credit_owed`. Five writers move the pair.

| Writer | `credit_pool` | `credit_owed` | `ClaimableCredit(user)` |
| --- | --- | --- | --- |
| Paid funding in `settle_accruals` | up by the paid amount | unchanged | unchanged |
| Earned funding in `settle_accruals` | unchanged | up by the earned amount | up by the earned amount |
| A payout in `pay_trader` whose direct transfer fails | up by the payout amount | up by the payout amount | up by the payout amount |
| `claim_credit` | down by the paid amount | down by the paid amount | down by the paid amount |
| The surplus sweep in `retire` | down to `credit_owed` | unchanged | unchanged |

`pay_trader` runs for the trader leg of a settlement and for the refund of a rejected deposit order. The [Fees and settlement](./fee-system.md) page gives what makes a direct payout fail and the rest of the settlement legs.

**Once every position realizes its accrued funding, `credit_pool >= credit_owed`.** Realization is lazy. A receiver that settles before its payer raises `credit_owed` with no matching inflow, so `credit_owed` can stand above `credit_pool` while positions are open. The empty book that retirement needs guarantees the realized state. `pay_trader` moves both totals by the same amount, so it leaves the surplus unchanged.

The surplus is the funding that reached no receiver, plus three roundings that favor the pool:

- The `ceil` on a charge holds up to one token unit per settlement.
- The floor on the receiver credit holds back up to one `SCALAR_18` index unit per accrual.
- The round toward zero on an earned amount holds back up to one token unit per settlement.

The surplus leaves the pool once. A transition to `Retired` runs `retire`, which requires an empty book and transfers the surplus to the vault address. A transfer larger than the contract's token balance traps, and the transition reverts. The pool then backs `credit_owed` exactly, and a claim stays open on a retired market. The [Market status](./status.md) page gives that transition.

:::info Earned funding becomes claimable credit
Earned funding increases `ClaimableCredit(user)`. It does not increase position margin. `claim_credit` can pay less than the stored balance when the pool lacks realized funding.
:::

## `claim_credit` pays the smaller of the balance and the pool

```rust
fn claim_credit(e: Env, user: Address) -> i128;
```

`user` is the only argument, and `user` must authorize the call. The return is the amount paid (token-dec). `claim_credit` does not load the market, so a claim runs no accrual and moves no index. It opens with `extend_instance`, and the gates then run in this order.

| Step | Condition | Error |
| --- | --- | --- |
| 1 | `user` does not authorize | The host authorization failure |
| 2 | `Status` is `Frozen` | `MarketFrozen` (704) |
| 3 | `min(ClaimableCredit(user), MarketData.credit_pool) <= 0` | `NothingToClaim` (760) |

Every other status allows the call, `Retired` included. The amount is `min(ClaimableCredit(user), MarketData.credit_pool)`. The pool caps the payout, and a remainder above the cap stays claimable.

`ClaimableCredit(user)`, `credit_pool`, and `credit_owed` each fall by the amount. The market then transfers the amount of the settlement token to `user`. A failed transfer traps the whole call and reverts the balance writes.

The call reads `Status`, `MarketData`, `ClaimableCredit(user)`, and `Token`. It writes `ClaimableCredit(user)` and `MarketData`. The write to `ClaimableCredit(user)` extends the entry's time-to-live. The call publishes `ClaimCredit`, with `user` as the topic and `amount` as the payload.

## `get_claimable_credit` reads the stored balance

```rust
fn get_claimable_credit(e: Env, user: Address) -> i128;
```

`get_claimable_credit` is a view that takes no signature and has no error path. It returns the stored `ClaimableCredit(user)` balance (token-dec), or `0` when the entry is absent. Only a write through `add_claimable_credit` extends the entry's time-to-live. The [Storage](./storage.md) page gives the tier and its time-to-live values.

The balance holds earned funding and any parked payout. It can stand above what `claim_credit` pays, because the pool caps each claim.
