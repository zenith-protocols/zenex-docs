---
title: Units and scales
sidebar_position: 2
---

# Units and scales

This page covers the scale of every integer the contracts store or return, how a price meets a size, and how a result rounds. Every other technical page names a unit next to an argument, a field, or a formula, and means what this page says.

Every amount in the contracts is an integer. The unit fixes what one step of that integer is worth, and the helper that computes it fixes how the last digit rounds. A wrong scale moves money by a power of ten, so each unit has one name and the pages use only these names.

## The six units

| Unit | One step is | Used for |
|---|---|---|
| token-dec | The smallest indivisible amount of the settlement token, `10^-d` of one token for `d` decimals. A Stellar classic asset such as USDC has 7 decimals. | Notional, margin, fees, profit and loss, escrow, credit balances, and vault assets. `impact_scalar`, the denominator of the impact fee, is token-dec as well. |
| share-dec | One indivisible vault share. Share decimals are the settlement token's decimals plus the vault's `decimals_offset`. | Share balances and every share amount that a vault order or fill carries. |
| price (18 decimals) | `10^-18` of the quote currency. Chainlink Data Streams V3 reports carry `bid` and `ask` at this scale, and the oracle keeps it without rescaling. Pages that say "feed precision" mean this scale. | Every price. This covers the oracle's bid and ask, an order's trigger and bound, the terminal price, and the price on every fill event. |
| `SCALAR_18` | `10^-18`, so `SCALAR_18` itself is 100%. | Every rate, ratio, and cumulative index. A borrowing or funding rate is `SCALAR_18` per second. |
| seconds | One unix second from the ledger timestamp. | Order and accrual timestamps, staleness windows, lock windows, the delist windows, and the governance delay. |
| ledger sequence | One ledger, 5 seconds on average. One day is 17280 ledgers. | Order expiry, allowance and ownership-transfer deadlines, and every storage time-to-live. |

The oracle's `reduce_spread` moves `bid` and `ask` toward the midpoint and leaves the scale at 18 decimals. A market's `feed_id` is immutable, so every price on a market comes from one stream at one scale.

## Size in the base asset

A base-asset size is held as `tokens` on a position or a side. Pages that say "base-dec" mean this scale. Base-dec uses the same decimal count as the settlement token, but it counts the base asset and not the settlement token. Four market helpers convert between a notional and a size.

```
tokens   = to_tokens_floor(notional, price)  = floor(notional * SCALAR_18 / price)
tokens   = to_tokens_ceil(notional, price)   = ceil(notional * SCALAR_18 / price)
notional = to_notional_floor(tokens, price)  = floor(tokens * price / SCALAR_18)
notional = to_notional_ceil(tokens, price)   = ceil(tokens * price / SCALAR_18)
```

`notional` is token-dec, `price` is an 18-decimal integer, and `tokens` is base-dec. The price carries 18 decimals and `SCALAR_18` is `10^18`, so the decimals cancel and `tokens` keeps the settlement token's decimals.

