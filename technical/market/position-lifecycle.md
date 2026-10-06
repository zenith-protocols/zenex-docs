---
sidebar_position: 7
title: Position lifecycle
description: Position fields, increases, decreases, locks, aggregate invariants, and full-close sweeps.
---

# Position lifecycle

This page covers the `Position` row, the outcome structs, the increase and decrease paths, the decrease lock, and the store that sweeps pending decrease orders. A position is one netted row per `(user, is_long)`, stored under `DataKey::Position(Address, bool)`. An account therefore holds at most one long row and one short row in a market.

Five entries change a row, and the table names the signer and the path each one runs.

| Entry | Signer | Effect on the row |
| --- | --- | --- |
| `create_order` | `user` | A decrease kind appends the order id to `decrease_orders`. Any kind stores a zeroed row when none exists. |
| `cancel_order` | `user` | A decrease kind removes the order id from `decrease_orders`. |
| `execute_order` | none | An increase kind runs `Position::increase`. A decrease kind runs `Position::decrease` with `is_adl` unset. |
| `execute_adl` | none | Runs `Position::decrease` with `is_adl` set and a withdrawal of `0`. |
| `execute_liquidation` | none | Runs `Position::liquidate`. |

The three keeper entries are permissionless. Their `keeper` argument names the reward recipient and never authorizes anything. Each one can change the size, the margin, and the accrual snapshots of the row.

The neighbouring pages own the rules this page uses. [Margin and leverage](./margin-and-leverage.md) gives the validity checks and settled equity. [PnL and the profit cap](./pnl-calculation.md) gives the profit and loss (PnL) formula and the profit haircut. [Funding rate](./funding-rate.md) gives the accrual settlement. [Fee system](./fee-system.md) gives `Market::trade_fees`, the impact fee ceiling, and the `Settlement` legs that pay a trader. [Liquidation](./liquidation.md) gives the forced close and its fee.

Units follow [Units and scales](../units.md). `math::to_tokens_floor` computes `floor(notional * SCALAR_18 / price)` and `math::to_tokens_ceil` computes `ceil(notional * SCALAR_18 / price)`. Both take a token-dec `notional` and a feed-precision `price` and return a base-dec size. Seconds are the unix ledger timestamp. Every formula names the symbol that computes it.

## One row holds one side of one account

| Field | Type | Unit | Meaning |
| --- | --- | --- | --- |
| `margin` | `i128` | token-dec | The posted margin, net of every debited fee. |
| `notional` | `i128` | token-dec | The size in quote. `0` means no open position. |
| `tokens` | `i128` | base-dec | The size in base. The implied entry price is `notional * SCALAR_18 / tokens`, in feed precision. |
| `funding_idx` | `i128` | `SCALAR_18` | The funding index of the side, snapshot at the last change. |
| `borrowing_idx` | `i128` | `SCALAR_18` | The borrowing index of the side, snapshot at the last change. |
| `locked_notional` | `i128` | token-dec | The notional under the decrease lock. |
| `unlocks_at` | `u64` | seconds | The lock deadline. `locked_notional` counts while `now < unlocks_at`. |
| `priced_at` | `u64` | seconds | The `publish_time` of the last fill's price. |
| `decrease_orders` | `Vec<u32>` | order ids | The pending decrease order ids on the side, at most `MAX_ORDERS_PER_SIDE` (8). |

