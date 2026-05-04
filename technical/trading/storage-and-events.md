---
sidebar_position: 11
title: Storage & Events
---

# Storage & Events

## Storage Layout

All storage keys are defined in `TradingStorageKey`. Storage is split into three TTL tiers.

### Instance Storage (30-day TTL)

Global state that is accessed frequently and shared across all calls.

| Key | Type | Description |
|---|---|---|
| `Status` | `u32` | Contract status enum value |
| `Vault` | `Address` | Vault contract address |
| `Token` | `Address` | Collateral token address |
| `PriceVerifier` | `Address` | Pyth Lazer verifier address |
| `Treasury` | `Address` | Protocol fee recipient |
| `Config` | `TradingConfig` | Global trading parameters |
| `TotalNotional` | `i128` | Sum of all position notionals across all markets |
| `LastFundingUpdate` | `u64` | Timestamp of last `apply_funding` call |

### Persistent Storage: Market Tier (45/52-day TTL)

Per-market data, the global market list, and per-user position-id counters. The user counter is bumped at the market tier so it survives even if all of a user's positions expire — this prevents id reuse.

| Key | Type | Description |
|---|---|---|
| `Markets` | `Vec<u32>` | List of registered market IDs (max `MAX_ENTRIES`) |
| `MarketConfig(u32)` | `MarketConfig` | Per-market parameters |
| `MarketData(u32)` | `MarketData` | Per-market mutable state |
| `UserCounter(Address)` | `u32` | Per-user monotonic position-id sequence (next id to allocate) |

### Persistent Storage: Position Tier (14/21-day TTL)

Per-position data. Shorter TTL because perp positions are short-lived (most close within days).

| Key | Type | Description |
|---|---|---|
| `Position(Address, u32)` | `Position` | Individual position data, keyed by `(owner, per-user id)` |

Position IDs are allocated **per user**, not globally. Each user has their own counter (`UserCounter(Address)`), so two different users can both hold positions with id `0`. The `(user, id)` pair is the unique on-chain identifier. The `Position` struct itself does not carry a `user` field — the owner is encoded in the storage key.

`UserCounter` is never decremented. Closing a position does not free its id for reuse — this simplifies event indexing and prevents id collisions across the lifetime of a user's account.

There is no on-chain enumeration of a user's open positions: discovery requires off-chain indexing of position-lifecycle events. The contract exposes `get_user_counter(user) -> u32` (the next sequence number, not a list) and `get_position(user, id) -> Position`.

## TTL Strategy

| Tier | Threshold | Bump | Rationale |
|---|---|---|---|
| Instance | 30 days | 31 days | Accessed on every call; minimal expiry risk |
| Market Persistent | 45 days | 52 days | Market config/data and market list; moderate access frequency |
| Position Persistent | 14 days | 21 days | Per-position records; short-lived data |

All TTLs are bumped on read or write. If a position is not touched for 14+ days, its `Position(user, id)` record could expire. Positions are short-lived (most close within days), so the shorter TTL avoids paying rent for abandoned positions. The `UserCounter(Address)` entry lives at the longer market tier (45/52 days), so the counter survives even when the user's positions are pruned — preventing id reuse.

## Events

All events use Soroban's `#[contractevent]` derive macro. Fields marked with `#[topic]` are indexed for efficient filtering.

### Admin Events

| Event | Topics | Data |
|---|---|---|
| `SetConfig` | None | (no data) |
| `SetMarket` | `market_id` | None |
| `SetStatus` | None | `status: u32` |

### Position Events

Each position-lifecycle event carries only the fields that **change** at the emit moment. Off-chain indexers combine each event with the position row they already hold; fields established by an earlier event (e.g. `long`, `col`, `notional` set at `PlaceLimit`) are not repeated on later events.

