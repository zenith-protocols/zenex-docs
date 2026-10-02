---
sidebar_position: 14
title: Auto-deleveraging
---

# Auto-deleveraging

Auto-deleveraging (ADL) bounds what one side of the book can draw from the vault. The market compares each side's pending profit and loss (PnL) with half the vault balance. A side arms when that PnL passes the trigger. An armed side rejects increases that add size, and a keeper can force a close on it that lowers the PnL. The long side and the short side arm independently, each against its own half.

This page holds the `AdlState` flags and the two calls that write and consume them. It also holds the gate order of the forced close, the keeper payout, and the two `Config` thresholds. Amounts are token-dec, the settlement token's decimals. Ratios are `SCALAR_18`, which is `1_000_000_000_000_000_000`. Times are unix seconds. The [units page](../units.md) defines every scale.

## `AdlState` holds one flag per side

```rust
pub struct AdlState { pub long: bool, pub short: bool }
pub fn get(&self, is_long: bool) -> bool
fn get_adl(e: Env) -> AdlState;
```

The two flags live in one `DataKey::Adl` entry in instance storage, and both default to `false`. `AdlState::get` selects the flag for a side. `get_adl` needs no signature and returns the zeroed default until the first `update_adl_state`.

## `update_adl_state` arms and clears the flags

```rust
fn update_adl_state(e: Env, price: Bytes) -> AdlState;
```

Any account may submit the call. The signature carries no `keeper` argument, so the call pays no reward. `price` is the serialized oracle report.

The call runs `Market::load` with `newest_price` and `protective` both set to `true`. A cached report newer than the payload then prices the call, and the oracle checks the payload against its wider close staleness window. Arming protects solvency, so it reads the freshest mark and stays live through a gap in the feed. The [pricing](./pricing.md) page documents the load and the cache.

Two failures apply. `MarketFrozen` (704) fires when the status is `Frozen` or `Retired`. An oracle trap fires when the oracle rejects the report. A stored `DataKey::TerminalPrice` replaces the oracle path. The load then marks both `bid` and `ask` at that value with the ledger timestamp as `publish_time`, so only `MarketFrozen` (704) can fire.

### The allowances and the new state

```
trigger   = half_factor(vault_balance, adl_max_pnl)
clear     = half_factor(vault_balance, adl_clear_target)
long_pnl  = side_pnl(price, is_long = true,  maximize = true)
short_pnl = side_pnl(price, is_long = false, maximize = true)

state.long  = long_pnl  > trigger || (current.long  && long_pnl  > clear)
state.short = short_pnl > trigger || (current.short && short_pnl > clear)
```

Where:

