---
sidebar_position: 9
title: PnL and the profit cap
---

# PnL and the profit cap

`Position` holds `tokens` (base-dec) and `notional` (token-dec), and `MarketData` holds the same pair as a per-side aggregate. `MarketData` also holds `margin`, the posted margin per side (token-dec). Every profit and loss (PnL) number is derived from one of those pairs against the effective price of the call, and no profit figure is stored. Four symbols do that work:

- `math::pnl` marks one position.
- `MarketData::side_pnl` marks a whole side.
- `Market::haircut_pnl` caps a realized profit.
- `Market::capped_net_pnl` marks the book for the vault share price.

None of the four raises an error code of its own. Each one traps where a fixed-point helper below traps.

The [Pricing](./pricing.md) page gives how a call resolves that price.

## Fixed-point helpers

`engine::math` holds the shared fixed-point helpers. Each helper takes `&Env` as its first argument, omitted in the table below. `SCALAR_18` is `1_000_000_000_000_000_000`, the fixed-point representation of one.

| Symbol | Formula | Result unit |
| --- | --- | --- |
| `to_notional_floor(tokens, price)` | `floor(tokens * price / SCALAR_18)` | token-dec |
| `to_notional_ceil(tokens, price)` | `ceil(tokens * price / SCALAR_18)` | token-dec |
| `to_tokens(notional, price)` | `floor(notional * SCALAR_18 / price)` | base-dec |
| `apply_factor_floor(amount, factor)` | `floor(amount * factor / SCALAR_18)` | unit of `amount` |
| `apply_factor_ceil(amount, factor)` | `ceil(amount * factor / SCALAR_18)` | unit of `amount` |
| `half_factor(balance, factor)` | `floor((balance / 2) * factor / SCALAR_18)` | token-dec |
| `impact_fee(notional, impact_scalar)` | `min(ceil(notional * notional / impact_scalar), ceil(notional * MAX_IMPACT_RATE / SCALAR_18))` | token-dec |
| `to_ratio_floor(numerator, denominator)` | `floor(numerator * SCALAR_18 / denominator)` | `SCALAR_18` |
| `to_ratio_ceil(numerator, denominator)` | `ceil(numerator * SCALAR_18 / denominator)` | `SCALAR_18` |
| `pnl(tokens, notional, price, is_long)` | stated below | token-dec, signed |
| `prorate(amount, part, whole)` | `floor(amount * part / whole)` | unit of `amount` |
| `accrued_amount(notional, index_delta)` | `ceil(notional * index_delta / SCALAR_18)` | token-dec |

`tokens` is base-dec and `notional` is token-dec. In `to_notional_floor`, `to_notional_ceil` and `to_tokens`, `price` is one `PriceData` field in the feed's own precision. `pnl` takes the whole `PriceData` and selects the exit field itself. `balance` is the vault's `total_assets` (token-dec). `numerator` and `denominator` share one unit with each other. `factor`, `index_delta`, `MAX_IMPACT_RATE`, and every ratio are `SCALAR_18`. `impact_scalar` is token-dec. `part` and `whole` share one unit with each other, which need not be the unit of `amount`. The [Fee system](./fee-system.md) page gives the value of `MAX_IMPACT_RATE` and the fill size where the ceiling binds.

`floor` and `ceil` are the `SorobanFixedPoint` operations on `i128`. `floor` rounds toward negative infinity and `ceil` toward positive infinity, and both directions hold for a negative result. Each one traps on a zero denominator, and on a result outside `i128`. The `/ 2` inside `half_factor` is plain integer division, which truncates toward zero, so an odd balance drops its last unit before the factor applies. Each side of the book measures against its own half, so the two allowances sum to at most `factor * balance`.

## Per-position PnL

```rust
pub(crate) fn pnl(e: &Env, tokens: i128, notional: i128, price: &PriceData, is_long: bool) -> i128
```

For a long:

$$
\text{pnl} = \left\lfloor \frac{\text{tokens} \times \text{price.bid}}{\text{SCALAR\_18}} \right\rfloor - \text{notional}
$$

For a short:

$$
\text{pnl} = \text{notional} - \left\lceil \frac{\text{tokens} \times \text{price.ask}}{\text{SCALAR\_18}} \right\rceil
$$

`tokens` is the base size the position holds (base-dec). `notional` is the quote value paid for it (token-dec). `price.bid` and `price.ask` come from the effective `PriceData` of the call, in the feed's own precision. The result is signed token-dec. `to_tokens` sizes `tokens` as `floor(notional * SCALAR_18 / price)`, so a mark at any feed precision returns a token-dec value.

The mark reads the exit side of the spread, `PriceData::exit`, which is the bid for a long and the ask for a short. The long branch floors the marked value and the short branch ceils the closing cost, so the rounding runs against the trader on both branches. `Position::settle` marks the full size with it for every equity and maintenance measurement, and `Position::decrease` marks the closed slice on a partial close.

## The implied entry price

The entry price of a stored position is implied by the stored pair, as `notional` over `tokens` at the `SCALAR_18` scale, in the feed's own precision. No symbol computes it. `Position::increase` sizes each fill with `to_tokens` at the entry side of the spread, `PriceData::entry`, which is the ask for a long and the bid for a short. The implied entry carries that entry side, and the mark carries the exit side. A round trip at an unchanged quote books the full ask-to-bid crossing as a loss. No separate spread charge is taken.