| Event | Topics | Data |
|---|---|---|
| `PlaceLimit` | `market_id, user, position_id` | `long, col, notional, entry_price, sl, tp, created_at` |
| `OpenMarket` | `market_id, user, position_id` | `long, col, notional, entry_price, sl, tp, fund_idx, borr_idx, adl_idx, created_at, base_fee, impact_fee` |
| `FillLimit` | `market_id, user, position_id` | `entry_price, fund_idx, borr_idx, adl_idx, created_at, base_fee, impact_fee` |
| `ClosePosition` | `market_id, user, position_id` | `notional, price, pnl, base_fee, impact_fee, funding, borrowing_fee` |
| `TakeProfit` | `market_id, user, position_id` | `notional, price, pnl, base_fee, impact_fee, funding, borrowing_fee` |
| `StopLoss` | `market_id, user, position_id` | `notional, price, pnl, base_fee, impact_fee, funding, borrowing_fee` |
| `Liquidation` | `market_id, user, position_id` | `notional, price, base_fee, impact_fee, funding, borrowing_fee, liq_fee` |
| `RefundPosition` | `market_id, user, position_id` | (no data) |
| `ModifyCollateral` | `market_id, user, position_id` | `col` (new total collateral after modification, **not** a delta) |
| `SetTriggers` | `market_id, user, position_id` | `sl, tp` |

Notes:

- On `ClosePosition`, `TakeProfit`, `StopLoss`, and `Liquidation`, the `notional` field is the **post-ADL** notional actually settled. Traders that have been auto-deleveraged will see a smaller notional on the settlement event than on the original `OpenMarket` / `FillLimit`.
- `RefundPosition` carries no data. Indexers that need the refund amount must read it from the prior position state, or use the return value of `cancel_position` directly (the refund amount is returned by the call).
- `ModifyCollateral` exposes `col` (post-modification total). To compute the delta, indexers look up the prior position.
- `SetTriggers` field order is `sl, tp` (the on-chain field names).

### Market Events

| Event | Topics | Data |
|---|---|---|
| `DelMarket` | `market_id` | (no data) |

### System Events

| Event | Topics | Data |
|---|---|---|
| `ApplyFunding` | None | (no data) |
| `ADLTriggered` | None | `reduction_pct, deficit` |

Close events include `borrowing_fee` as a separate field alongside `base_fee`, `impact_fee`, and `funding`. The emitted `pnl` is the net PnL (after all fees, clamped to `-col`). The `notional` data field on close/liquidation events is the post-ADL value at settlement.

## Error Codes

All errors use `panic_with_error!(e, TradingError::Variant)`. Errors are hard panics that abort the entire transaction, including keeper batch execution via `execute` (which returns `()`).

| Code | Name | Description |
|---|---|---|
| 1 | `Unauthorized` | Non-owner tried owner-only action |
| 700 | `InvalidConfig` | Config parameter out of valid range |
| 701 | `MarketNotFound` | No market registered for the given market_id |
| 702 | `MarketDisabled` | Market is disabled or deleted |
| 703 | `MaxMarketsReached` | `MAX_ENTRIES` markets already registered |
| 710 | `InvalidPrice` | Price verification failed, market_id mismatch, or missing feed |
| 711 | `StalePrice` | Price data predates position open time |
| 720 | `PositionNotFound` | Position ID not found in storage |
| 721 | `PositionNotPending` | Position is filled; expected pending |
| 722 | `MaxPositionsReached` | User has `MAX_ENTRIES` positions |
| 723 | `NegativeValueNotAllowed` | A parameter is zero or negative |
| 724 | `NotionalBelowMinimum` | Below `min_notional` |
| 725 | `NotionalAboveMaximum` | Above `max_notional` |
| 726 | `LeverageAboveMaximum` | Exceeds `1/margin` |
| 727 | `CollateralUnchanged` | Modify to same value |
| 728 | `WithdrawalBreaksMargin` | Withdrawal would breach initial margin |
| 731 | `NotActionable` | No valid action for this position in execute batch |
| 732 | `PositionTooNew` | `MIN_OPEN_TIME` not elapsed |
| 733 | `ActionNotAllowedForStatus` | Action not allowed for position status |
| 740 | `InvalidStatus` | Invalid or disallowed contract status value |
| 741 | `ContractOnIce` | New positions blocked (OnIce, AdminOnIce, or Frozen) |
| 742 | `ContractFrozen` | All position management blocked (Frozen) |
| 750 | `ThresholdNotMet` | Net PnL below ADL threshold |
| 751 | `UtilizationExceeded` | Position would exceed notional/vault cap |
| 752 | `FundingTooEarly` | `apply_funding` called < 1 hour since last call |