- `vault_balance` is `VaultClient::total_assets`, read once by the load (token-dec).
- `adl_max_pnl` and `adl_clear_target` are `Config` ratios (`SCALAR_18`).
- `half_factor` takes half of a balance and applies a ratio. It rounds down, so the trigger errs early and the clear allowance errs late. The [Units and scales](../units.md#truncating-halves) page defines it.
- `side_pnl` is `MarketData::side_pnl`, the pending PnL of one side (token-dec, signed). It floors at the negative of that side's margin.
- `maximize = true` marks the side at the price that favors the trader. That price is the ask for a long and the bid for a short. The mark rounds in the trader's favor.
- `current` is the stored `AdlState`.

A flag arms when its side's pending PnL is strictly above the trigger. It clears when the PnL is at or below the clear allowance. Between the two it keeps its stored value, so a PnL that hovers near the trigger does not flip the flag on every call. `Config::check_valid` holds `adl_clear_target` at or below `adl_max_pnl`, so the band is well formed. A side whose pending PnL is zero or negative never arms, because both allowances are at least zero.

The rows below show one side with a vault balance of 100.0, `adl_max_pnl` at 50%, and `adl_clear_target` at 40%. Half the vault is 50.0, so the trigger is 25.0 and the clear allowance is 20.0. Amounts are whole units of the settlement token.

| Pending PnL | Stored flag | New flag | Reason |
| --- | --- | --- | --- |
| 26.0 | `false` | `true` | Above the trigger of 25.0. |
| 25.0 | `false` | `false` | Equal to the trigger, which does not arm. |
| 22.0 | `false` | `false` | Inside the band, so the flag keeps its value. |
| 22.0 | `true` | `true` | Inside the band, so the flag keeps its value. |
| 20.0 | `true` | `false` | At the clear allowance, which clears. |

## An armed side rejects increases that add size

On an armed side, `execute_order` traps `IncreaseHalted` (705) on an increase fill when `order.notional > 0`. The [orders](./orders.md) page gives the position of that gate. A zero-notional increase adds only margin and grows no size, so it still fills and a position on an armed side can add margin. A decrease or a close on that side is unaffected. The halt stops new size from adding to the pending PnL that ADL works to lower. The flag also makes the side eligible for `execute_adl`.

## `execute_adl` closes a winner by force

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

Any account may submit the call, and `user` signs nothing. `keeper` is the reward recipient and authenticates nothing. The caller supplies `user`, `is_long`, and `amount`. `amount` is the notional to close (token-dec). A request at or above `position.notional` closes the position in full. So does a request that leaves `position.notional - amount` below `min_position_notional` (token-dec).

The call runs `Position::decrease` with `is_adl` set to `true` and a margin withdrawal of `0`. On a partial close the closed fraction realizes its PnL through the haircut that the [PnL and the profit cap](./pnl-calculation.md) page defines. On a full close `Position::close_settled` unwinds the whole position and pays the settled equity floored at zero. The [position lifecycle](./position-lifecycle.md) page documents both paths.

`execute_adl` loads the price the way `update_adl_state` does, with newest-price substitution and the protective window. De-risking must land even when the freshest report is older than the strict fill window.

### Gates in code order

`before` is `side_pnl(price, is_long, maximize = true)` on the book after accrual and before the close. `after` is the same pending PnL after the close and its settlement. `locked` is the position's notional still under the decrease lock at the current ledger time (token-dec). It is zero once the lock deadline has passed. `market.price.publish_time` and `position.priced_at` are unix seconds. `clear allowance` is `half_factor(vault_balance, adl_clear_target)`, with `vault_balance` from `VaultClient::total_assets` (token-dec).

| Order | Condition | Error |
| --- | --- | --- |
| 1 | The status is `Frozen` or `Retired` | `MarketFrozen` (704) |
| 2 | No terminal price is stored and the oracle rejects the report | oracle trap |
| 3 | `amount < min_order_notional` | `InvalidOrder` (732) |
| 4 | `AdlState::get(is_long)` is `false` | `AdlNotTriggered` (770) |
| 5 | `before` is at or below the clear allowance | `AdlNotTriggered` (770) |
| 6 | `market.price.publish_time < position.priced_at` | `StalePrice` (740) |
| 7 | `position.notional == 0` | `PositionNotFound` (720) |
| 8 | Settled equity before the close is under the maintenance requirement | `PositionLiquidatable` (723) |
| 9 | A full close with `locked > 0`, or a partial close with `amount > position.notional - locked` | `NotionalLocked` (721) |
| 10 | The partial survivor's notional exceeds `max_position_notional` | `NotionalAboveMaximum` (712) |
| 11 | The partial survivor's settled equity is under the maintenance requirement | `PositionLiquidatable` (723) |
| 12 | A full close, and a listed decrease order id has no stored `Order` row | `OrderNotFound` (730) |
| 13 | The settlement's vault draw exceeds `vault_balance` | `VaultInsolvent` (755) |
| 14 | `after >= before` | `AdlNotEligible` (772) |
| 15 | `after` is below the clear allowance on the settled balance | `AdlOvershoot` (771) |

Gate 3 is the dust floor. It stops a keeper from cutting a winner into fragments. Gate 5 reads the side's live pending PnL and never reads `amount`. A flag that a forced close left set therefore permits no further close once the PnL is at or below the clear allowance. Gate 7 traps on a row that does not exist, because a read of a missing position returns the zeroed row and writes nothing. Gate 12 is the closure sweep in `Position::store`. It fires only if a position's decrease list and its stored orders disagree. Gate 13 runs in `Settlement::settle` before any transfer.

Gates 14 and 15 run after the close and the settlement, and they read the pending PnL that the trigger reads. The pending PnL must fall. It must also stay at or above the clear allowance, so one forced close cannot cut a side below its band. That allowance is re-measured on the vault balance the settlement left behind. A trap at either gate reverts the close, the token transfers, and every storage write in the call.

The rows below show gates 14 and 15. The vault balance is 100.0 before the close and 90.0 after the settlement, and `adl_clear_target` is 40%. The clear allowance is 20.0 before the close and 18.0 on the settled balance. `before` is 26.0.

| `after` | Gate reached | Result |
| --- | --- | --- |
| 26.0 | 14 | `AdlNotEligible` (772), because the PnL did not fall. |
| 21.0 | none | The call succeeds. |
| 18.0 | none | The call succeeds, because 18.0 equals the settled clear allowance. |
| 17.0 | 15 | `AdlOvershoot` (771), because 17.0 is below 18.0. |

### The survivor of a partial close

On a partial close `Position::require_valid` runs with `is_adl` set to `true`. It skips the `InsufficientMargin` (713) floor, so a remainder that the trader did not choose is not held to the initial-margin line. The notional band and the maintenance check still apply. A survivor above `max_position_notional` raises `NotionalAboveMaximum` (712), which a config update that lowers the cap below an open position's notional can cause. A survivor under the maintenance requirement raises `PositionLiquidatable` (723). `NotionalBelowMinimum` (711) cannot fire, because the full-close clamp covers the low side. The [margin and leverage](./margin-and-leverage.md) page defines the maintenance requirement and the order of these checks.

### The keeper payout

The return value is the keeper leg of the settlement (token-dec).

```
payout = floor((base_fee + impact_fee) * keeper_rate / SCALAR_18)
```

Where:

- `base_fee` and `impact_fee` are token-dec. `Market::trade_fees` computes them on the closed leg.
- `keeper_rate` is a `Config` ratio (`SCALAR_18`) of at most `MAX_KEEPER_RATE`, which is `SCALAR_18 / 2`.

`execute_adl` calls `Settlement::compute_decrease_order` with an `exec_fee` of zero. `exec_fee` is a flat token-dec amount that an order adds to the keeper payout. An ADL close fills no order, so the payout is the fee cut alone. The borrowing fee adds nothing to it. The keeper receives a fixed share of the trade fee on the closed size, and nothing from the position's PnL or funding.

For example, take a `base_fee` of 1.5, an `impact_fee` of 0.5, and a `keeper_rate` of 10%. The keeper receives `floor(2.0 * 10%)`, which is 0.2. The [fee system](./fee-system.md) page documents the other legs of the split.

### Receipts

A partial close emits `decrease_fill` and a full close emits `close_fill`. Both carry `id` `0`, which marks the fill as an ADL close, and `price` set to `market.price.exit(is_long)`. The `margin` field of `decrease_fill` reports the requested withdrawal, which is `0` here. The `margin` field of `close_fill` reports the freed margin, gross of the itemized fees.

On a full close `Position::store` sweeps the decrease orders that rest on the position. It emits one `cancel_order` per swept order before the `close_fill`, and it returns the summed escrow. `Settlement::compute_decrease_order` adds that sum to the trader leg. The [events](./events.md) page gives every field and topic.

## Storage and events per call

| Call | Storage written | Event |
| --- | --- | --- |
| `update_adl_state` | `DataKey::Adl`, the accrued `DataKey::MarketData`, and `DataKey::PriceCache` when the market holds no terminal price | `adl_update` with data fields `long` and `short` and no topic beyond the name |
| `execute_adl` | `DataKey::Position`, the accrued `DataKey::MarketData`, `DataKey::PriceCache` when the market holds no terminal price, and `DataKey::ClaimableCredit` on the two paths below | `decrease_fill` or `close_fill`, and `cancel_order` per swept order |

`DataKey::PriceCache` is written when no cache entry exists or when the payload is newer than the cached report. A full close removes each swept `DataKey::Order`. It stores the zeroed `Position` row, which keeps the entry's prepaid rent for a later open.

Both calls extend the instance time to live (TTL) through `extend_instance` at their start. The [Storage](./storage.md#four-tiers-set-every-time-to-live) page gives the tier of each key and its TTL constants.

`execute_adl` credits `DataKey::ClaimableCredit` on two paths. The close settles the position's accruals first, and funding the position earned is credited there. That path raises `MarketData::credit_owed` by the earned amount and leaves `MarketData::credit_pool` unchanged. If the trader's account rejects the settlement transfer, `pay_trader` credits the unpaid amount and raises both `MarketData::credit_owed` and `MarketData::credit_pool` by it.

## Two thresholds set the band

`adl_max_pnl` and `adl_clear_target` are `Config` ratios of half the vault balance (`SCALAR_18`).

| Field | Meaning | Bounds |
| --- | --- | --- |
| `adl_max_pnl` | The pending PnL above which a side arms | `>= MIN_ADL_TRIGGER`, `< SCALAR_18`, `<= max_pnl_trader`, `>= adl_clear_target` |
| `adl_clear_target` | The pending PnL at or below which a side clears | `>= MIN_ADL_CLEAR`, `<= adl_max_pnl`, `>= max_pnl_withdraw` |

`MIN_ADL_TRIGGER` is `45 * SCALAR_18 / 100` and `MIN_ADL_CLEAR` is `40 * SCALAR_18 / 100`. The floors stop a config change from arming ADL against modest open winners and from letting one forced close cut deep. `Config::check_valid` returns the first violated rule, and `Config::require_valid` traps with it. A negative `adl_max_pnl` or `adl_clear_target` breaks the non-negativity rule first and raises `NegativeValueNotAllowed` (710). Every other bound in the table raises `InvalidConfig` (700).

`max_pnl_trader` is the `Config` ratio (`SCALAR_18`) at which the realized-profit haircut starts. The rule `adl_max_pnl <= max_pnl_trader` puts the trigger at or below that level, so ADL arms before the haircut engages.

`max_pnl_withdraw` is the redeem gate on the same pending PnL (`SCALAR_18`). It lies in `(0, adl_clear_target]`. A negative value raises `NegativeValueNotAllowed` (710), and any other value outside that range raises `InvalidConfig` (700). A permitted redeem therefore leaves every side at or below the clear allowance. A redeem can neither arm ADL nor hold an armed flag above its clear target. The [vault orders](./vault-orders.md) page documents the gate.

## What holds across the calls

`update_adl_state` is the only writer of `DataKey::Adl`. `execute_adl` reads the flag and never writes it, so an armed side stays armed until a later `update_adl_state` clears it.

The contract enforces the side-level bounds, which protect the vault whichever eligible position closes. `execute_adl` accepts any `user` whose position passes the gates, and the caller selects that `user`. The keeper therefore owns winner selection, and the contract does not enforce fairness among the traders on the deleveraged side.

The decrease lock applies to ADL exactly as it applies to a trader's own close. Gate 9 rejects a full close while the lock holds, and it rejects a partial close above the unlocked notional. The [position lifecycle](./position-lifecycle.md) page describes the lock.

A successful `execute_adl` leaves the side's pending PnL below its prior value and at or above the clear allowance on the settled balance. A close that would take the side below that allowance traps `AdlOvershoot` (771). A full close of the only position on a side is one such case, because the side then reads a pending PnL of zero. That side deleverages through partial closes that stop at the allowance.
