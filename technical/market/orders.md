---
title: Orders
sidebar_position: 6
---

# Orders

An order is a request to change the position `(user, is_long)` by a stated size and margin. The trader signs it and escrows funds at creation. A trigger kind names the level the price must cross, and any kind may name a slippage bound. The position changes only at the fill, which a keeper runs through `execute_order` with an oracle report. The [pricing](./pricing.md) page defines the fill price, which a stored `TerminalPrice` overrides. The [market status](./status.md) page defines `TerminalPrice` and every status this page names. For the position paths a fill runs, refer to the [position lifecycle](./position-lifecycle.md) page.

## Order kinds

`OrderKind` is a `u32` enum. It crosses the contract boundary as `Order.kind`, and `OrderKind::from_u32` traps with `UnknownKind` (734) on any other value.

| Discriminant | Kind | Fills when |
|---|---|---|
| 0 | `MarketIncrease` | The next verified price arrives. `trigger_price` is unread. |
| 1 | `LimitIncrease` | The entry price crosses `trigger_price` in the trader's favor. |
| 2 | `StopIncrease` | The entry price crosses `trigger_price` against the trader. |
| 3 | `MarketDecrease` | The next verified price arrives. `trigger_price` is unread. |
| 4 | `LimitDecrease` | The exit price crosses `trigger_price` in the trader's favor (take profit). |
| 5 | `StopDecrease` | The exit price crosses `trigger_price` against the trader (stop loss). |

Four groupings drive every rule on this page. `is_increase` covers 0, 1, 2. `is_decrease` covers 3, 4, 5. `is_market` covers 0 and 3. `is_trigger` covers 1, 2, 4, 5.

## The order row

`Order` is a `#[contracttype]` in persistent user-tier storage under `DataKey::Order(user, id)`. The row does not change while it rests. It is the `order` field of the `CreateOrder` event and the return of `get_order`.

| Field | Type | Unit | Meaning |
|---|---|---|---|
| `is_long` | `bool` | | The side the order targets. |
| `kind` | `u32` | | The `OrderKind` discriminant. |
| `notional` | `i128` | token-dec | Size change magnitude, `>= 0`. |
| `margin` | `i128` | token-dec | Margin change magnitude, `>= 0`. |
| `trigger_price` | `i128` | price_scalar | Level the price must cross, for a trigger kind. A market kind never reads it. |
| `price_bound` | `i128` | price_scalar | Slippage limit on the execution price. `0` is unbounded. |
| `exec_fee` | `i128` | token-dec | Keeper fee, copied from `Config.exec_fee` at creation. |
| `created_at` | `u64` | seconds | Ledger timestamp at creation. The anti-replay anchor. |
| `expiration` | `u32` | ledger sequence | Last ledger the order fills at, inclusive. |

token-dec is the settlement token's decimals. price_scalar is the feed's native precision, the scale of `PriceData.bid` and `PriceData.ask`. `notional` and `margin` are magnitudes. The kind gives them their direction.

`Order::escrow_amount` (token-dec) is the amount of the settlement token the market holds for the row. It is `margin + exec_fee` for an increase kind and `exec_fee` for a decrease kind.

## `create_order`

```rust
fn create_order(e: Env, user: Address, is_long: bool, kind: u32, notional: i128, margin: i128, trigger_price: i128, price_bound: i128, expiration: u32) -> u32
```

`user` must sign the entry and the escrow transfer at step 10. The return is the new order id. `create_order` builds the row with `exec_fee = Config.exec_fee` and `created_at` equal to the ledger timestamp. The checks run in this order, and the first failure traps.