An increase sizes a long with `to_tokens_floor` and a short with `to_tokens_ceil`, so the size rounds against the trader on both sides. The [position lifecycle](./market/position-lifecycle.md#an-increase-buys-size-at-the-entry-side) page gives the entry path and the `SizeRoundsToZero` (716) check.

The rows below use a 7-decimal settlement token, a notional of `1_000_000_000` (100 tokens), and a price of 3 quote units, which is `3 * 10^18`.

| Computation | Result | Unit |
|---|---|---|
| `to_tokens_floor(1_000_000_000, 3 * 10^18)` | `333_333_333` | base-dec |
| `to_tokens_ceil(1_000_000_000, 3 * 10^18)` | `333_333_334` | base-dec |
| `to_notional_floor(333_333_334, 3 * 10^18)` | `1_000_000_002` | token-dec |
| `to_notional_floor(333_333_333, 3 * 10^18)` | `999_999_999` | token-dec |

The price does not divide the notional evenly, so the floored size is worth 1 token-dec unit less than the notional and the ceiled size is worth 2 units more. The direction chosen decides which side of the notional the size lands on.

## How a result rounds

A multiplication followed by a division is always one of four fixed-point helpers. They come from the `SorobanFixedPoint` trait of our `soroban-fixed-point-math` fork, implemented for `i128`. Each takes `&Env` beside the receiver.

| Helper | Computes | Rounds |
|---|---|---|
| `fixed_mul_floor(&self, env, y, denominator)` | `self * y / denominator` | Toward negative infinity |
| `fixed_mul_ceil(&self, env, y, denominator)` | `self * y / denominator` | Toward positive infinity |
| `fixed_div_floor(&self, env, y, denominator)` | `self * denominator / y` | Toward negative infinity |
| `fixed_div_ceil(&self, env, y, denominator)` | `self * denominator / y` | Toward positive infinity |

The argument `y` is the multiplier of a mul helper and the divisor of a div helper. The argument `denominator` is the scale. For example, `notional.fixed_div_floor(&price, &SCALAR_18)` is `floor(notional * SCALAR_18 / price)`. A technical page that writes `floor(a * b / c)` or `ceil(a * b / c)` means one of these helpers, named beside the formula.

Floor rounds toward negative infinity and ceil toward positive infinity, also on a negative result. A product of `-7` over a denominator of `2` gives `-4` under floor and `-3` under ceil. The helper carries no unit of its own. The result has the unit of the two multiplied values divided by the unit of the divisor. A `SCALAR_18` rate times a token-dec amount over `SCALAR_18` is therefore token-dec again.

The market wraps the helpers in a small set of named functions, so a formula on another page can name the wrapper and leave the arithmetic here.

| Function | Computes | Unit of the result |
|---|---|---|
| `apply_factor_floor` | `floor(amount * factor / SCALAR_18)`, used for a cut or a cap | The unit of `amount` |
| `apply_factor_ceil` | `ceil(amount * factor / SCALAR_18)`, used for a charge | The unit of `amount` |
| `to_ratio_floor` | `floor(numerator * SCALAR_18 / denominator)` | `SCALAR_18` fraction |
| `to_ratio_ceil` | `ceil(numerator * SCALAR_18 / denominator)` | `SCALAR_18` fraction |
| `prorate` | `floor(amount * part / whole)` | The unit of `amount` |
| `accrued_amount` | `ceil(notional * index_delta / SCALAR_18)` | token-dec |
| `half_factor` | `floor((balance / 2) * factor / SCALAR_18)` | token-dec |

The wrappers document floor for a cut or a cap and ceil for a charge. In `to_ratio_floor` and `to_ratio_ceil`, `numerator` and `denominator` share one unit. In `prorate`, `part` and `whole` share one unit, which need not be the unit of `amount`. The fee ceiling helper `impact_fee` is on the [fee system](./market/fee-system.md) page. Each computation on the pages that follow names its own helper and direction.

## Truncating halves

Two places halve a value with plain integer division, which truncates toward zero. Both truncate before any factor applies.

`half_factor` measures against half the vault balance. It sizes the trader profit cap, the auto-deleveraging (ADL) band, each side's capacity for utilization, and the withdraw allowance. The value `balance / 2` truncates first, and then the factor floors.

The oracle's `reduce_spread` computes the half spread `(ask - bid) / 2` with the same truncation, then floors the cut. Both sides move inward by the same amount, except at a factor of `SCALAR_18`, which puts both on `bid + (ask - bid) / 2`. The spread narrows by at most the configured factor and often a little less.

## Overflow

A helper first multiplies in `i128`. If that product overflows, the helper repeats it at 256 bits. The helper traps on a zero divisor and on a result that does not fit `i128`.

Every other addition, subtraction, and multiplication on `i128` is checked and traps on overflow. Where config validation and order validation check a sum or a product themselves, the failure surfaces as `InvalidConfig` or `InvalidOrder` instead. A share mint that would overflow the total supply traps with the share token's `MathOverflow` (104).

Arithmetic on seconds saturates where the contracts compare a window. That covers the staleness checks, the delist windows, and the redeem lock. Everywhere else it is checked. A trap reverts the invocation it happens in. The router isolates a failing fill or call in its own entry points, which the [batching](./router/batching.md) page describes.
