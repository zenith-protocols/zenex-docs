---
title: Orders
description: All order kinds, fields, escrow, authorization, expiry, execution gates, and refunds.
sidebar_position: 6
---

# Orders

A keeper order is a signed request to change the position `(user, is_long)` by a stated size and margin. This page covers the six order kinds, the stored `Order` row, and the entries `create_order`, `cancel_order`, `get_order`, `get_order_counter`, and `execute_order`.

The trader signs the order and escrows funds at creation. The position changes only at the fill, when a keeper runs `execute_order` with a serialized oracle report. A trigger kind names the level the execution price must cross, and any kind may name a slippage bound. The [pricing](./pricing.md) page defines the execution price, which a stored `TerminalPrice` overrides. The [market status](./status.md) page defines `TerminalPrice` and every status this page names. The [position lifecycle](./position-lifecycle.md) page defines the position paths a fill runs.

## Six kinds set when an order fills

`OrderKind` is a `u32` enum. It crosses the contract boundary as `Order.kind`, and `OrderKind::from_u32` traps with `UnknownKind` (734) on any value above 5.

| Discriminant | Kind | Fills when |
|---|---|---|
| 0 | `MarketIncrease` | Any report passes the fill gates. `trigger_price` is unread. |
| 1 | `LimitIncrease` | The entry price crosses `trigger_price` in the trader's favor. |
| 2 | `StopIncrease` | The entry price crosses `trigger_price` against the trader. |
| 3 | `MarketDecrease` | Any report passes the fill gates. `trigger_price` is unread. |
| 4 | `LimitDecrease` | The exit price crosses `trigger_price` in the trader's favor (take profit). |
| 5 | `StopDecrease` | The exit price crosses `trigger_price` against the trader (stop loss). |

`OrderKind` has four internal predicates. `is_increase` is true for 0, 1, and 2. `is_decrease` is true for 3, 4, and 5. `is_market` is true for 0 and 3. `is_trigger` is true for 1, 2, 4, and 5. This page writes increase kind, decrease kind, market kind, and trigger kind for a kind where the matching predicate is true.

## The row is unchanged while the order is pending

`Order` is a `#[contracttype]` stored in persistent user-tier storage under `DataKey::Order(user, id)`. It is the `order` field of the `CreateOrder` event and the return of `get_order`.

| Field | Type | Unit | Meaning |
|---|---|---|---|
| `is_long` | `bool` | | The side the order targets. |
| `kind` | `u32` | | The `OrderKind` discriminant. |
| `notional` | `i128` | token-dec | Size change magnitude, `>= 0`. A decrease may carry `i128::MAX` to ask for a full close. |
| `margin` | `i128` | token-dec | Margin change magnitude, `>= 0`. A decrease reads it as the withdrawal it requests. |
| `trigger_price` | `i128` | feed precision | Level the execution price must cross, for a trigger kind. A market kind never reads it. |
| `price_bound` | `i128` | feed precision | Slippage limit on the execution price. `0` is unbounded. |
| `exec_fee` | `i128` | token-dec | Keeper fee, copied from `Config.exec_fee` at creation. |
| `created_at` | `u64` | seconds | Ledger timestamp at creation. A report published before this time cannot fill the order, except a market kind filled in its creation ledger. |
| `expiration` | `u32` | ledger sequence | Last ledger the order fills at, inclusive. |

The [units](../units.md) page defines token-dec and feed precision. `notional` and `margin` are magnitudes, and the kind gives them their direction.

`Order::escrow_amount` (token-dec) is the amount of the settlement token the market holds for the row. It is `margin + exec_fee` for an increase kind and `exec_fee` for a decrease kind.

## `create_order` escrows funds and stores the row

```rust
fn create_order(e: Env, user: Address, is_long: bool, kind: u32, notional: i128, margin: i128, trigger_price: i128, price_bound: i128, expiration: u32) -> u32
```

`user` must sign the call and the escrow transfer at step 10. The return is the new order id. The call builds the row with `exec_fee` copied from `Config.exec_fee` and `created_at` set to the ledger timestamp. The checks run in this order, and the first failure traps.

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