| Step | Condition | Error |
|---|---|---|
| 1 | Status is `Frozen` or `Retired` | `MarketFrozen` (704) |
| 2 | `kind > 5` | `UnknownKind` (734) |
| 3 | `notional < 0`, `margin < 0`, `trigger_price < 0`, or `price_bound < 0` | `NegativeValueNotAllowed` (710) |
| 4 | `0 < notional < min_order_notional` or `0 < margin < min_order_margin` | `InvalidOrder` (732) |
| 5 | `notional == 0 && margin == 0` | `InvalidOrder` (732) |
| 6 | Trigger kind and `trigger_price == 0` | `InvalidOrder` (732) |
| 7 | Increase kind and `notional > max_position_notional` | `NotionalAboveMaximum` (712) |
| 8 | Increase kind and `margin + exec_fee` overflows `i128` | `InvalidOrder` (732) |
| 9 | `expiration` is below the current ledger sequence | `OrderExpired` (731) |
| 10 | Transfer of `Order::escrow_amount` from `user` to the market, when `> 0` | Settlement token error |
| 11 | Decrease kind and the side already lists `MAX_ORDERS_PER_SIDE` (8) ids | `TooManyOrders` (733) |

Steps 2 to 9 are `Order::require_valid`. `min_order_notional`, `min_order_margin`, `min_position_notional`, and `max_position_notional` are `Config` fields in token-dec. A `notional` equal to `min_order_notional`, or a `margin` equal to `min_order_margin`, passes step 4. An `expiration` equal to the current ledger sequence passes step 9. A decrease `notional` has no cap. A decrease at or above the position's size clamps to a full close at fill. So does one whose remaining notional would sit below `min_position_notional`. Step 10 raises no market error. A failed transfer traps with an error of the settlement token contract, which each deployment configures. Step 11 runs after the transfer, so a trap there reverts the escrow with the rest of the transaction. Size, margin, utilization, and the trigger are checked at the fill, against the resulting position.

The entry reads `Status`, `Config`, `Token`, `Position(user, is_long)`, and `OrderCounter(user)`. The position row loads through `get_position`, which writes a zeroed row when none exists and extends its TTL on the trader's transaction. The id comes from `next_order_id`. The entry writes the row to `Order(user, id)`. A decrease kind appends `id` to `Position.decrease_orders` and rewrites the position. A decrease may rest before its position opens. The entry publishes `CreateOrder { user, id, order }`, with `user` and `id` as topics, and returns `id`.

## `cancel_order`

```rust
fn cancel_order(e: Env, user: Address, id: u32) -> i128
```

`user` must sign. If the status is `Frozen`, the call traps with `MarketFrozen` (704). Every other status allows a cancel, `Retired` included. If `Order(user, id)` is absent, the call traps with `OrderNotFound` (730). The entry transfers `Order::escrow_amount` from the market to `user` when it is `> 0` and removes the row. For a decrease kind it also removes `id` from `Position.decrease_orders` and rewrites the position. It publishes `CancelOrder { user, id, refund }`, with `user` and `id` as topics, and returns `refund` (token-dec). An expired order cancels the same way and refunds in full.

## Views and ids

```rust
fn get_order(e: Env, user: Address, id: u32) -> Order
fn get_order_counter(e: Env, user: Address) -> u32
```

`get_order` returns the stored row or traps with `OrderNotFound` (730). An on-chain read extends the row's TTL. `get_order_counter` returns the next unallocated id and writes nothing.

`OrderCounter(user)` is one persistent user-tier counter per trader, shared by trade orders and by the vault orders that the [vault orders](./vault-orders.md) page defines. `next_order_id` allocates from `1` and adds one on every creation, so ids `1..counter` are allocated and never reused. For a trader who has created no order, `get_order_counter` returns `1`. Id `0` names no stored order. It appears only as the `id` of a `RedeemFill` on a retired market and of an auto-deleveraging fill receipt.

## `execute_order`

```rust
fn execute_order(e: Env, keeper: Address, user: Address, id: u32, price: Bytes) -> i128
```

The entry takes no authorization, and any account may call it. `keeper` is the address that receives the keeper payout. The caller names it, and the market never authenticates it. `price` is the serialized oracle report. The return is the keeper payout (token-dec).

