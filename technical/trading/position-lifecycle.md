---
sidebar_position: 2
title: Position Lifecycle
---

# Position Lifecycle

## Opening: Market Order

`open_market(user, market_id, collateral, notional_size, is_long, take_profit, stop_loss, price)`

The contract first verifies that the status is `Active` and that the user has authorized the call. The submitted price is verified via the price verifier. Pending funding and borrowing are then accrued via `data.accrue(e, ...)` to bring market state up to date.

A new position ID is allocated from the monotonically incrementing counter, and the position is created with `filled = true`. Collateral and leverage are validated against the configured bounds. The position's `fund_idx`, `borr_idx`, and `adl_idx` are snapshotted from the current market state, and the fee is computed based on the position's dominance at the time of opening.

Market stats (`l_notional` or `s_notional` and the corresponding `entry_wt` sum) are incremented, and global `total_notional` is updated. The user pays `collateral` via token transfer. Open fees (base + impact) are deducted from collateral. The treasury fee is sent to the treasury and the vault fee flows to the vault.

Emits `OpenMarket { market_id, user, position_id, base_fee, impact_fee }`.

## Opening: Limit Order

`place_limit(user, market_id, collateral, notional_size, is_long, entry_price, take_profit, stop_loss)`

Limit orders follow a similar authorization and validation path but skip the price check, since the user specifies their desired entry price. The position is created with `filled = false` and `entry_price` set to the user's limit price.

No fees are deducted at placement. The user's full collateral is transferred to the contract and stored on the position. Fees (base + impact) are computed and deducted from collateral at fill time via `ctx.open()`, based on the position's dominance at that moment.

The position is not reflected in market stats until it is filled. Emits `PlaceLimit { market_id, user, position_id }`.

## Filling a Limit Order (Keeper)

Limit orders are filled by keepers as part of an `execute` batch via `apply_fill`. The fill condition requires that the current price has reached the user's limit: for longs, `current_price <= entry_price`; for shorts, `current_price >= entry_price`.

On fill, `position.entry_price` is overwritten with the actual current price, `filled` is set to `true`, and `fund_idx`, `borr_idx`, and `adl_idx` are snapshotted from the current market state. Market stats are updated to reflect the newly active position.

Open fees (base + impact) are computed based on the position's dominance at fill time and deducted from collateral. The fee is split between the treasury (protocol fee), the keeper (caller fee), and the vault (remainder).

Emits `FillLimit { market_id, user, position_id, base_fee, impact_fee }`.

## Closing a Position (User)

`close_position(position_id, price) -> i128`

The contract must not be `Frozen`, and the submitted price must be within the staleness window. The position owner is read from the stored position and must authorize the call. The position must be filled.

Pending funding and borrowing are accrued, and any ADL reduction since fill is applied to compute the effective notional via `effective_notional()`. `MIN_OPEN_TIME` (30 seconds) must have elapsed since `created_at`.

PnL and fees are computed (see [PnL Calculation](./pnl-calculation.md) and [Fee System](./fee-system.md)). Equity is derived as `col + pnl - total_fee` where `total_fee = base_fee + impact_fee + funding + borrowing_fee`. The user payout is `max(equity, 0)`. The treasury receives `protocol_fee * treasury_rate` where `protocol_fee = base_fee + impact_fee + borrowing_fee`. The vault transfer is `col - user_payout - treasury_fee`. If the vault transfer is negative (the user profited), the vault pays via `strategy_withdraw`. If positive (the user lost), the collateral remainder flows to the vault.

The position is removed from storage and market stats are decremented. Emits `ClosePosition { market_id, user, position_id, price, pnl, base_fee, impact_fee, funding, borrowing_fee }`.

## Cancelling a Position

`cancel_position(position_id)`

The contract must not be `Frozen`. For pending (unfilled) positions, the position owner must authorize. For filled positions on a deleted market, the call is permissionless (anyone can clean up stranded positions). The position's collateral is refunded to the user, and the position is removed from storage. Emits `RefundPosition { market_id, user, position_id, amount }`.

## Modifying Collateral

`modify_collateral(position_id, new_collateral, price)`

`new_collateral` is the absolute target collateral value, not a delta. The position owner is read from the stored position and must authorize the call.

If the new collateral is greater than the current collateral, the contract validates that the new collateral remains within bounds and that leverage limits are still satisfied, then transfers the difference from the user.

If the new collateral is less than the current collateral, the contract additionally checks the margin requirement: `equity = new_col + pnl - total_fee >= notional * margin`. If this check fails, the transaction is rejected with `WithdrawalBreaksMargin`. The `total_fee` includes accrued funding and borrowing at the current indices.

Note: only filled positions can have their collateral modified. Pending (unfilled) limit orders cannot be modified.

## Stop-Loss and Take-Profit Triggers

`set_triggers(position_id, take_profit, stop_loss)`

The position owner is read from the stored position and must authorize the call. Sets or updates trigger prices on a position. Either value can be set to `0` to disable.

Take-profit triggers when the price moves in the position's favor: for longs, `price >= take_profit`; for shorts, `price <= take_profit`. Stop-loss triggers when the price moves against the position: for longs, `price <= stop_loss`; for shorts, `price >= stop_loss`.

Triggers are processed by keepers via the `execute` batch function. The same close logic applies, with the `caller_fee` paid to the keeper from trading fees. `MIN_OPEN_TIME` is enforced for TP/SL. If the position is too new, the transaction aborts with `PositionTooNew` (732), which aborts the entire batch.

## Liquidation

Processed by keepers via the `execute` batch. See [Liquidation](./liquidation.md) for full details.

The key difference from a normal close is that liquidation does not settle PnL. All remaining collateral is redistributed to the vault and keeper. There is no `MIN_OPEN_TIME` enforcement.