Steps 2 to 9 run in `Order::require_valid`. `min_order_notional`, `min_order_margin`, and `max_position_notional` are `Config` fields (token-dec). A `notional` equal to `min_order_notional` passes step 4, and so does a `margin` equal to `min_order_margin`. An `expiration` equal to the current ledger sequence passes step 9.

A decrease `notional` has no cap. A decrease at or above the position's size clamps to a full close at the fill. So does one whose remaining notional would sit below `min_position_notional`. Size, margin, utilization, and the trigger are checked at the fill against the resulting position.

Step 10 raises no market error. A failed transfer traps with an error of the settlement token contract, which each deployment configures. Step 11 runs in `Position::push_decrease` after the transfer, so a trap there reverts the escrow with the rest of the transaction.

The call reads `Status`, `Config`, `Token`, `Position(user, is_long)`, and `OrderCounter(user)`. It loads the position row through `find_position` and treats a miss as the zeroed row. It stores the row back for a decrease kind. It also stores it for an increase kind when the row was missing, so the trader pays for the new row. A stored row has its time to live (TTL) extended in the user tier. The [position lifecycle](./position-lifecycle.md) page defines the row and `get_position`.

`next_order_id` allocates the id, and the call writes the row to `Order(user, id)`. A decrease kind appends `id` to `Position.decrease_orders`, and a decrease may rest before its position opens. The call publishes `CreateOrder` with the topics `user` and `id` and the data field `order`, and returns `id`.

## `cancel_order` refunds the escrow

```rust
fn cancel_order(e: Env, user: Address, id: u32) -> i128
```

`user` must sign. If the status is `Frozen`, the call traps with `MarketFrozen` (704). Every other status allows a cancel, `Retired` included. If `Order(user, id)` is absent, `get_order` traps with `OrderNotFound` (730).

`Order::refund_and_remove` transfers `Order::escrow_amount` from the market to `user` when it is above 0, then removes the row. For a decrease kind the call also removes `id` from `Position.decrease_orders` and rewrites the position. It publishes `CancelOrder` with the topics `user` and `id` and the data field `refund`, and returns `refund` (token-dec). An expired order cancels the same way and refunds in full.

:::warning Expiration does not refund escrow
`expiration` gates execution. An expired order remains stored until a cancel or a full-close sweep removes it. The cancel path refunds the escrow. Storage archival and order expiration are separate mechanisms.
:::

## Views and ids

```rust
fn get_order(e: Env, user: Address, id: u32) -> Order
fn get_order_counter(e: Env, user: Address) -> u32
```

`get_order` returns the stored row or traps with `OrderNotFound` (730). An on-chain read extends the row's TTL. `get_order_counter` returns the next unallocated id and writes nothing.

`OrderCounter(user)` is one persistent user-tier counter per trader. Trade orders and the vault orders defined on the [vault orders](./vault-orders.md) page share it. `next_order_id` allocates from `1` and adds one on every creation, so every id below the counter is allocated and never reused. For a trader who created no order, `get_order_counter` returns `1`.

Id `0` names no stored order. It is the return of `create_vault_order` for a redeem on a `Retired` market, which stores no row. It is also the `id` of the `RedeemFill` that call publishes and of the fill receipt of `execute_adl`.

## `execute_order` fills one order at the submitted report

```rust
fn execute_order(e: Env, keeper: Address, user: Address, id: u32, price: Bytes) -> i128
```

The call takes no authorization, and any account may call it. `keeper` is the address that receives the keeper payout. The caller names it, and the market never authenticates it. `price` is the serialized oracle report. The return is the keeper payout (token-dec).

The call loads the working set with `Market::load`, passing `newest_price = false` and `protective = false`. The first flag makes the fill use the submitted report even when the price cache holds a newer one. The second selects the oracle's `trade_staleness` window. Both accrual indices advance to the ledger timestamp before the call touches the position. The [pricing](./pricing.md) page defines the load.

The gates run in this order, and the first failure traps. The [price verification](../oracle/verify-price.md) page lists the report checks and errors behind step 2.

