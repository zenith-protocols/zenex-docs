---
sidebar_position: 7
title: Position lifecycle
---

# Position lifecycle

A position is one netted row per `(user, is_long)`, stored under `DataKey::Position(Address, bool)`. The keeper entries that change a position row are `execute_order`, `execute_adl`, and `execute_liquidation`. Each changes the size, the margin, and the accrual snapshots. `execute_order` runs `Position::increase` or `Position::decrease`. `execute_adl` runs `Position::decrease`. `execute_liquidation` runs `Position::liquidate`. `create_order` and `cancel_order` write the `decrease_orders` field on a decrease order kind, and the trader must sign both calls. This page documents the row, the outcome structs, the increase and decrease paths, the decrease lock, and the store. The validity checks are on [Margin and leverage](./margin-and-leverage.md). The formula for profit and loss (PnL) and the profit haircut are on [PnL and the profit cap](./pnl-calculation.md). The accrual settlement is on [Funding rate](./funding-rate.md). `Market::trade_fees`, the impact fee ceiling, and the `Settlement` legs that pay a trader are on [Fee system](./fee-system.md).

Units on this page: token-dec is the settlement token's decimals. A price is in feed precision, the scale the [units page](../units.md) defines. base-dec is the `tokens` scale, where `math::to_tokens` computes `tokens = floor(notional * SCALAR_18 / price)` from a token-dec `notional` and a feed-precision `price`. `SCALAR_18` is `1_000_000_000_000_000_000`. Seconds are the unix ledger timestamp. Every formula names the symbol that computes it.

## The `Position` row

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

PnL is implied from `tokens`, `notional`, and the current price, so the row carries no PnL field. The price floor that reads `priced_at` is on [Pricing](./pricing.md).

A row is closed when `notional == 0 && margin == 0 && tokens == 0`. The test reads those three fields alone, so a closed row may still carry decrease order ids. `create_order` rests a decrease on a side that has never opened, which stores a row that is all zero apart from that list. `Position::zeroed` builds the canonical closed row, with every field at `0` and an empty `decrease_orders` list. A closed position persists as the zeroed row, so the entry's prepaid rent stays alive for a later open.

## Read a position

```rust
fn get_position(e: Env, user: Address, is_long: bool) -> Position;
```

`get_position` needs no signer and raises no error. It returns the stored row, or the zeroed row when none exists. On chain, a miss writes the zeroed row to persistent storage in the user tier, and every read extends the row's TTL to that tier. The TTL values are on [Storage](./storage.md). The market reads the same row through `Position::load`:

```rust
fn load(e: &Env, user: &Address, is_long: bool) -> Position;
fn zeroed(e: &Env) -> Position;
```

Neither `load` nor `zeroed` raises an error.

## Outcome structs

Every position path returns one struct that the keeper entry publishes and settles. All amounts are token-dec unless marked.

`Fees` carries the itemized costs one action settles:

| Field | Meaning |
| --- | --- |
| `base` | The skew-split trade fee. |
| `impact` | The size-quadratic impact fee on the fill's full notional. |
| `funding` | The signed funding accrual. Positive is paid and banked to the `credit_pool`. Negative is earned and claimable. |
| `borrowing` | The borrowing accrual, never negative. |

`Fees::debit` returns `base + impact + borrowing + max(funding, 0)`, the amount debited from the margin. Earned funding never enters the debit. It is credited separately, under the rule on [Funding rate](./funding-rate.md).

`Increase` is the outcome of `Position::increase`:

| Field | Unit | Meaning |
| --- | --- | --- |
| `tokens` | base-dec | The base size bought at the entry price. |
| `fees` | `Fees` | The costs the increase settled. |

`Decrease` is the outcome of `Position::decrease`, for a partial close and for a full close:

| Field | Unit | Meaning |
| --- | --- | --- |
| `notional` | token-dec | The closed size, the request clamped to the position. |
| `tokens` | base-dec | The base size closed. |
| `margin` | token-dec | The requested withdrawal on a partial close. The freed gross margin on a full close. |
| `pnl` | token-dec | The realized PnL on the closed fraction, post-haircut, signed, gross of the settled costs. |
| `returned` | token-dec | The payout owed to the trader, net of the settled costs. |
| `bad_debt` | token-dec | The shortfall the vault absorbs: fees and losses past the freed margin. |
| `fees` | `Fees` | The costs the decrease settled. |