Because only the pair is stored, successive increases blend on their own. Each fill adds its bought `tokens` and its paid `notional`, so the implied entry becomes the `tokens`-weighted mean of the fill prices. A partial close of `closed_notional` (token-dec) removes `prorate(tokens, closed_notional, position.notional)` from `tokens`, and `closed_notional` from `notional`. The implied entry of the remainder is unchanged, apart from the rounding down inside `prorate`.

## Per-side PnL

```rust
pub fn side_pnl(&self, e: &Env, price: &PriceData, is_long: bool, maximize: bool) -> i128
```

`MarketData::side_pnl` marks a whole side of the book from the `SidePair` aggregates `tokens` (base-dec) and `notional` (token-dec). `price.bid` and `price.ask` come from the effective `PriceData` of the call, in the feed's own precision. The result is signed token-dec.

| `is_long` | `maximize` | Marked value | Result |
| --- | --- | --- | --- |
| `true` | `true` | `to_notional_ceil(tokens.long, price.ask)` | value less `notional.long` |
| `true` | `false` | `to_notional_floor(tokens.long, price.bid)` | value less `notional.long` |
| `false` | `true` | `to_notional_floor(tokens.short, price.bid)` | `notional.short` less value |
| `false` | `false` | `to_notional_ceil(tokens.short, price.ask)` | `notional.short` less value |

The result is then floored at `-margin.get(is_long)`, the negated `MarketData` posted margin of that side (token-dec), because a paper loss past the posted margin cannot realize.

`maximize` selects which side of the spread and which rounding direction the caller wants. `maximize = true` reads the side's profit as high as the price allows. The profit cap below and the redeem gate on `execute_vault_order` measure at `maximize = true`. `update_adl_state` and `execute_adl` read the trigger for auto-deleveraging and the clear allowance at `maximize = true` as well. `maximize = false` reads the same profit as low as the price allows, and a deposit fill marks with it.

## The profit cap

```rust
pub fn haircut_pnl(&self, e: &Env, is_long: bool, pnl: i128) -> i128
```

`Market::haircut_pnl` scales a realized profit down while the winning side overhangs the vault. Both `pnl` and the return are token-dec. It runs in this order:

1. If `pnl <= 0`, return `pnl`. A loss is never scaled.
2. `side_pnl = data.side_pnl(price, is_long, maximize = true)`.
3. `cap = half_factor(vault_balance, config.max_pnl_trader)`.
4. If `side_pnl <= cap`, return `pnl`.
5. Otherwise return `prorate(pnl, cap, side_pnl)`, which is `floor(pnl * cap / side_pnl)`.

`vault_balance` is the vault's `total_assets`, read at load and tracked through the call (token-dec). `haircut_pnl` and `capped_net_pnl` take `cap` from the value as it stands when they run. `config.max_pnl_trader` is a `SCALAR_18` factor, and config validation rejects a value at or above `SCALAR_18`. So `cap` is that factor of half the vault balance, and it is one allowance per side.

A realized profit is measured on the book before the closing mutation. `Position::settle` and `Position::decrease` both apply the cap while the side still carries the size being closed. The survivor check in `Position::require_valid` settles again after the aggregates move, which re-prices the position and banks nothing. While the side's pending profit stays above `cap`, a trader who closes in slices re-reads a smaller overhang on each slice. The slices then pay that trader more in total than one close of the same size. Auto-deleveraging bounds how far the overhang can grow before the market forces it down. See [Auto-deleveraging](./auto-deleveraging.md).

`Position::settle` applies the cap to the full-size mark. `Position::decrease` applies it to the closed slice on a partial close. If the request clamps to a full close, `Position::decrease` returns the already capped full-size value from the gate settle. The `pnl` field on `DecreaseFill`, `CloseFill`, and `Liquidation` is the post-cap value.

## The vault mark

```rust
pub fn capped_net_pnl(&self, e: &Env, maximize: bool) -> i128
```

`Market::capped_net_pnl` returns the signed token-dec value the vault marks its shares against. It takes `cap = half_factor(vault_balance, config.max_pnl_trader)`, the same allowance the profit cap uses. `vault_balance` is the vault's `total_assets` (token-dec) and `config.max_pnl_trader` is a `SCALAR_18` factor. `capped_net_pnl` returns `min(side_pnl(long, maximize), cap) + min(side_pnl(short, maximize), cap)`.

The cap binds per side, and a losing side passes through at its margin-floored value, so the sum can be negative. `execute_vault_order` passes the result to the vault as the `net_pnl` argument of `strategy_deposit` and `strategy_redeem`. A deposit fill marks with `maximize = false` and a redeem fill marks with `maximize = true`. The value each one used rides out on `DepositFill.net_pnl` and `RedeemFill.net_pnl`. On a retired market `create_vault_order` redeems at once and publishes `RedeemFill` with id `0` and `net_pnl` `0`. `capped_net_pnl` does not run on that path.

## Fill price on receipts

`OpenFill`, `IncreaseFill`, `DecreaseFill`, `CloseFill` and `Liquidation` carry a `price` field, the execution price of that fill in the feed's own precision. `OpenFill` and `IncreaseFill` carry the entry side of the spread, `PriceData::entry`. `DecreaseFill`, `CloseFill` and `Liquidation` carry the exit side, `PriceData::exit`. `execute_adl` emits its decrease or close receipt at the same exit price.

On a close receipt, `notional` and `tokens` are the closed size at the position's own entry ratio, so the pair implies the entry price of the closed chunk. `price` is what the chunk closed at. A recomputation of `pnl` from those fields reproduces the emitted value only where the profit cap did not bind.