| Step | Condition | Error |
|---|---|---|
| 1 | Status is `Frozen` or `Retired` | `MarketFrozen` (704) |
| 2 | The Chainlink verifier or the oracle rejects the report | Verifier error or `OracleError`, listed on the price verification page. Skipped under a stored `TerminalPrice`. |
| 3 | `Order(user, id)` is absent | `OrderNotFound` (730) |
| 4 | Increase kind and `order.notional > 0`, and either the status is not `Active` or the side's auto-deleveraging (ADL) flag is set | `IncreaseHalted` (705) |
| 5 | `price.publish_time < Position.priced_at` | `StalePrice` (740) |
| 6 | The current ledger sequence is above `expiration` | `OrderExpired` (731) |
| 7 | `price.publish_time < created_at`, unless a market kind with `created_at` equal to the ledger timestamp | `StalePrice` (740) |
| 8 | Trigger kind and `trigger_price` is not crossed | `TriggerNotMet` (742) |
| 9 | `price_bound != 0` and the execution price is worse than the bound | `PriceBoundExceeded` (741) |

After step 3 the call decodes `order.kind` through `OrderKind::from_u32`. Creation validates the kind, so every stored row decodes and `UnknownKind` (734) cannot fire at the fill.

A zero-notional increase skips step 4, so it fills on `OnIce`, on `Delisted`, and on a flagged side. It adds margin only, so it grows no size and reserves no vault capacity. The flag is the `long` or `short` field of `AdlState`. `update_adl_state` writes it, and `execute_adl` only reads it. The [auto-deleveraging](./auto-deleveraging.md) page defines both calls.

Step 5 is `Position::require_price_not_stale`. It keeps `priced_at` monotone per row, so no fill prices behind the position's last mark. Equality passes at steps 5 and 7.

Steps 6 to 9 run in `Order::require_price_trigger_met`. Step 7 stops a report published before the order existed from filling it. A market kind created and filled in one ledger is exempt. Its report must exist before that ledger closes, so its `publish_time` can sit below the ledger timestamp. The market router's `create_and_fill` and `create_and_try_fill` make such a call. A trigger kind gets no exemption. The next section defines steps 8 and 9.

### The increase path posts the escrowed margin

`fill_increase` runs `Position::increase` with the order's `notional` and `margin` at the entry price, `ask` for a long and `bid` for a short. The path traps with `NotionalBelowMinimum` (711), `NotionalAboveMaximum` (712), `InsufficientMargin` (713), `PositionLiquidatable` (723), `OpenInterestExceeded` (715), or `SizeRoundsToZero` (716). `SizeRoundsToZero` fires when a positive `notional` buys no base size at the entry price. A zero-notional increase passes that check, and it traps `NotionalBelowMinimum` (711) when the side holds no position. The [position lifecycle](./position-lifecycle.md) and [margin and leverage](./margin-and-leverage.md) pages define each condition.

