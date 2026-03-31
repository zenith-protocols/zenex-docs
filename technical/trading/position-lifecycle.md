---
sidebar_position: 2
title: Position Lifecycle
---

# Position Lifecycle

## Opening: Market Order

`open_market(user, feed_id, is_long, collateral, notional_size, price_data)`

The contract first verifies that the status is `Active` and that the user has authorized the call. The submitted price is checked against `MAX_STALENESS_USER` (60 seconds). Pending funding is then accrued via `data.accrue(e)` to bring market state up to date.

A new position ID is allocated from the monotonically incrementing counter, and the position is created with `filled = true`. Collateral and leverage are validated against the configured bounds. The position's `entry_funding_index` and `entry_adl_index` are snapshotted from the current market state, and the fee is computed based on the position's dominance at the time of opening.

Market stats (`long_notional_size` or `short_notional_size` and the corresponding `entry_weighted` sum) are incremented to reflect the new position. The user pays `collateral + base_fee + impact_fee` via token transfer. The protocol fee is sent to the treasury and the remainder flows to the vault.

Emits `OpenMarket { feed_id, user, position_id, base_fee, impact_fee }`.

## Opening: Limit Order

`place_limit(user, feed_id, is_long, entry_price, collateral, notional_size)`

Limit orders follow a similar authorization and validation path but skip the price check, since the user specifies their desired entry price. The position is created with `filled = false` and `entry_price` set to the user's limit price.

The user prepays the worst-case fee: `dominant_fee + impact_fee`, regardless of the actual market state at fill time. If the position turns out to be non-dominant when filled, the difference is refunded. This approach ensures the contract always holds sufficient fee funds without requiring additional user authorization at fill time.

The position is not reflected in market stats until it is filled. Emits `PlaceLimit { feed_id, user, position_id, base_fee, impact_fee }`.

## Filling a Limit Order (Keeper)

Limit orders are filled by keepers as part of an `execute` batch via `apply_fill`. The fill condition requires that the current price has reached the user's limit: for longs, `current_price <= entry_price`; for shorts, `current_price >= entry_price`.

On fill, `position.entry_price` is overwritten with the actual current price, `filled` is set to `true`, and the funding and ADL indices are snapshotted. Market stats are updated to reflect the newly active position.

Fee reconciliation occurs at this point. If the position is non-dominant at fill time, the overpaid fee (dominant minus non-dominant) is refunded to the user. The actual fee is split between the treasury (protocol fee), the keeper (caller fee), and the vault (remainder).

Emits `FillLimit { feed_id, user, position_id, base_fee, impact_fee }`.

## Closing a Position (User)

`close_position(user, position_id, price_data)`

The contract must not be `Frozen`, and the submitted price must be within the 60-second staleness window. The position owner must authorize the call, and the position must be filled.

Pending funding is accrued, and any ADL reduction since fill is applied to compute the effective notional via `effective_notional()`. The `min_open_time` must have elapsed since `created_at`.

PnL and fees are computed (see [PnL Calculation](./pnl-calculation.md) and [Fee System](./fee-system.md)). Equity is derived as `collateral + pnl - total_fee`, and the user payout is capped by `collateral * max_payout` with the vault skim deducted. The vault transfer is then `collateral - user_payout`. If the vault transfer is negative (the user profited), the vault pays via `strategy_withdraw`. If positive (the user lost), the collateral remainder flows to the vault. The protocol fee goes to the treasury and the payout goes to the user.

The position is removed from storage and market stats are decremented. Emits `ClosePosition { feed_id, user, position_id, price, pnl, base_fee, impact_fee, funding }`.

## Cancelling a Limit Order

`cancel_limit(user, position_id)`

The contract must not be `Frozen`. The position owner authorizes, and the position must be pending (`filled == false`). The full `collateral + prepaid_fee` is refunded to the user, and the position is removed from storage. Emits `CancelLimit`.

## Modifying Collateral

`modify_collateral(user, position_id, amount, price_data)`

A positive `amount` deposits additional collateral; a negative `amount` withdraws.

For deposits to a filled position, the contract validates that the new collateral remains within bounds and that leverage limits are still satisfied, then transfers tokens from the user.

For withdrawals from a filled position, the contract additionally checks the margin requirement: `equity = new_collateral + pnl - fees >= notional * init_margin`. If this check fails, the transaction is rejected with `WithdrawalBreaksMargin`.

For pending positions, no price check is needed. Only collateral bounds and leverage limits are validated. The ADL index and effective notional are updated during modification to reflect any ADL reduction since fill.

## Stop-Loss and Take-Profit Triggers

`set_triggers(user, position_id, stop_loss, take_profit)`

Sets or updates trigger prices on a position. Either value can be set to `0` to disable.

Take-profit triggers when the price moves in the position's favor: for longs, `price >= take_profit`; for shorts, `price <= take_profit`. Stop-loss triggers when the price moves against the position: for longs, `price <= stop_loss`; for shorts, `price >= stop_loss`.

Triggers are processed by keepers via the `execute` batch function. The same close logic applies, with the `caller_fee` paid to the keeper from the fee pool. The `min_open_time` constraint is enforced for TP/SL. If the position is too new, the trigger returns a non-panicking error code and the position survives.

## Liquidation

Processed by keepers via the `execute` batch. See [Liquidation](./liquidation.md) for full details.

The key difference from a normal close is that liquidation does not settle PnL. All remaining collateral is redistributed to the vault and keeper. There is no `min_open_time` enforcement.