`Liquidation` is the outcome of `Position::liquidate`:

| Field | Unit | Meaning |
| --- | --- | --- |
| `notional` | token-dec | The force-closed size. |
| `tokens` | base-dec | The force-closed base size. |
| `margin` | token-dec | The freed margin, gross of the settled costs. |
| `pnl` | token-dec | The realized PnL over the whole position, post-haircut, signed. |
| `bad_debt` | token-dec | The shortfall the vault absorbs. |
| `returned` | token-dec | The remainder owed to the trader, net of `liq_fee`. |
| `liq_fee` | token-dec | The liquidation fee charged. |
| `fees` | `Fees` | The costs the liquidation settled. |

The liquidation path and its fee are on [Liquidation](./liquidation.md).

`Increase::publish_receipt` publishes `OpenFill` when `opened` is set, and `IncreaseFill` otherwise. The keeper entry sets `opened` when the trader's own row held no size before the fill.

```rust
fn publish_receipt(&self, e: &Env, user: &Address, id: u32, is_long: bool, keeper: &Address, price: i128, notional: i128, margin: i128, opened: bool);
```

`Decrease::publish_receipt` publishes `CloseFill` when `closed` is set, and `DecreaseFill` otherwise. The keeper entry sets `closed` when the row's `notional` is `0` after the fill.

```rust
fn publish_receipt(&self, e: &Env, user: &Address, id: u32, is_long: bool, keeper: &Address, price: i128, closed: bool);
```

Neither call raises an error. The payloads are on [Events](./events.md).

## Increase

```rust
fn increase(&mut self, e: &Env, market: &mut Market, user: &Address, is_long: bool, notional: i128, margin: i128) -> Increase;
```

`notional` and `margin` are the filled order's magnitudes (token-dec), each at or above zero. The keeper entry has already resolved the effective price and advanced both accrual indices. `market` carries that price, the `Config` values, and the per-side aggregates the call mutates. `is_long` picks the side of every aggregate and of the two index pairs. `user` keys the claimable credit that earned funding writes. A `Position` holds neither the account nor the side, so the caller passes the same `user` and `is_long` it loaded the row under. `Position::decrease` and `Position::liquidate` take `market`, `user`, and `is_long` under the same rule. `Position::increase` runs nine steps in this order:

1. `entry_price = price.entry(is_long)` (feed precision), which is `ask` for a long and `bid` for a short. `tokens_added = to_tokens(notional, entry_price) = floor(notional * SCALAR_18 / entry_price)` (base-dec).
2. `settle_accruals` banks the funding and the borrowing on the pre-fill `notional`. Both are `0` on a row with no size.
3. `trade_fees(is_long, notional, tokens_added)` returns `base` and `impact` (token-dec). Both are `0` when `notional` is `0`.
4. The row and the side aggregate move together. The row's `tokens` grows by `tokens_added`, its `notional` by the filled `notional`, and its `margin` by the posted `margin` minus `fees.debit`. The side of `MarketData.tokens`, `MarketData.notional`, and `MarketData.margin` takes the same three deltas. If the fees exceed the posted margin, the margin delta is negative.
5. If `notional > 0`, the lock bucket becomes `locked_notional = locked(now) + notional` and `unlocks_at = now + notional_lock` (seconds). An expired bucket is replaced. A live one grows and its deadline resets.
6. `priced_at = price.publish_time`.
7. `require_valid` runs with `is_adl = false`. It traps `NotionalBelowMinimum` (711), `NotionalAboveMaximum` (712), `InsufficientMargin` (713), or `PositionLiquidatable` (723). The conditions are on [Margin and leverage](./margin-and-leverage.md).
8. If `notional > 0` and the side's `MarketData.notional` exceeds `max_open_interest` (token-dec), the call traps `OpenInterestExceeded` (715).
9. The call returns `Increase { tokens: tokens_added, fees }`.

A margin-only increase carries `notional == 0`. It pays no trade fee. It leaves the lock bucket alone. It skips step 8. On a row with no size it traps `NotionalBelowMinimum` (711) at step 7, because `min_position_notional` (token-dec) is above zero.

## Decrease

