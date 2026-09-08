---
sidebar_position: 12
title: Borrowing rate
---

# Borrowing rate

Borrowing is a charge on the side of the market that holds the greater base-token exposure. A token tie charges both sides. The charge pays for the vault liquidity that the side's open positions reserve. No side receives it. The rate is a kink curve over that side's own reserve utilization, priced per second in `SCALAR_18`. The [fees and settlement](./fee-system.md) page gives the treasury and vault split of the collected amount.

Borrowing moves in two stages. An accrual raises one or both sides of `MarketData.borrowing_idx`, for whole sides at once. A position change then settles the index of the position's own side against the snapshot in the `Position` row. It debits the charge from margin. This page holds the side reserve, the utilization, the kink rate, and the accrual. The [funding rate](./funding-rate.md) page holds the settlement of an index into a position.

Five units appear on this page. token-dec is the settlement token's decimals. base-dec is the `tokens` scale. Feed precision is the price feed's own scale. `SCALAR_18` is fixed-point one. Seconds are a duration in whole seconds, measured on the unix ledger timestamp. A per-second `SCALAR_18` rate times a plain seconds count stays `SCALAR_18`. The [units page](../units.md) defines the rounding helpers `floor` and `ceil` that the formulas below name.

`Market::load` owns the accrual clock and calls `MarketData::accrue_borrowing`. The clock is on [Pricing](./pricing.md). The guard that ties a borrowing-parameter change to an accrued ledger is on [Config](./config.md).

## The config fields

| Field | Unit | Meaning |
| --- | --- | --- |
| `max_util_open` | `SCALAR_18` | The capacity factor for each side's borrow reserve, applied to half the vault balance. It is also the reserve cap. After an increase fill that adds notional, each side's reserve must fit within this factor of half the tracked balance, which the fill's settlement has already moved. A margin-only top-up reserves nothing and skips that check. |
| `target_util` | `SCALAR_18` | The kink utilization, below `SCALAR_18`. |
| `borrow_rate` | `SCALAR_18` per second | The slope of the linear leg, which is that leg's rate at full utilization. |
| `increased_borrow_rate` | `SCALAR_18` per second | The total rate at full utilization, in `[borrow_rate, MAX_BORROW_RATE]`. |

`Config::check_valid` bounds all four. None may be negative. `MAX_UTIL` caps `max_util_open` and `MAX_BORROW_RATE` caps `increased_borrow_rate`. Both constants are on [Config](./config.md). `target_util` stays strictly below `SCALAR_18`, and `borrow_rate` may not exceed `increased_borrow_rate`.

## The side reserve

```rust
pub fn side_reserved(&self, e: &Env, price: &PriceData, is_long: bool) -> i128;
```

`MarketData::side_reserved` returns the value the vault stands behind on one side (token-dec). It raises no `MarketError`, and its only failure is an arithmetic trap. The two sides measure it differently:

```text
long  = to_notional_ceil(tokens.long, price.ask)
      = ceil(tokens.long * price.ask / SCALAR_18)   (token-dec)
short = notional.short                              (token-dec)
```

`MarketData.tokens` is base-dec and `price.ask` is at feed precision. Base-dec pairs with a price only through `SCALAR_18`, so the long mark returns token-dec. It rounds up, which overstates the reserve. `notional.short` is `MarketData.notional.short`, the short side's open interest in token-dec. Each short's payout is bounded by that position's entry notional, so the side's open interest bounds the side.

## Utilization

```rust
fn side_utilization(e: &Env, side_reserved: i128, max_util_open: i128, vault_balance: i128) -> i128;
```

```text
capacity = floor((vault_balance / 2) * max_util_open / SCALAR_18)   (token-dec)
```

`side_utilization` divides a side's reserve by that capacity. It raises no `MarketError`, and its only failure is an arithmetic trap. `side_reserved` is token-dec and comes from `MarketData::side_reserved`. `max_util_open` is the `SCALAR_18` config factor. `vault_balance` is the vault's `total_assets` in token-dec, read once at load before any settlement in the call. `half_factor` computes the capacity from the last two. The division by two truncates toward zero first, then the multiplication by `max_util_open` floors. Each side measures against its own half of the balance, so the two side capacities sum to at most `max_util_open` of the whole balance.

```text
u = 0                                                  if side_reserved <= 0
u = SCALAR_18                                          if capacity == 0
u = min(ceil(side_reserved * SCALAR_18 / capacity),
        SCALAR_18)                                     otherwise
```

The result is a `SCALAR_18` ratio in `[0, SCALAR_18]`, and `to_ratio_ceil` computes the quotient. A side that reserves nothing reads as zero utilization even against an empty vault. A positive reserve against zero capacity reads as full. A reserve above its capacity clamps to full. The capacity floors and the quotient ceils, so both roundings move toward a higher rate.

## The kink rate

```rust
fn borrowing_rate(e: &Env, utilization: i128, target_util: i128, borrow_rate: i128, increased_borrow_rate: i128) -> i128;
```

`borrowing_rate` maps a utilization to the per-second rate (`SCALAR_18`). It raises no `MarketError`, and its only failure is an arithmetic trap. The formula below writes the `utilization` argument as `u`. It is the `SCALAR_18` ratio from `side_utilization`, in `[0, SCALAR_18]`. `borrow_rate` and `increased_borrow_rate` are the config rates, in `SCALAR_18` per second. `target_util` is the config kink ratio, a `SCALAR_18` value below `SCALAR_18`.

```text
base = ceil(borrow_rate * u / SCALAR_18)

rate = base                                                          if u <= target_util
rate = base + ceil((increased_borrow_rate - borrow_rate)
                   * (u - target_util) / (SCALAR_18 - target_util))  otherwise
```

`apply_factor_ceil` computes `base`, the linear leg. Below the kink that leg is the whole rate, and a utilization exactly at `target_util` takes this branch. Above the kink a second leg blends in. Its numerator is the gap between the two configured rates, and it ramps from zero to one over the band `SCALAR_18 - target_util`. At `u == SCALAR_18` the excess equals the span, so the two legs sum to exactly `increased_borrow_rate`. Both ceils round toward a higher rate.

## Accrual

```rust
pub fn accrue_borrowing(
    &mut self,
    e: &Env,
    elapsed: i128,
    price: &PriceData,
    config: &Config,
    vault_balance: i128,
);
```

`MarketData::accrue_borrowing` advances the two side indices. It raises no `MarketError`, and its only failure is an arithmetic trap. `elapsed` is the window in seconds. `price` is the mark `Market::load` carries. `config` holds the four fields above. `vault_balance` is token-dec. If `elapsed` is zero, the call returns at once. The caller still stamps `accrued_at`. Otherwise the method visits both sides in turn.

`accrue_borrowing` skips a side whose `MarketData.tokens` count is strictly less than the other side's, and that side accrues nothing. Every other side computes its own `side_reserved` at the loaded `price`, its own utilization against `max_util_open` and `vault_balance`, and its own rate. A token tie charges both sides, each at the rate from its own utilization. `rate` below is that per-second `SCALAR_18` value from `borrowing_rate`. The accrual then adds to that side of `MarketData.borrowing_idx`:

```text
borrowing_idx[side] += rate * elapsed   (SCALAR_18)
```

`borrowing_idx` never falls. A skipped side keeps its value, and a zero rate holds the index flat. Zero utilization gives a zero rate, and so does a configured `borrow_rate` and `increased_borrow_rate` of zero. An empty market ties at zero tokens and reserves nothing on both sides. Both rates then come out of zero utilization, so neither index moves.
