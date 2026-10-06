---
sidebar_position: 9
title: PnL and the profit cap
description: Position and side marks, rounding, profit haircuts, and capped vault marks.
---

# PnL and the profit cap

Profit and loss (PnL) is the gain or loss of a position measured against the current price. The market stores no profit figure. It derives every PnL number from a stored size and the effective price of the call. The vault pays the winners, so a winning side could otherwise claim more than the vault holds. The profit cap scales a realized profit down before that can happen.

A position mark values a size at the exit side of the quote, which is the bid for a long and the ask for a short. A side mark picks its side of the quote with `maximize`. The effective price is the quote that a call resolves. The [Pricing](./pricing.md) page gives that resolution. The [Units and scales](../units.md) page defines token-dec, base-dec, and `SCALAR_18`.

Four symbols do the work:

- `math::pnl` marks one position.
- `MarketData::side_pnl` marks a whole side.
- `Market::haircut_pnl` caps a realized profit.
- `Market::capped_net_pnl` marks the book for the vault share price.

Every mark reads one stored pair. `Position` holds `tokens` (base-dec) and `notional` (token-dec). `MarketData` holds the same pair per side, and it holds `margin`, the posted margin per side (token-dec). The four symbols fail only where a fixed-point helper traps.

## The shared helpers set every rounding