```rust
fn decrease(&mut self, e: &Env, market: &mut Market, user: &Address, is_long: bool, notional: i128, margin: i128, is_adl: bool) -> Decrease;
```

`notional` is the size to close and `margin` is the withdrawal requested, both token-dec magnitudes. `is_adl` marks a forced close from `execute_adl`, which reaches the same full-close clamp at step 4. The variables below are token-dec unless marked. `self.notional` and `self.margin` (token-dec) and `self.tokens` (base-dec) are the row's values before the call. `now` is the ledger timestamp. `price` is the call's effective `PriceData` (feed precision), resolved by `Market::load`. `Position::decrease` runs fifteen steps in this order:

1. `require_exists`: a `self.notional` of `0` traps `PositionNotFound` (720).
2. `Position::settle` produces `settled` for the whole position. If the settled equity sits below the maintenance line, the call traps `PositionLiquidatable` (723). Liquidation is the only legal transition for a liquidatable position.
3. `locked = locked(now)`.
4. Full-close clamp. If `notional >= self.notional`, or `self.notional - notional < min_position_notional`, the request is a full close. A full close with `locked > 0` traps `NotionalLocked` (721). Otherwise the call returns `close_settled(settled)`, and steps 5 to 15 do not run.
5. A partial close with `notional > self.notional - locked` traps `NotionalLocked` (721).
6. `closed_tokens = prorate(self.tokens, notional, self.notional) = floor(self.tokens * notional / self.notional)` (base-dec). The survivor keeps the implied entry.
7. `trade_fees(is_long, -notional, -closed_tokens)` returns `base` and `impact` for the closed fraction. `funding` and `borrowing` come from `settled.fees`, banked once at step 2 on the full pre-close size. `fees = Fees { base, impact, funding, borrowing }`.
8. `pnl = math::pnl(closed_tokens, notional, price, is_long)` and `capped_pnl = haircut_pnl(is_long, pnl)`. The haircut is measured on the book before this decrease mutates it.
9. `total_fees = fees.debit`. `profit = max(capped_pnl, 0)`. `loss = min(capped_pnl, 0)`. `covered = min(total_fees, profit)`. `uncovered = total_fees - covered`. The realized profit pays the fees first, and the margin pays the uncovered rest.
10. `withdrawal = min(margin, max(self.margin + loss - uncovered, 0))`. The withdrawal claims last and caps at the margin that survives the loss and the uncovered fees.
11. `margin_change = loss - uncovered - withdrawal`. `next_margin = self.margin + margin_change`. `bad_debt = max(-next_margin, 0)`. The row's margin becomes `max(next_margin, 0)`. The side of `MarketData.margin` moves by `margin_change + bad_debt`, so the aggregate mirrors the floored row.
12. `priced_at = price.publish_time`.
13. `self.notional -= notional` and `self.tokens -= closed_tokens`. The side of `MarketData` moves by the same two deltas.
14. `require_valid` runs on the survivor with the given `is_adl`. It traps `NotionalAboveMaximum` (712), `InsufficientMargin` (713), or `PositionLiquidatable` (723). The clamp at step 4 keeps the survivor at or above `min_position_notional`. When `is_adl` is set, the call skips the 713 check.
15. The call returns `Decrease { notional, tokens: closed_tokens, margin, pnl: capped_pnl, returned: withdrawal + (profit - covered), bad_debt, fees }`.

On a partial close the `margin` field of the returned `Decrease` is the requested withdrawal from the argument. A full close carries the row's gross margin in the same field. The amount actually paid on a partial close is `withdrawal` from step 10, and it reaches the trader inside `returned`.

A margin-only withdrawal carries `notional == 0`. The clamp at step 4 does not fire while the row's `notional` is at or above `min_position_notional`, so the survivor keeps the full size. If a config change raised `min_position_notional` above the row's `notional`, the clamp fires and the withdrawal closes the whole position. Step 6 gives a `closed_tokens` of `0`, step 7 charges no trade fee, and step 8 gives a `capped_pnl` of `0`. Step 10 caps the payout at the margin that survives the settled costs. Step 14 still traps `InsufficientMargin` (713) when the remaining margin falls below the initial-margin floor, unless `is_adl` is set.

`Position::decrease` holds one invariant over the fields it returns on a partial close. All terms are token-dec. `margin_before` and `margin_after` are the row's `margin` before and after the call. `pnl` is `capped_pnl` from step 8. `returned`, `bad_debt`, and `fees` are the returned fields:

