---
sidebar_position: 2
title: Position Lifecycle
---

# Position Lifecycle

## Opening: Market Order

`open_market(user, market_id, collateral, notional_size, is_long, take_profit, stop_loss, price)`

The contract first verifies that the status is `Active` and that the user has authorized the call. The submitted price is verified via the price verifier. Pending funding and borrowing are then accrued via `data.accrue(e, ...)` to bring market state up to date.

A new position ID is allocated from the user's `UserCounter(Address)`, and the position is stored under `Position(user, id)` with `filled = true`. Collateral and leverage are validated against the configured bounds. The position's `fund_idx`, `borr_idx`, and `adl_idx` are snapshotted from the current market state, and the fee is computed based on the position's dominance at the time of opening.

Market stats (`l_notional` or `s_notional` and the corresponding `entry_wt` sum) are incremented, and global `total_notional` is updated. The user pays `collateral` via token transfer. Open fees (base + impact) are deducted from collateral. The treasury fee is sent to the treasury and the vault fee flows to the vault.

Emits `OpenMarket { market_id, user, position_id }` with data `long, col, notional, entry_price, sl, tp, fund_idx, borr_idx, adl_idx, created_at, base_fee, impact_fee`.

## Opening: Limit Order

`place_limit(user, market_id, collateral, notional_size, is_long, entry_price, take_profit, stop_loss)`

Limit orders follow a similar authorization and validation path but skip the price check, since the user specifies their desired entry price. The position is created with `filled = false` and `entry_price` set to the user's limit price.

No fees are deducted at placement. The user's full collateral is transferred to the contract and stored on the position. Fees (base + impact) are computed and deducted from collateral at fill time via `ctx.open()`, based on the position's dominance at that moment.

The position is not reflected in market stats until it is filled. Emits `PlaceLimit { market_id, user, position_id }` with data `long, col, notional, entry_price, sl, tp, created_at`. Indices are not snapshotted yet; they are filled in by the later `FillLimit` event.

## Filling a Limit Order (Keeper)

Limit orders are filled by keepers as part of an `execute` batch via `apply_fill`. A position fills when the current price has reached the user's limit:

| Direction | Fill condition |
|---|---|
| Long | `current_price <= entry_price` |
| Short | `current_price >= entry_price` |

On fill, `position.entry_price` is overwritten with the actual current price, `filled` is set to `true`, `created_at` is updated to fill time, and `fund_idx`, `borr_idx`, and `adl_idx` are snapshotted from the current market state. Market stats are updated to reflect the newly active position.

Open fees (base + impact) are computed based on the position's dominance at fill time and deducted from collateral. The fee is split between the treasury (protocol fee), the keeper (caller fee), and the vault (remainder).

Emits `FillLimit { market_id, user, position_id }` with data `entry_price, fund_idx, borr_idx, adl_idx, created_at, base_fee, impact_fee`. Fields established at placement time (`long`, `col`, `notional`, `sl`, `tp`) are not repeated.

## Closing a Position (User)

`close_position(user, id, price) -> i128`

The contract must not be `Frozen`, and the submitted price must be within the staleness window. The caller passes the position owner address as `user`, and the contract requires authorization from that address (via `require_auth_for_args` excluding the price payload). The position must be filled.

Pending funding and borrowing are accrued, and any ADL reduction since fill is applied to compute the effective notional via `effective_notional()`. `MIN_OPEN_TIME` (30 seconds) must have elapsed since `created_at`.

PnL and fees are computed (see [PnL Calculation](./pnl-calculation.md) and [Fee System](./fee-system.md)). Settlement uses the following values:

```
total_fee      = base_fee + impact_fee + funding + borrowing_fee
protocol_fee   = base_fee + impact_fee + borrowing_fee
equity         = col + pnl - total_fee
user_payout    = max(equity, 0)
treasury_fee   = protocol_fee * treasury_rate / SCALAR_7
vault_transfer = col - user_payout - treasury_fee
```

If `vault_transfer` is negative (the user profited), the vault pays via `strategy_withdraw`. If positive (the user lost), the collateral remainder flows to the vault.

The position is removed from storage and market stats are decremented. Emits `ClosePosition { market_id, user, position_id }` with data `notional, price, pnl, base_fee, impact_fee, funding, borrowing_fee`, where `notional` is the post-ADL notional actually settled (may be smaller than what was originally placed if the winning side was deleveraged).

## Cancelling a Position

`cancel_position(user, id) -> i128`

The contract must not be `Frozen`. For pending (unfilled) positions, the position owner must authorize the call (via `require_auth` triggered inside the dispatch). For filled positions on a deleted market, the call is permissionless (anyone can clean up stranded positions). The position's collateral is refunded to the user, and the position is removed from storage. The function returns the refund amount.

Emits `RefundPosition { market_id, user, position_id }` (no data fields). The refund amount is not on the event; consumers can read it from the function return value or recover it from the prior position state.

## Modifying Collateral

`modify_collateral(user, id, new_collateral, price)`

`new_collateral` is the absolute target collateral value, not a delta. The caller passes the position owner address as `user`, and the contract requires authorization from that address (via `require_auth_for_args` excluding the price payload).

If the new collateral is greater than the current collateral, the contract transfers the difference from the user. No further validation runs: adding collateral can only reduce leverage, so the existing margin and leverage limits are guaranteed to still hold.

If the new collateral is less than the current collateral, the contract checks the margin requirement:

```
equity = new_col + pnl - total_fee
equity >= notional * margin
```

If this check fails, the transaction is rejected with `WithdrawalBreaksMargin`. `total_fee` includes accrued funding and borrowing at the current indices.

Note: only filled positions can have their collateral modified. Pending (unfilled) limit orders cannot be modified.

Emits `ModifyCollateral { market_id, user, position_id }` with data `col`, the **new** collateral total after modification, not a delta. Indexers must look up the prior position to compute the delta.

## Stop-Loss and Take-Profit Triggers

`set_triggers(user, id, take_profit, stop_loss)`

The caller passes the position owner address as `user`, and the contract requires authorization from that address. Sets or updates trigger prices on a position. Either value can be set to `0` to disable.

Triggers fire when the mark price crosses the threshold:

| Trigger | Long | Short |
|---|---|---|
| Take-profit | `price >= tp` | `price <= tp` |
| Stop-loss | `price <= sl` | `price >= sl` |

Triggers are processed by keepers via the `execute` batch function. The same close logic applies, with the `caller_fee` paid to the keeper from trading fees. `MIN_OPEN_TIME` is enforced for TP/SL. If the position is too new, the transaction aborts with `PositionTooNew` (732), which aborts the entire batch.

Emits `SetTriggers { market_id, user, position_id }` with data `sl, tp` (in that order; the on-chain field names are `sl` and `tp`, abbreviations of stop-loss / take-profit).

## Liquidation

Processed by keepers via the `execute` batch. See [Liquidation](./liquidation.md) for full details.

The key difference from a normal close is that liquidation does not settle PnL. All remaining collateral is redistributed to the vault and keeper. There is no `MIN_OPEN_TIME` enforcement.