The row carries no PnL field, because PnL follows from `tokens`, `notional`, and the current price. [Pricing](./pricing.md#the-position-price-floor) gives the price floor that reads `priced_at`.

`Position::store` treats a row as closed when `notional == 0 && margin == 0 && tokens == 0`. The test reads those three fields alone, so a closed row can still carry decrease order ids. `create_order` stores a row that is all zero apart from that list when a decrease rests on a side that has never opened. For an increase order on a side with no row, it stores the plain zeroed row. The creation transaction's fee payer therefore funds the entry's rent. `Position::zeroed` builds the canonical closed row, with every field at `0` and an empty `decrease_orders` list. A closed position persists as that row, so the prepaid rent of the entry stays alive for a later open.

## `get_position` reads without writing

```rust
fn get_position(e: Env, user: Address, is_long: bool) -> Position;
```

`get_position` needs no signer and raises no error. A hit extends the persistent time to live (TTL) of the row with `LEDGER_THRESHOLD_USER` and `LEDGER_BUMP_USER`. A miss returns the zeroed row and writes nothing. [Storage](./storage.md) gives the TTL values. The market reads the same row through `Position::load`:

```rust
fn load(e: &Env, user: &Address, is_long: bool) -> Position;
fn zeroed(e: &Env) -> Position;
```

Neither `load` nor `zeroed` raises an error, and `load` follows the same rule as `get_position`.

## Each path returns one outcome struct

Every position path returns one struct that the keeper entry publishes and settles. All amounts are token-dec unless marked.

`Fees` carries the itemized costs that one action settles:

| Field | Meaning |
| --- | --- |
| `base` | The skew-split trade fee. |
| `impact` | The size-quadratic impact fee on the full notional of the fill. |
| `funding` | The signed funding accrual. A positive value is paid by the position and raises `MarketData.credit_pool`. A negative value is earned and raises `ClaimableCredit(user)`. |
| `borrowing` | The borrowing accrual, never negative. |

`Fees::debit` returns `base + impact + borrowing + max(funding, 0)`, the total fee charge of the call. An increase debits it from the margin. A decrease pays it from realized profit first and debits only the uncovered remainder from the margin, as step 9 of `Position::decrease` shows. Earned funding never enters the debit. It is credited separately, under the rule on [Funding rate](./funding-rate.md).

`Increase` is the outcome of `Position::increase`:

| Field | Unit | Meaning |
| --- | --- | --- |
| `tokens` | base-dec | The base size bought at the entry price. |
| `fees` | `Fees` | The costs that the increase settled. |

`Decrease` is the outcome of `Position::decrease`, for a partial close and for a full close:

| Field | Unit | Meaning |
| --- | --- | --- |
| `notional` | token-dec | The closed size, the request clamped to the position. |
| `tokens` | base-dec | The base size closed. |
| `margin` | token-dec | The requested withdrawal on a partial close. The freed gross margin on a full close. |
| `pnl` | token-dec | The realized PnL on the closed fraction, after the haircut, signed, gross of the settled costs. |
| `returned` | token-dec | The payout owed to the trader, net of the settled costs. |
| `bad_debt` | token-dec | The shortfall that the vault absorbs, made of fees and losses past the freed margin. |
| `fees` | `Fees` | The costs that the decrease settled. |

`Liquidation` is the outcome of `Position::liquidate`:

| Field | Unit | Meaning |
| --- | --- | --- |
| `notional` | token-dec | The force-closed size. |
| `tokens` | base-dec | The force-closed base size. |
| `margin` | token-dec | The freed margin, gross of the settled costs. |
| `pnl` | token-dec | The realized PnL over the whole position, after the haircut, signed. |
| `bad_debt` | token-dec | The shortfall that the vault absorbs. |
| `returned` | token-dec | The remainder owed to the trader, net of `liq_fee`. |
| `liq_fee` | token-dec | The liquidation fee charged. |
| `fees` | `Fees` | The costs that the liquidation settled. |

`Increase::publish_receipt` publishes `OpenFill` (topic `open_fill`) when `opened` is set, and `IncreaseFill` (topic `increase_fill`) otherwise. The keeper entry sets `opened` when the row held no size before the fill.

```rust
fn publish_receipt(&self, e: &Env, user: &Address, id: u32, is_long: bool, keeper: &Address, price: i128, notional: i128, margin: i128, opened: bool);
```

`Decrease::publish_receipt` publishes `CloseFill` (topic `close_fill`) when `closed` is set, and `DecreaseFill` (topic `decrease_fill`) otherwise. The keeper entry sets `closed` when the `notional` of the row is `0` after the fill.

```rust
fn publish_receipt(&self, e: &Env, user: &Address, id: u32, is_long: bool, keeper: &Address, price: i128, closed: bool);
```

Neither call raises an error. [Events](./events.md) gives the payloads. The `Liquidation` outcome reaches the `liquidation` event through `execute_liquidation`, which [Liquidation](./liquidation.md) documents.

## An increase buys size at the entry side

```rust
fn increase(&mut self, e: &Env, market: &mut Market, user: &Address, is_long: bool, notional: i128, margin: i128) -> Increase;
```

`notional` and `margin` are the magnitudes of the filled order (token-dec), each at or above zero. The keeper entry has already resolved the effective price and advanced both accrual indices. `market` carries that price, the `Config` values, and the per-side aggregates that the call changes. `is_long` picks the side of every aggregate and of the two index pairs. `user` keys the claimable credit that earned funding writes.

A `Position` holds neither the account nor the side, so the caller passes the same `user` and `is_long` that it loaded the row under. `Position::decrease` and `Position::liquidate` take `market`, `user`, and `is_long` under the same rule.

`Position::increase` runs ten steps in this order:

1. `entry_price = price.entry(is_long)` (feed precision). [Pricing](./pricing.md) gives the side rule of `PriceData::entry`.
2. `tokens_added` (base-dec) is `math::to_tokens_floor(notional, entry_price)` for a long and `math::to_tokens_ceil(notional, entry_price)` for a short. The entry size rounds against the trader. A floored short size would be worth less than its notional. A round trip at an unchanged price would then pay the trader up to one base unit.
3. If `notional > 0` and `tokens_added == 0`, the call traps `SizeRoundsToZero` (716). Such an increase would carry a notional with no exposure behind it. Only a long can trigger this trap, because the ceiling of a positive notional is at least `1`.
4. `Position::settle_accruals` settles the funding and the borrowing on the pre-fill `notional`. Both are `0` on a row with no size, and both are `0` when the two snapshots already equal the side indices.
5. `Market::trade_fees(is_long, notional, tokens_added)` returns `base` and `impact` (token-dec). Both are `0` when `notional` is `0`.
6. The row and the side aggregate move together. The `tokens` of the row grows by `tokens_added`, its `notional` by the filled `notional`, and its `margin` by the posted `margin` minus `fees.debit`. The side of `MarketData.tokens`, `MarketData.notional`, and `MarketData.margin` takes the same three deltas. If the fees exceed the posted margin, the margin delta is negative.
7. If `notional > 0`, `locked_notional` becomes the value of `Position::locked` at `now` plus `notional`, and `unlocks_at = now + notional_lock` (seconds). An expired bucket is replaced. A live bucket grows and its deadline resets.
8. `priced_at = price.publish_time`.
9. `Position::require_valid` runs with `is_adl = false`. It traps on the first violation, in this order: `NotionalBelowMinimum` (711), `NotionalAboveMaximum` (712), `InsufficientMargin` (713), `PositionLiquidatable` (723). [Margin and leverage](./margin-and-leverage.md) gives the conditions.
10. If `notional > 0` and the `MarketData.notional` of the side exceeds `max_open_interest` (token-dec), the call traps `OpenInterestExceeded` (715). Otherwise the call returns `Increase { tokens: tokens_added, fees }`.

A margin-only increase carries `notional == 0`. It buys no size, so it skips step 3. It pays no trade fee, leaves the lock bucket alone, and skips the open interest check at step 10. On a row with no size it traps `NotionalBelowMinimum` (711) at step 9, because `min_position_notional` (token-dec) is above zero.

A fill of an increase order also runs `Market::require_utilization` after `Position::increase` returns. That gate reads the increased side only and runs for a size-growing fill. [Margin and leverage](./margin-and-leverage.md#utilization) gives it.

## A decrease pays fees from profit before margin

```rust
fn decrease(&mut self, e: &Env, market: &mut Market, user: &Address, is_long: bool, notional: i128, margin: i128, is_adl: bool) -> Decrease;
```

`notional` is the size to close and `margin` is the requested withdrawal, both token-dec magnitudes. `is_adl` marks a forced close from `execute_adl`. Auto-deleveraging (ADL) reaches the same full-close clamp at step 4. The variables below are token-dec unless marked. `self.notional` and `self.margin` (token-dec) and `self.tokens` (base-dec) are the values of the row before the call. `now` is the ledger timestamp. `price` is the effective `PriceData` of the call (feed precision), resolved by `Market::load`.

`Position::decrease` runs fifteen steps in this order:

1. `Position::require_exists` traps `PositionNotFound` (720) when `self.notional` is `0`.
2. `Position::settle` produces `settled` for the whole position. If `settled.equity` sits below the maintenance line, the call traps `PositionLiquidatable` (723). A decrease cannot close a liquidatable position. An increase can still rescue it with sufficient margin.
3. `locked` is the value of `Position::locked` at `now`.
4. The full-close clamp applies. If `notional >= self.notional`, or `self.notional - notional < min_position_notional`, the request is a full close. A full close with `locked > 0` traps `NotionalLocked` (721). Otherwise the call returns `close_settled(settled)`, and steps 5 to 15 do not run.
5. A partial close with `notional > self.notional - locked` traps `NotionalLocked` (721).
6. `closed_tokens = math::prorate(self.tokens, notional, self.notional) = floor(self.tokens * notional / self.notional)` (base-dec). The survivor keeps the implied entry.
7. `Market::trade_fees(is_long, -notional, -closed_tokens)` returns `base` and `impact` for the closed fraction. `funding` and `borrowing` come from `settled.fees`, which step 2 settled once on the full pre-close size. `fees = Fees { base, impact, funding, borrowing }`.
8. `pnl = math::pnl(closed_tokens, notional, price, is_long)` and `capped_pnl = Market::haircut_pnl(is_long, pnl)`. The haircut reads the book before this decrease changes it.
9. `total_fees = fees.debit`. `profit = max(capped_pnl, 0)`. `loss = min(capped_pnl, 0)`. `covered = min(total_fees, profit)`. `uncovered = total_fees - covered`. The realized profit pays the fees first, and the margin pays the uncovered rest.
10. `withdrawal = min(margin, max(self.margin + loss - uncovered, 0))`. The withdrawal claims last, so a withdrawal never creates bad debt.
11. `margin_change = loss - uncovered - withdrawal`. `next_margin = self.margin + margin_change`. `bad_debt = max(-next_margin, 0)`. The margin of the row becomes `max(next_margin, 0)`. The side of `MarketData.margin` moves by `margin_change + bad_debt`, so the aggregate mirrors the floored row.
12. `priced_at = price.publish_time`.
13. `self.notional -= notional` and `self.tokens -= closed_tokens`. The side of `MarketData` moves by the same two deltas.
14. `Position::require_valid` runs on the survivor with the given `is_adl`. It traps `NotionalAboveMaximum` (712), `InsufficientMargin` (713), or `PositionLiquidatable` (723). The clamp at step 4 keeps the survivor at or above `min_position_notional`, so `NotionalBelowMinimum` (711) cannot fire here. When `is_adl` is set, the call skips the 713 check.
15. The call returns `Decrease { notional, tokens: closed_tokens, margin, pnl: capped_pnl, returned: withdrawal + (profit - covered), bad_debt, fees }`.

On a partial close, `withdrawal` from step 10 is the amount actually paid. It reaches the trader inside `returned` and not in `margin`.

A margin-only withdrawal carries `notional == 0`. The clamp at step 4 does not fire while the `notional` of the row is at or above `min_position_notional`. The request then runs as a partial close of size zero. Steps 6 to 8 give `closed_tokens`, `base`, `impact`, and `capped_pnl` of `0`. The funding and borrowing accrued since the last change still debit the margin. Step 14 traps `InsufficientMargin` (713) when the remaining margin falls below the initial-margin floor, unless `is_adl` is set.

If a config change raised `min_position_notional` above the `notional` of the row, the clamp fires and the withdrawal becomes a full close. The `margin` argument is then ignored. The trader receives `returned = max(settled.equity, 0)`, which is the whole settled equity and not the requested withdrawal. If any notional is still locked, the call traps `NotionalLocked` (721). It cannot trap `InsufficientMargin` (713).

`Position::decrease` holds one identity over the fields it returns on a partial close.

```text
returned + fees.debit == (margin_before - margin_after) + pnl + bad_debt
```

Where:

- `margin_before` and `margin_after` are the `margin` of the row before and after the call (token-dec).
- `pnl` is `capped_pnl` from step 8 (token-dec, signed).
- `returned`, `bad_debt`, and `fees` are the returned fields (token-dec).

In words, the payout plus the fees equals the margin the row loses, plus the PnL, plus the shortfall that the vault absorbs. The table runs steps 9 to 11 on a row of `100` margin with a requested withdrawal of `20` and a `fees.debit` of `3`. The values are whole settlement tokens and illustrate the formula only.

| `capped_pnl` | `covered` | `uncovered` | `withdrawal` | `next_margin` | `bad_debt` | `returned` |
| --- | --- | --- | --- | --- | --- | --- |
| +10 | 3 | 0 | 20 | 80 | 0 | 27 |
| -30 | 0 | 3 | 20 | 47 | 0 | 20 |
| -98 | 0 | 3 | 0 | -1 | 1 | 0 |

In the third row the loss and the fee exceed the margin by `1`. The margin of the row floors at `0` and the aggregate takes the `bad_debt` back. The identity reads `0 + 3 = (100 - 0) + (-98) + 1`.

### A full close settles the whole position at once

```rust
fn close_settled(&mut self, market: &mut Market, is_long: bool, settled: Settled) -> Decrease;
```

`Position::close_settled` closes the whole position against the numbers from `Position::settle`. `settled` holds `fees`, `pnl`, and `equity`, each over the whole position and each with the haircut and the full-size trade fees applied. [Margin and leverage](./margin-and-leverage.md#settled-equity) defines `settled.equity`.

`returned = max(settled.equity, 0)` and `bad_debt = max(-settled.equity, 0)`. The side of `MarketData` loses the full `notional`, `tokens`, and `margin` of the row. The `notional`, `tokens`, `margin`, `locked_notional`, and `unlocks_at` of the row become `0`. `close_settled` leaves `priced_at` unchanged. `Position::store` then writes `Position::zeroed` over the closed row, which sets `priced_at` to `0`.

The returned `Decrease` carries the full size, the gross margin from before the row zeroed, `settled.pnl`, and `settled.fees`. `close_settled` raises no error of its own, because every gate runs before it. Step 2 of `Position::decrease` traps a liquidatable row, so a full close on that path returns a `bad_debt` of `0`. `Position::liquidate` runs the same function without that gate and then charges `liq_fee` from `returned`.

## The decrease lock stops an open-then-decrease round trip

`Position::locked` returns `locked_notional` while `now < unlocks_at`, and `0` after the deadline. `Position::increase` sets the bucket at step 7 on every fill that adds size. `Config.notional_lock` is the lock length in seconds, and [Config](./config.md) gives its bounds. A full close needs `Position::locked` to return `0` at `now`. A partial close is limited to `self.notional` minus the value that `Position::locked` returns at `now`. Both violations trap `NotionalLocked` (721).

The lock gates `Position::decrease` alone, so `execute_adl` meets it and `Position::liquidate` does not read it. The reason is the price window. The oracle bounds its trade-class staleness window by `MAX_TRADE_STALENESS_SECONDS` (15 seconds), and `MIN_NOTIONAL_LOCK` (15 seconds) is sized to that ceiling. The lock therefore outlasts the validity of any single accepted price, so one price cannot both open size and decrease that same size.

:::info New size can delay a voluntary close
Each size increase grows the live lock bucket and resets its deadline. A full close needs every locked portion to unlock.

Liquidation bypasses this lock. Auto-deleveraging meets the same lock as a voluntary decrease.
:::

## A closed row sweeps its pending decrease orders

```rust
fn store(&self, e: &Env, user: &Address, is_long: bool) -> i128;
```

`Position::store` persists the row and returns the escrow (token-dec) that the caller owes back to `user`. It tests `closed = notional == 0 && margin == 0 && tokens == 0`. When the row survives, it stores `self` and returns `0`.

When the row is closed, it runs the closure sweep over every `id` in `decrease_orders`. For each id it loads the order with `get_order` and adds the `Order::escrow_amount` of that order to the refund. It then removes the order and publishes `CancelOrder` (topic `cancel_order`) with `refund: escrow`, the escrow of that one order. An absent order row traps `OrderNotFound` (730). The sweep then stores `Position::zeroed`, so the list is empty on the next open. The caller pays the summed refund to the trader through its settlement.

`set_position` writes the row and extends its TTL with `LEDGER_THRESHOLD_USER` and `LEDGER_BUMP_USER`. A closed row is written too, as the zeroed row.

An increase never closes a row, so a fill through `Position::increase` never sweeps. On a full close through `execute_order`, the filled order leaves the list before the store, so the sweep never refunds it twice. `execute_order` publishes the fill receipt before the sweep. `execute_adl` and `execute_liquidation` store first, so their `CancelOrder` events precede the receipt.

```rust
fn push_decrease(&mut self, e: &Env, id: u32);
fn remove_decrease(&mut self, e: &Env, id: u32);
```

`push_decrease` appends a pending decrease order id. When the list already holds `MAX_ORDERS_PER_SIDE` (8) ids, it traps `TooManyOrders` (733). The cap bounds the closure sweep, so a full close stays inside the per-transaction limits. `remove_decrease` drops one id and keeps the rest in order. It raises no error, and an id that the list does not hold leaves the list unchanged. `create_order` pushes. `cancel_order` and a decrease fill remove.

## The aggregates mirror the rows

The sum over every position of `notional`, `tokens`, and `margin` on a side equals `MarketData.notional`, `MarketData.tokens`, and `MarketData.margin` for that side. Every step above applies the same delta to the row and to the aggregate.

On a partial close the margin of the row floors at zero. `Position::decrease` therefore adds `bad_debt` back into the margin aggregate, and the mirror holds. A full close and a liquidation move the aggregate by the whole margin of the row, which is never negative, so `Position::close_settled` needs no add-back.

A fill through `execute_order` is exactly one order. `Position::increase` and `Position::decrease` each consume that order in full, and the fill removes it either way. The full-close rule at step 4 clamps the size leg of a decrease, and step 10 clamps its margin leg again. A payout below the requested withdrawal still consumes the order, so an order never fills in parts.

`execute_adl` runs `Position::decrease` on an amount that the keeper supplies and carries no order, so its fill receipt reports the order id `0`. An assigned order id starts at `1`, so `0` never names a pending order.

The receipt of any fill therefore reconciles against the row and the aggregate. The row and the side aggregate change by the same size, token, and margin deltas. The identity above splits the margin leg into the payout, the fees, and the bad debt.