```text
returned + fees.debit == (margin_before - margin_after) + pnl + bad_debt
```

### Full close

`Position::close_settled` closes the whole position against the numbers from `Position::settle`. `settled` holds the full-size fees, the haircut PnL, and the settled equity. The equity is `equity = margin - fees.debit + pnl` (token-dec, signed). Every term covers the whole position.

```rust
fn close_settled(&mut self, market: &mut Market, is_long: bool, settled: Settled) -> Decrease;
```

`returned = max(settled.equity, 0)` and `bad_debt = max(-settled.equity, 0)`. The side of `MarketData` loses the row's full `notional`, `tokens`, and `margin`. The row's `notional`, `tokens`, `margin`, `locked_notional`, and `unlocks_at` become `0`. `close_settled` leaves `priced_at` unchanged. `Position::store` then writes `Position::zeroed` over the closed row, which sets `priced_at` to `0`. The returned `Decrease` carries the full size, the gross margin before it zeroed, `settled.pnl`, and `settled.fees`. `close_settled` raises no error of its own, because `Position::decrease` runs every gate before it. `Position::liquidate` runs the same function and then charges `liq_fee` from `returned`.

## The decrease lock

`locked(now)` returns `locked_notional` while `now < unlocks_at`, and `0` after the deadline. `Position::increase` sets the bucket at step 5 on every fill that adds size. `Config.notional_lock` is the lock length in seconds, and its bounds are on [Config](./config.md). A full close needs a `locked(now)` of `0`. A partial close is limited to `self.notional - locked(now)`. Both violations trap `NotionalLocked` (721). The lock gates `Position::decrease` alone. `Position::liquidate` does not read it.

## Store and sweep

```rust
fn store(&self, e: &Env, user: &Address, is_long: bool) -> i128;
```

`Position::store` persists the row and returns the escrow (token-dec) the caller owes back to `user`. It tests `closed = notional == 0 && margin == 0 && tokens == 0`. When the row survives, it stores `self` and returns `0`. When the row is closed, it runs the closure sweep over every `id` in `decrease_orders`. For each id it loads the order with `get_order` and adds that order's `Order::escrow_amount` to the refund. It then removes the order and publishes `CancelOrder { user, id, refund: escrow }`, whose `refund` field carries that one order's escrow. An absent order row traps `OrderNotFound` (730). The sweep then stores `Position::zeroed`, so the list is empty on the next open. The caller pays the summed refund to the trader through its settlement.

An increase never closes a row, so a fill through `Position::increase` never sweeps. On a full close through `execute_order`, the filled order leaves the list before the store, so the sweep never refunds it twice.

```rust
fn push_decrease(&mut self, e: &Env, id: u32);
fn remove_decrease(&mut self, e: &Env, id: u32);
```

`push_decrease` appends a pending decrease order id. When the list already holds `MAX_ORDERS_PER_SIDE` (8) ids, it traps `TooManyOrders` (733). The cap bounds the closure sweep, so a full close stays inside the per-transaction limits. `remove_decrease` drops one id and keeps the rest in order. It raises no error, and an id that the list does not hold leaves the list unchanged. `create_order` pushes, and `cancel_order` and a decrease fill remove.

## Invariants

The per-side aggregates mirror the rows. The sum over every position of `notional`, `tokens`, and `margin` on a side equals `MarketData.notional`, `MarketData.tokens`, and `MarketData.margin` for that side. Every step above applies the same delta to the row and to the aggregate. On a partial close the row's margin floors at zero, so `Position::decrease` adds `bad_debt` back into the margin aggregate and the mirror holds. A full close and a liquidation move the aggregate by the row's whole margin, which is never negative, so `Position::close_settled` needs no add-back.

A fill through `execute_order` is exactly one order. `Position::increase` and `Position::decrease` each consume that order in full, and the fill removes it either way. The size leg of a decrease is clamped by the full-close rule at step 4, and its margin leg is clamped again at step 10. A payout below the requested withdrawal still consumes the order. An order never fills in parts. `execute_adl` runs `Position::decrease` on a keeper-supplied amount and carries no order, so its fill receipt reports the order id `0`. An assigned order id starts at `1`, so `0` never names a pending order.
