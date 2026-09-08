---
sidebar_position: 14
title: Auto-deleveraging
---

# Auto-deleveraging

Auto-deleveraging (ADL) bounds what one side of the book can draw from the vault. The market measures each side's pending PnL against half the vault balance. A side arms when that measure passes the trigger. An armed side cannot grow, and a keeper can force a close on it that lowers the measure. The long side and the short side arm independently, each against its own half.

## The `AdlState` flags

```rust
pub struct AdlState { pub long: bool, pub short: bool }
pub fn get(&self, is_long: bool) -> bool
```

`AdlState` holds one flag per side. It lives under `DataKey::Adl` in instance storage. Both fields default to `false`. `AdlState::get` selects the field for a side.

```rust
fn get_adl(e: Env) -> AdlState;
```

No auth. `get_adl` returns the zeroed default until the first write.

## Arm and clear

```rust
fn update_adl_state(e: Env, price: Bytes) -> AdlState;
```

Permissionless. There is no `keeper` argument and no reward. `price` is the serialized oracle report. The call loads through `Market::load` with newest-price substitution and the protective staleness class, so a cached report newer than the payload wins. Two failures apply: `MarketFrozen` (704) when the status is `Frozen` or `Retired`, and an oracle trap on a rejected report.

Under a stored terminal price the market prices flat from `DataKey::TerminalPrice` alone. The load returns that value before it reaches the oracle path, so `MarketFrozen` (704) is the only failure that remains. The [pricing](./pricing.md) page documents the load.

### The allowances and the measure

All four values below are token-dec.

- `trigger = half_factor(vault_balance, adl_max_pnl)`
- `clear = half_factor(vault_balance, adl_clear_target)`
- `long_pnl = side_pnl(price, is_long = true, maximize = true)`
- `short_pnl = side_pnl(price, is_long = false, maximize = true)`

The state that the call stores and returns is:

- `state.long = long_pnl > trigger || (current.long && long_pnl > clear)`
- `state.short = short_pnl > trigger || (current.short && short_pnl > clear)`

`vault_balance` is token-dec and comes from `VaultClient::total_assets`. `adl_max_pnl` and `adl_clear_target` are `SCALAR_18` ratios. `current` is the stored `AdlState`. `math::half_factor` takes a `balance` and a `factor` and computes `floor((balance / 2) * factor / SCALAR_18)`. Here `balance` is `vault_balance` (token-dec), and `factor` is the `SCALAR_18` ratio passed, either `adl_max_pnl` or `adl_clear_target`. The division by two truncates toward zero, so both allowances round down. `MarketData::side_pnl` returns the side's pending PnL in token-dec, floored at the negative of the side's margin. `maximize = true` marks the side at the price that favors the trader.

A flag arms strictly above `trigger` and clears at or below `clear`. Between the two it holds its current value. Config validation keeps `adl_clear_target <= adl_max_pnl`, so the band is well formed. A side whose pending PnL is zero or negative never arms.

The call writes `DataKey::Adl` and the accrued `DataKey::MarketData`. Without a stored terminal price it writes `DataKey::PriceCache` when no cache entry exists or when the payload is newer than the cached report. It emits `AdlUpdate { long, short }`.

## What a set flag does

A set flag has two effects. First, `execute_order` traps with `IncreaseHalted` (705) on an increase fill for that side when `order.notional > 0`. A zero-notional increase adds only margin, grows no size, and still fills, so a trader on an armed side can still defend margin. A decrease or a close on that side is unaffected. Second, the side becomes eligible for `execute_adl`.

## The forced close

```rust
fn execute_adl(
    e: Env,
    keeper: Address,
    user: Address,
    is_long: bool,
    amount: i128,
    price: Bytes,
) -> i128;
```

Permissionless. `keeper` is the reward recipient, named by the caller and never authenticated. `user`, `is_long` and `amount` are caller-supplied too. `amount` is the notional to close, in token-dec. A request at or above `position.notional`, or one that leaves `position.notional - amount < min_position_notional`, closes the position in full. `min_position_notional`, `min_order_notional` and `max_position_notional` are token-dec bounds in `Config`. The call runs `Position::decrease` with `is_adl = true`. On a partial close the margin withdrawal is fixed at zero. On a full close `Position::close_settled` unwinds the whole position and pays the settled equity floored at zero. It loads the price the same way `update_adl_state` does.

The call writes `DataKey::Position` and the accrued `DataKey::MarketData`. Without a stored terminal price it writes `DataKey::PriceCache` when no cache entry exists or when the payload is newer than the cached report. A full close removes each swept `DataKey::Order`.

Two paths write `DataKey::ClaimableCredit`. The close settles the position's accruals first, and funding the position earned is credited there. That path raises `MarketData::credit_owed` by the earned amount and leaves `MarketData::credit_pool` alone. A settlement transfer that the trader's account rejects credits the unpaid amount and raises both `MarketData::credit_owed` and `MarketData::credit_pool` by it.

### Gates in code order

`before` is `side_pnl(price, is_long, maximize = true)` on the book before the close. `after` is the same measure after the close and its settlement. `locked` is the position's notional still under the decrease lock at the current ledger time, in token-dec, and it is zero once the lock deadline has passed. `market.price.publish_time` and `position.priced_at` are both unix seconds. `vault_balance` is the token-dec balance from `VaultClient::total_assets`, and `adl_clear_target` is a `SCALAR_18` ratio in `Config`.

