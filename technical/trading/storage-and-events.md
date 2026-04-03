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
| `Markets` | `Vec<u32>` | List of registered feed IDs (max `MAX_ENTRIES`) |
| `TotalNotional` | `i128` | Sum of all position notionals across all markets |
| `PositionCounter` | `u32` | Monotonically incrementing position ID allocator |
| `LastFundingUpdate` | `u64` | Timestamp of last `apply_funding` call |

### Persistent Storage: Shared Tier (45-day TTL)

Per-market and per-position data.

| Key | Type | Description |
|---|---|---|
| `MarketConfig(u32)` | `MarketConfig` | Per-market parameters |
| `MarketData(u32)` | `MarketData` | Per-market mutable state |
| `Position(u32)` | `Position` | Individual position data |

### Persistent Storage: User Tier (100-day TTL)

Per-user data with longer TTL to survive inactive periods.

| Key | Type | Description |
|---|---|---|
| `UserPositions(Address)` | `Vec<u32>` | Position IDs owned by an address |

The `PositionCounter` is never decremented. Position IDs are permanent. Closing a position does not free its ID for reuse. This simplifies event indexing and prevents ID collisions.

## TTL Strategy

| Tier | Threshold | Bump | Rationale |
|---|---|---|---|
| Instance | 30 days | 31 days | Accessed on every call; minimal expiry risk |
| Shared Persistent | 45 days | 46 days | Market/position data; moderate access frequency |
| User Persistent | 100 days | 120 days | User position lists; must survive inactivity |

All TTLs are bumped on read or write. If a user does not interact for 100+ days, their `UserPositions` entry could expire, but position records (45-day tier) would expire first, making the positions effectively orphaned.

## Events

All events use Soroban's `#[contractevent]` derive macro. Fields marked with `#[topic]` are indexed for efficient filtering.

### Admin Events

| Event | Topics | Data |
|---|---|---|
| `SetConfig` | None | `config: TradingConfig` |
| `SetMarket` | `feed_id` | None |
| `SetStatus` | None | `status: u32` |

### Position Events

| Event | Topics | Data |
|---|---|---|
| `PlaceLimit` | `feed_id, user, position_id` | (no data) |
| `OpenMarket` | `feed_id, user, position_id` | `base_fee, impact_fee` |
| `FillLimit` | `feed_id, user, position_id` | `base_fee, impact_fee` |
| `ClosePosition` | `feed_id, user, position_id` | `price, pnl, base_fee, impact_fee, funding, borrowing_fee` |
| `TakeProfit` | `feed_id, user, position_id` | `price, pnl, base_fee, impact_fee, funding, borrowing_fee` |
| `StopLoss` | `feed_id, user, position_id` | `price, pnl, base_fee, impact_fee, funding, borrowing_fee` |
| `Liquidation` | `feed_id, user, position_id` | `price, base_fee, impact_fee, funding, borrowing_fee, liq_fee` |
| `RefundPosition` | `feed_id, user, position_id` | `amount` |
| `ModifyCollateral` | `feed_id, user, position_id` | `amount` (positive = deposit, negative = withdraw) |
| `SetTriggers` | `feed_id, user, position_id` | `take_profit, stop_loss` |

### Market Events

| Event | Topics | Data |
|---|---|---|
| `DelMarket` | `feed_id` | (no data) |

### System Events

| Event | Topics | Data |
|---|---|---|
| `ApplyFunding` | None | (no data) |
| `ADLMarket` | `feed_id` | `factor, long` |
| `ADLTriggered` | None | `reduction_pct, deficit` |

Close events include `borrowing_fee` as a separate field alongside `base_fee`, `impact_fee`, and `funding`. The emitted `pnl` is the net PnL (after all fees, clamped to `-col`).

## Error Codes

All errors use `panic_with_error!(e, TradingError::Variant)`. In keeper batch execution, per-request errors are returned as `u32` codes in the result vector instead of panicking.

| Code | Name | Description |
|---|---|---|
| 1 | `Unauthorized` | Non-owner tried owner-only action |
| 700 | `InvalidConfig` | Config parameter out of valid range |
| 701 | `MarketNotFound` | No market registered for the given feed_id |
| 702 | `MarketDisabled` | Market is disabled or deleted |
| 703 | `MaxMarketsReached` | `MAX_ENTRIES` markets already registered |
| 710 | `InvalidPrice` | Price verification failed, feed_id mismatch, or missing feed |
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
| 729 | `InvalidTakeProfitPrice` | TP price on wrong side of entry |
| 730 | `InvalidStopLossPrice` | SL price on wrong side of entry |
| 731 | `NotActionable` | No valid action for this position in execute batch |
| 732 | `PositionTooNew` | `MIN_OPEN_TIME` not elapsed |
| 733 | `ActionNotAllowedForStatus` | Action not allowed for position status |
| 740 | `InvalidStatus` | Invalid or disallowed contract status value |
| 741 | `ContractOnIce` | New positions blocked (OnIce, AdminOnIce, or Frozen) |
| 742 | `ContractFrozen` | All position management blocked (Frozen) |
| 750 | `ThresholdNotMet` | Net PnL below ADL threshold |
| 751 | `UtilizationExceeded` | Position would exceed notional/vault cap |
| 752 | `FundingTooEarly` | `apply_funding` called < 1 hour since last call |