The entry loads the working set with `Market::load(price, newest_price = false, protective = false)`. `newest_price = false` means the fill uses the submitted report even when the price cache holds a newer one. `protective = false` selects the oracle's trade staleness window. Both accrual indices advance to now before the entry touches the position. The [pricing](./pricing.md) page defines the load.

The gates run in this order, and the first failure traps. The [oracle](../oracle/overview.md) page defines the report checks at step 2.

| Step | Condition | Error |
|---|---|---|
| 1 | Status is `Frozen` or `Retired` | `MarketFrozen` (704) |
| 2 | The oracle rejects the report | Oracle error. Skipped under a stored `TerminalPrice`. |
| 3 | `Order(user, id)` is absent | `OrderNotFound` (730) |
| 4 | Increase kind and `order.notional > 0`, and then either status is not `Active` or the side's ADL flag is set | `IncreaseHalted` (705) |
| 5 | `price.publish_time < Position.priced_at` | `StalePrice` (740) |
| 6 | The current ledger sequence is above `expiration` | `OrderExpired` (731) |
| 7 | `price.publish_time < created_at`, unless a market kind with `created_at` equal to the ledger timestamp | `StalePrice` (740) |
| 8 | Trigger kind and `trigger_price` is not crossed | `TriggerNotMet` (742) |
| 9 | `price_bound != 0` and the execution price is worse than the bound | `PriceBoundExceeded` (741) |

After step 3 the entry decodes `order.kind` through `OrderKind::from_u32`, which is validated at creation, so `UnknownKind` (734) does not fire on a stored row. Step 4 lets a zero-notional increase fill on `OnIce`, on `Delisted`, and on a flagged side. A zero-notional increase adds margin only. The flag is the `long` or `short` field of `AdlState`, which `update_adl_state` writes and an auto-deleveraging (ADL) fill only reads. The [auto-deleveraging](./auto-deleveraging.md) page defines both calls. Step 5 is `Position::require_price_not_stale` and keeps `priced_at` monotone per row. Equality passes at steps 5 and 7. Steps 6 to 9 are `Order::require_price_trigger_met`. The exemption at step 7 covers a market kind that is created and filled in one ledger. A trigger kind gets no exemption. The trigger and bound section below defines steps 8 and 9.

### Increase path

`fill_increase` runs `Position::increase` with the order's `notional` and `margin` at the entry price, `ask` for a long and `bid` for a short. The path traps with `NotionalBelowMinimum` (711), `NotionalAboveMaximum` (712), `InsufficientMargin` (713), `PositionLiquidatable` (723), or `OpenInterestExceeded` (715). The [position lifecycle](./position-lifecycle.md) and [margin and leverage](./margin-and-leverage.md) pages define each condition. It publishes `OpenFill` when the side held no position before the fill, else `IncreaseFill`. It removes the order, stores the position, and settles through `Settlement::compute_increase_order`. `Position::increase` posts the escrowed margin less the settled costs. The base fee and the impact fee leave on the vault, keeper, and treasury legs. Borrowing leaves on the vault and treasury legs. The `exec_fee` moves to `keeper`. Paid funding enters no leg and stays on the contract in `credit_pool`. When `order.notional > 0`, `Market::require_utilization` runs last on the settled vault balance and traps with `UtilizationExceeded` (714). The bound is `Config.max_util_open`, a ratio in SCALAR_18.

### Decrease path

`fill_decrease` runs `Position::decrease` with the order's `notional` and `margin` at the exit price, `bid` for a long and `ask` for a short. The path traps with `PositionNotFound` (720), `PositionLiquidatable` (723), or `NotionalLocked` (721). A partial close validates the remaining position, so it also traps with `NotionalAboveMaximum` (712) or `InsufficientMargin` (713). The clamp to a full close keeps the survivor at or above `min_position_notional`. The [position lifecycle](./position-lifecycle.md) page defines each condition. It publishes `CloseFill` when the position's `notional` is `0` after the fill, else `DecreaseFill`. It removes the order and its id from `decrease_orders`, then stores the position. A full close sweeps every remaining id in `decrease_orders`. Each swept row is removed, its `Order::escrow_amount` joins the trader's payout, and a `CancelOrder` is published after the `CloseFill`. `Settlement::compute_decrease_order` splits the legs, and `Settlement::settle` traps with `VaultInsolvent` (755) under the rule on the [fees and settlement](./fee-system.md) page.