| Order | Condition | Error |
|---|---|---|
| 1 | Status is `Frozen` or `Retired` | `MarketFrozen` (704) |
| 2 | The oracle rejects the report, on a market with no stored terminal price | oracle trap |
| 3 | `amount < min_order_notional` | `InvalidOrder` (732) |
| 4 | `AdlState::get(is_long)` is `false` | `AdlNotTriggered` (770) |
| 5 | `before <= half_factor(vault_balance, adl_clear_target)` | `AdlNotTriggered` (770) |
| 6 | `market.price.publish_time < position.priced_at` | `StalePrice` (740) |
| 7 | `position.notional == 0` | `PositionNotFound` (720) |
| 8 | Settled equity before the close is under the maintenance requirement | `PositionLiquidatable` (723) |
| 9 | A full close with `locked > 0`, or a partial close with `amount > position.notional - locked` | `NotionalLocked` (721) |
| 10 | The partial survivor's notional exceeds `max_position_notional` | `NotionalAboveMaximum` (712) |
| 11 | The partial survivor's settled equity is under the maintenance requirement | `PositionLiquidatable` (723) |
| 12 | The settlement's vault draw exceeds `vault_balance` | `VaultInsolvent` (755) |
| 13 | `after >= before` | `AdlNotEligible` (772) |
| 14 | `after < half_factor(vault_balance, adl_clear_target)` on the settled balance | `AdlOvershoot` (771) |

Gate 3 is the dust floor, and it stops a keeper who wants to cut a winner into fragments. Gate 5 refuses a side already at or under its clear allowance. It reads the side's measure before the close and never reads `amount`. Gate 14 is the bound on the other end of the slice.

Gates 13 and 14 run after the close and the settlement. The overhang must fall, and it must not fall through the clear allowance. That allowance is re-measured on the vault balance the settlement left behind. A trap at either gate reverts the close, the token transfers, and every storage write in the call.

### The survivor

On a partial close `Position::require_valid` runs with `is_adl = true`. It skips the `InsufficientMargin` (713) floor, so a remainder the trader did not choose is never held to the initial-margin line. The notional band and the maintenance check still apply. A survivor above `max_position_notional` raises `NotionalAboveMaximum` (712). A config update that lowers the cap below an open position's notional is one way to reach that error. A survivor under the maintenance requirement raises `PositionLiquidatable` (723). `NotionalBelowMinimum` (711) is out of reach, because the full-close clamp covers the low side. The [margin and leverage](./margin-and-leverage.md) page defines the maintenance requirement and the order of these checks.

### The payout

The return value is the keeper leg of the settlement, in token-dec:

`reward = floor((base_fee + impact_fee) * keeper_rate / SCALAR_18)`

`base_fee` and `impact_fee` are token-dec, computed by `Market::trade_fees` on the closed leg. `keeper_rate` is a `SCALAR_18` ratio. `Settlement::fee_split` computes the leg, reached through `Settlement::compute_decrease_order` with an `exec_fee` of zero. `exec_fee` is a token-dec flat amount added on top of the keeper leg, and an ADL close carries no order that pays one.

### Receipts

A partial close emits `DecreaseFill` and a full close emits `CloseFill`. Both carry `id = 0`, which marks the fill as an ADL close, and `price = market.price.exit(is_long)`. The `margin` field of `DecreaseFill` reports the requested withdrawal, which is zero here. The `margin` field of `CloseFill` reports the freed margin, gross of the itemized fees. On a full close `Position::store` sweeps the decrease orders that rest on the position. It emits one `CancelOrder` per swept order and returns the summed escrow. `Settlement::compute_decrease_order` folds that sum into the trader leg.

## The two thresholds

`adl_max_pnl` and `adl_clear_target` are `SCALAR_18` ratios of half the vault balance, both in `Config`.

| Field | Meaning | Bounds |
|---|---|---|
| `adl_max_pnl` | The level that arms a side, measured on its pending PnL | `>= MIN_ADL_TRIGGER`, `< SCALAR_18`, `<= max_pnl_trader`, `>= adl_clear_target`, `>= max_pnl_withdraw` |
| `adl_clear_target` | The level a side's pending PnL must return to | `>= MIN_ADL_CLEAR`, `<= adl_max_pnl` |

`MIN_ADL_TRIGGER` is `45 * SCALAR_18 / 100` and `MIN_ADL_CLEAR` is `40 * SCALAR_18 / 100`. `Config::check_valid` returns the first violated rule, and `Config::require_valid` traps with it. A negative `adl_max_pnl` or `adl_clear_target` breaks the non-negativity rule first and raises `NegativeValueNotAllowed` (710). Every other bound in the table raises `InvalidConfig` (700).

The rule `adl_max_pnl <= max_pnl_trader` puts the trigger at or below the overhang that starts the realized-profit haircut. `max_pnl_trader` is a `SCALAR_18` ratio in `Config`, and the [PnL and the profit cap](./pnl-calculation.md) page documents the haircut. `max_pnl_withdraw` is the redeem gate on the same per-side measure, a `SCALAR_18` ratio in `Config`, and the [vault orders](./vault-orders.md) page documents it.

## Invariants

`update_adl_state` is the only writer of `DataKey::Adl`. `execute_adl` reads the flag and never writes it, so an armed side stays armed until a later `update_adl_state` clears it.

The contract enforces the side-level bounds only, which protect the vault whichever eligible position closes. The choice of target is keeper policy, and no rule on chain makes the target the side's largest winner.

The decrease lock applies to ADL exactly as it applies to a trader's own close. Gate 9 rejects a full close while the lock holds, and rejects a partial close above the unlocked notional. The [position lifecycle](./position-lifecycle.md) page describes the lock.

**A lone winner on an armed side cannot be closed in full.** The full close takes the side's measure to zero, and gate 14 then trips `AdlOvershoot` (771) unless the clear allowance is also zero. Such a side deleverages through partial closes.