The fill publishes `OpenFill` when the side held no position before the fill, and `IncreaseFill` otherwise. It removes the order, stores the position, and settles through `Settlement::compute_increase_order`. `Position::increase` posts the escrowed margin less the settled costs. The [escrow section](#every-escrow-resolves-through-one-of-three-routes) gives the leg each cost leaves on.

When `order.notional > 0`, `Market::require_utilization` runs last with `Config.max_util_open` and `order.is_long`. It reads the settled vault balance, which already holds this fill's banked fee. The call traps with `UtilizationExceeded` (714) when the increased side's reserve exceeds `max_util_open` of half that balance. `max_util_open` is a ratio in `SCALAR_18`. The check covers the increased side only, and a zero-notional top-up skips it. The [borrowing rate](./borrowing-rate.md) page defines the reserve and the cap.

### The decrease path closes size and pays out

`fill_decrease` runs `Position::decrease` with the order's `notional` and `margin` at the exit price, `bid` for a long and `ask` for a short. The path traps with `PositionNotFound` (720), `PositionLiquidatable` (723), or `NotionalLocked` (721). `NotionalLocked` also fires when a clamped full close finds any notional still locked. A partial close validates the remaining position, so it also traps with `NotionalAboveMaximum` (712) or `InsufficientMargin` (713). The clamp to a full close keeps every survivor at or above `min_position_notional`. The [position lifecycle](./position-lifecycle.md) page defines each condition.

The fill publishes `CloseFill` when the position's `notional` is `0` after the fill, and `DecreaseFill` otherwise. It removes the order and its id from `decrease_orders`, then stores the position. A full close sweeps every other id in `decrease_orders`. `Settlement::compute_decrease_order` splits the legs, and `Settlement::settle` traps with `VaultInsolvent` (755) under the rule on the [fees and settlement](./fee-system.md) page.

## The trigger and the bound judge the execution price

`Order::check_trigger` judges the trigger and the bound against the execution price, which is the side of the spread the fill touches. A stop or a limit therefore fires on the price the fill will use. Every price here is in feed precision.

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

:::warning A zero bound permits any accepted execution price
`price_bound = 0` disables the price-bound check. A nonzero bound limits the quote used for the fill, not the trade or accrued fees.
:::

## The keeper payout is a fee share plus the execution fee

`execute_order` returns the keeper leg of the settlement (token-dec).

```
payout = floor((base + impact) * keeper_rate / SCALAR_18) + exec_fee
```

Where:

- `base` and `impact` are the fill's trade fees (token-dec). `Market::trade_fees` computes them, as the [fees and settlement](./fee-system.md) page defines.
- `keeper_rate` is `Config.keeper_rate`, a ratio in `SCALAR_18`.
- `SCALAR_18` is `1_000_000_000_000_000_000`.
- `exec_fee` is the `exec_fee` escrowed on the order (token-dec).

`Settlement::fee_split` computes `floor((base + impact) * keeper_rate / SCALAR_18)`. `Settlement::compute_increase_order` or `Settlement::compute_decrease_order` adds `exec_fee`. In words, the keeper receives its share of the trade fee, rounded down, plus the flat fee the trader escrowed.

The rows below use a `keeper_rate` of 10% and an `exec_fee` of `100_000`, both example values.

| `base + impact` | Fee share | Payout |
|---|---|---|
| `2_350_000` | `235_000` | `335_000` |
| `19` | `1` | `100_001` |
| `0` | `0` | `100_000` |

The last row is a zero-notional fill, which charges no trade fee.

`Settlement::settle` pays the keeper leg with a direct transfer of the settlement token. If `keeper` cannot receive that token, the transfer traps with the token contract's own error and the whole fill reverts. The order stays stored, and any account may fill it again under a different `keeper`. The trader leg carries a fallback instead, under the rule on the [fees and settlement](./fee-system.md) page.

## Every escrow resolves through one of three routes

Every stored order has its escrow on the market. The escrow leaves by exactly one route, a fill, a cancel, or a sweep.

An increase fill posts the escrowed margin less the settled costs on the position and pays the `exec_fee` to `keeper`. The base fee and the impact fee leave on the vault, keeper, and treasury legs. Borrowing leaves on the vault and treasury legs. Paid funding enters no leg and stays on the contract in `credit_pool`. A decrease fill pays the `exec_fee` to `keeper` and posts nothing on the position. It funds its costs from the position's margin and its realized profit and loss (PnL).

A cancel returns the whole escrow to `user`. A sweep runs when a store leaves the row with zero notional, margin, and tokens. It removes every remaining id in `decrease_orders` and returns each escrow on the trader leg. On a full close through `execute_order`, each sweep publishes a `CancelOrder` after the `CloseFill`. `execute_liquidation` and `execute_adl` publish the swept `CancelOrder` events before their receipt. A liquidation always closes in full, so it always sweeps. An `execute_adl` fill sweeps only when its close leaves the row flat.

`Position.decrease_orders` lists exactly the pending decrease orders on that side, at most `MAX_ORDERS_PER_SIDE` (8). `expiration` gates a fill only. The row's storage TTL runs on the user tier, as the [storage](./storage.md) page defines, so an expired order still cancels. Every removal of an order runs through market code, so each escrow resolves through one of the three routes.