## Trigger and bound

`Order::check_trigger` judges the trigger and the bound against the execution price, which is the side of the spread the fill touches. Every price here is price_scalar.

- `execution_price = price.entry(is_long)` for an increase kind and `price.exit(is_long)` for a decrease kind. `entry` is `ask` for a long and `bid` for a short. `exit` is the reverse.
- `fills_above = (kind is StopIncrease or LimitDecrease) == is_long`.
- A trigger kind is crossed when `execution_price >= trigger_price` if `fills_above`, else when `execution_price <= trigger_price`.
- `is_buy = is_increase == is_long`. A buy passes when `execution_price <= price_bound`. A sell passes when `execution_price >= price_bound`.

| Kind | Long fills when | Short fills when |
|---|---|---|
| `LimitIncrease` | `ask <= trigger_price` | `bid >= trigger_price` |
| `StopIncrease` | `ask >= trigger_price` | `bid <= trigger_price` |
| `LimitDecrease` | `bid >= trigger_price` | `ask <= trigger_price` |
| `StopDecrease` | `bid <= trigger_price` | `ask >= trigger_price` |
| Any increase, `price_bound != 0` | `ask <= price_bound` | `bid >= price_bound` |
| Any decrease, `price_bound != 0` | `bid >= price_bound` | `ask <= price_bound` |

## Keeper payout

`execute_order` returns the keeper leg of the settlement (token-dec):

```
payout = floor((base + impact) * keeper_rate / SCALAR_18) + exec_fee
```

`base` and `impact` are the fill's trade fees (token-dec), computed by `Market::trade_fees` as the [fees and settlement](./fee-system.md) page defines them. `keeper_rate` is `Config.keeper_rate`, a ratio in SCALAR_18. `SCALAR_18` is `1_000_000_000_000_000_000`. `exec_fee` is the order's escrowed `exec_fee` (token-dec). `Settlement::fee_split` computes the first term. `Settlement::compute_increase_order` or `Settlement::compute_decrease_order` adds the second. The keeper takes no share of borrowing or funding.

`Settlement::settle` pays the keeper leg with a direct transfer of the settlement token. If `keeper` cannot receive that token, the transfer traps with the token contract's own error and the whole fill reverts. The order stays stored, and any account may fill it again under a different `keeper`. The trader leg carries a fallback instead, under the rule on the [fees and settlement](./fee-system.md) page.

## Escrow invariant

The market holds `Order::escrow_amount` in the settlement token for every stored order. The escrow leaves the market by one of three routes: a fill, a cancel, or a sweep.

An increase escrow is `margin + exec_fee`. Its fill posts the escrowed margin less the settled costs on the position, and the `exec_fee` goes to `keeper`. The base fee and the impact fee leave on the vault, keeper, and treasury legs. Borrowing leaves on the vault and treasury legs. Paid funding stays on the contract in `credit_pool`. A decrease escrow is the `exec_fee` alone, which also goes to `keeper`. A decrease fill posts nothing on the position, and it funds its fees from the position's margin and its realized PnL.

A cancel returns the whole amount to `user`. A sweep runs when a close leaves the position flat. It removes every remaining id in `decrease_orders` and returns each escrow on the trader leg. A liquidation always closes in full, so it always sweeps. An ADL fill sweeps only when its close leaves the position flat.

`Position.decrease_orders` lists exactly the stored decrease orders on that side, at most `MAX_ORDERS_PER_SIDE` (8). `expiration` gates a fill only. The row's storage TTL runs on the user tier, and an expired row still cancels.