The `math` module holds the fixed-point helpers that every formula on this page names. The [Units and scales](../units.md#how-a-result-rounds) page defines `to_notional_floor`, `to_notional_ceil`, `to_tokens_floor`, `to_tokens_ceil`, `apply_factor_floor`, `apply_factor_ceil`, `half_factor`, `to_ratio_floor`, `to_ratio_ceil`, `prorate`, and `accrued_amount`, with their units and rounding direction. The [Fee system](./fee-system.md) page defines `impact_fee`. The [Position marks](#a-position-marks-at-the-exit-side-of-the-quote) section defines `pnl`.

In every mark below, `tokens` is base-dec, `notional` is token-dec, and `price` is one `PriceData` field, an 18-decimal integer. `balance` is the vault's `total_assets` (token-dec), and every ratio is `SCALAR_18`.

## A position marks at the exit side of the quote

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

Where:

- `tokens` is the base size the position holds (base-dec).
- `notional` is the quote value paid for that size (token-dec).
- `price.bid` and `price.ask` come from the effective `PriceData` of the call (18 decimals).
- The result is signed token-dec.

`pnl` takes the whole `PriceData` and selects the exit field itself. The mark is the value of the size at the exit price, less what the position paid for it. A long floors the marked value and a short ceils the closing cost, so the rounding runs against the trader on both branches.

The exit side is `PriceData::exit`, the bid for a long and the ask for a short. `Position::settle` marks the full size with it for every equity and maintenance measurement, and `Position::liquidate` reuses that settle. `Position::decrease` marks the closed slice on a partial close.

| Side | Entry quote | Exit quote | `tokens` (base-dec) | `pnl` (units) | `pnl` (token-dec) |
| --- | --- | --- | --- | --- | --- |
| Long | ask 10.00 | bid 12.00 | `100000000` | +20.0 | `200000000` |
| Long | ask 10.00 | bid 10.00 | `100000000` | 0.0 | `0` |
| Long | ask 10.00 | bid 9.00 | `100000000` | -10.0 | `-100000000` |
| Short | bid 10.00 | ask 9.00 | `100000000` | +10.0 | `100000000` |
| Short | bid 10.00 | ask 11.00 | `100000000` | -10.0 | `-100000000` |
| Long, quote unchanged | ask 10.10 | bid 9.90 | `99009900` | -1.9801990 | `-19801990` |
| Short, quote unchanged | bid 9.90 | ask 10.10 | `101010102` | -2.0202031 | `-20202031` |

Every row opens 100.0 of notional on a 7-decimal settlement token, so `notional` is `1000000000`. The last two rows show a round trip at an unchanged quote. The position pays the whole ask-to-bid crossing as a loss.

## The entry price is implied by the stored pair

The entry price of a stored position is `notional` over `tokens`, scaled by `SCALAR_18`. The market derives it from the pair and never stores it. `Position::increase` sizes each fill at the entry side of the spread, `PriceData::entry`, which is the ask for a long and the bid for a short. A long uses `to_tokens_floor` and a short uses `to_tokens_ceil`.

Entry sizing rounds against the trader, like the mark. The [Position lifecycle](./position-lifecycle.md#an-increase-buys-size-at-the-entry-side) page gives the reason. The implied entry uses the entry quote and the mark uses the exit quote. The price mark therefore includes the full spread cost of a round trip.

Only the pair is stored, so successive increases blend on their own. Each fill adds its bought `tokens` and its paid `notional`, and the implied entry becomes the `tokens`-weighted mean of the fill prices. A partial close of `closed_notional` (token-dec) removes `prorate(tokens, closed_notional, position.notional)` from `tokens` and `closed_notional` from `notional`. The implied entry of the remainder is unchanged, apart from the rounding down inside `prorate`.

## A side marks from its aggregates

```rust
pub fn side_pnl(&self, e: &Env, price: &PriceData, is_long: bool, maximize: bool) -> i128
```

`MarketData::side_pnl` marks a whole side of the book from the `SidePair` aggregates `tokens` (base-dec) and `notional` (token-dec). `price.bid` and `price.ask` come from the effective `PriceData` of the call (18 decimals). The result is signed token-dec.

| `is_long` | `maximize` | Marked value | Result |
| --- | --- | --- | --- |
| `true` | `true` | `to_notional_ceil(tokens.long, price.ask)` | value less `notional.long` |
| `true` | `false` | `to_notional_floor(tokens.long, price.bid)` | value less `notional.long` |
| `false` | `true` | `to_notional_floor(tokens.short, price.bid)` | `notional.short` less value |
| `false` | `false` | `to_notional_ceil(tokens.short, price.ask)` | `notional.short` less value |

The result is then floored at `-margin.get(is_long)`, the negated `MarketData` posted margin of that side (token-dec). A paper loss past the posted margin cannot realize, so a side's loss never counts for more than its posted margin.

`maximize` selects the side of the spread and the rounding direction. `maximize = true` reads the side's profit as high as the quote allows, and `maximize = false` reads it as low as the quote allows. These callers read the high mark:

- `Market::haircut_pnl`, for the profit cap.
- `Market::capped_net_pnl`, on a redeem fill.
- The redeem gate on `execute_vault_order`, which compares each side with `max_pnl_withdraw` of half the remaining balance.
- `update_adl_state` and `execute_adl`, for the trigger and the clear allowance of auto-deleveraging (ADL).

A deposit fill reads the low mark through `Market::capped_net_pnl`. Both marks favor the vault's existing shareholders.

The rows below use one quote, bid 9.00 and ask 11.00. The long holds 2 base units at notional 20.0 on margin 10.0. The short holds 0.5 base units at notional 5.0 on margin 3.0.

| Side | `maximize` | Marked value | `side_pnl` (units) |
| --- | --- | --- | --- |
| Long | `true` | 22.0 at the ask | +2.0 |
| Long | `false` | 18.0 at the bid | -2.0 |
| Short | `true` | 4.5 at the bid | +0.5 |
| Short | `false` | 5.5 at the ask | -0.5 |

If the long's margin is 1.0, the low mark of -2.0 reads -1.0.

## The profit cap scales a winner down to the vault's allowance

```rust
pub fn haircut_pnl(&self, e: &Env, is_long: bool, pnl: i128) -> i128
```

`Market::haircut_pnl` scales a realized profit down while the winning side overhangs the vault. Both `pnl` and the return are token-dec. It runs in this order:

1. If `pnl <= 0`, return `pnl`. A loss is never scaled.
2. `side_pnl = data.side_pnl(price, is_long, maximize = true)`.
3. `cap = half_factor(vault_balance, config.max_pnl_trader)`.
4. If `side_pnl <= cap`, return `pnl`.
5. Otherwise return `prorate(pnl, cap, side_pnl)`, which is `floor(pnl * cap / side_pnl)`.

Where:

- `vault_balance` is the vault's `total_assets`, read at load and tracked through the call (token-dec).
- `config.max_pnl_trader` is a `SCALAR_18` factor. Config validation rejects a value at or above `SCALAR_18` with `InvalidConfig` (700), and the [Config](./config.md#validation-rules) page gives the ladder of bounds it sits in.
- `cap` is that factor of half the vault balance (token-dec), one allowance per side.
- `side_pnl` is the pending profit of the closing side at the high mark (token-dec).

While the side's pending profit stays above `cap`, every realized profit on that side pays the fraction `cap / side_pnl`. `haircut_pnl` and `capped_net_pnl` take `cap` from the vault balance as it stands when they run.

The rows below use a long side with a pending profit of 20.0 and a `max_pnl_trader` of 90%.

| Vault balance | `cap` | Realized `pnl` | Paid |
| --- | --- | --- | --- |
| 100.0 | 45.0 | 5.0 | 5.0, because `side_pnl` is at or below `cap` |
| 10.0 | 4.5 | 5.0 | 1.125 |
| 10.0 | 4.5 | 20.0 | 4.5 |
| 10.0 | 4.5 | -5.0 | -5.0, because a loss is never scaled |

A realized profit is measured on the book before the closing mutation. `Position::settle` and `Position::decrease` both apply the cap while the side still carries the size being closed. The survivor check in `Position::require_valid` settles again after the aggregates move. That settle re-prices the position and banks nothing.

`Position::settle` applies the cap to the full-size mark. `Position::decrease` applies it to the closed slice on a partial close. If the request clamps to a full close, `Position::decrease` returns `close_settled` with the value from the `Position::settle` call that opened it. That value is already capped, so no second cap applies. The `pnl` field on `DecreaseFill`, `CloseFill`, and `Liquidation` is the post-cap value.

Each slice of a close reads a smaller overhang than the last, so slicing partly escapes the cap. The 20.0 profit above pays 4.5 in one close. Four quarter slices pay 1.125, 1.33125, 1.6973437, and 2.6308827, which total 6.7844764. Each slice lowers the side's pending profit and the vault balance before the next one. ADL bounds how far the overhang can grow, and the [Auto-deleveraging](./auto-deleveraging.md) page gives that bound.

## The vault mark sums both capped sides

```rust
pub fn capped_net_pnl(&self, e: &Env, maximize: bool) -> i128
```

`Market::capped_net_pnl` returns the signed token-dec value the vault marks its shares against. It takes `cap = half_factor(vault_balance, config.max_pnl_trader)`, the allowance the profit cap uses. `vault_balance` is the vault's `total_assets` (token-dec) and `config.max_pnl_trader` is a `SCALAR_18` factor. The return is:

```text
min(side_pnl(long, maximize), cap) + min(side_pnl(short, maximize), cap)
```

The cap binds per side. A losing side passes through at its margin-floored value, so the sum can be negative. With a `cap` of 18.0, a long side at +30.0 counts 18.0 and a short side at -5.0 counts -5.0, so the mark is 13.0.

`execute_vault_order` passes the result to the vault as the `net_pnl` argument. A deposit fill marks with `maximize = false` and a redeem fill marks with `maximize = true`. When the order's `min_out` is above zero, the vault first quotes the fill with `preview_deposit` or `preview_redeem` at that mark. If the quote is at or above `min_out`, `strategy_deposit` or `strategy_redeem` runs at the same mark. The [Vault orders](./vault-orders.md) page gives the gates around it.

The mark rides out on the receipt. A filled deposit publishes it as `DepositFill.net_pnl` and a filled redeem as `RedeemFill.net_pnl`. A rejected order publishes it as `RejectVaultOrder.net_pnl`, and `RejectVaultOrder.quoted` carries the shortfall quote. That quote is the shares a deposit would mint, or the assets a redeem would pay net of `redeem_fee`.

On a `Retired` market, `create_vault_order` redeems at once and publishes `RedeemFill` with id `0` and `net_pnl` `0`. `capped_net_pnl` does not run on that path.

## A receipt reproduces its PnL only below the cap

The [Events](./events.md) page gives the `price` field of every fill receipt. On a close receipt, `notional` and `tokens` are the closed size at the position's own entry ratio. The pair implies the entry price of the closed chunk. `price` is what the chunk closed at. Recomputing `pnl` from those three fields with `math::pnl` reproduces the emitted value only where the profit cap did not bind. Where the cap bound, the emitted value is the recomputed profit scaled down by `cap / side_pnl` at the moment of the close.

:::info Receipts report profit after the cap
Recomputing raw PnL from a close receipt's size and price can exceed its emitted `pnl`. The emitted value includes the profit haircut.
:::

## What this means for a position

A position's PnL reads the exit side of the quote and its size came from the entry side. The spread therefore costs every round trip. A profit is paid in full while the winning side stays under half the vault balance, scaled by `max_pnl_trader`. Above that line the payout shrinks in proportion to the overhang. The ADL trigger sits at or below `max_pnl_trader`, so any keeper can force the overhang down once it passes the trigger. The vault share price counts each side's profit only up to the same allowance.
