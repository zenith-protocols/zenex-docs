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
| `PositionCounter` | `u32` | Monotonically incrementing position ID allocator |
| `LastFundingUpdate` | `u64` | Timestamp of last `apply_funding` call |

### Persistent Storage: Market Tier (45/52-day TTL)

Per-market data and the global market list.

| Key | Type | Description |
|---|---|---|
| `Markets` | `Vec<u32>` | List of registered market IDs (max `MAX_ENTRIES`) |
| `MarketConfig(u32)` | `MarketConfig` | Per-market parameters |
| `MarketData(u32)` | `MarketData` | Per-market mutable state |

### Persistent Storage: Position Tier (14/21-day TTL)

Per-position and per-user data. Shorter TTL because perp positions are short-lived (most close within days).

| Key | Type | Description |
|---|---|---|
| `Position(u32)` | `Position` | Individual position data |
| `UserPositions(Address)` | `Vec<u32>` | Position IDs owned by an address |

The `PositionCounter` is never decremented. Position IDs are permanent. Closing a position does not free its ID for reuse. This simplifies event indexing and prevents ID collisions.

## TTL Strategy

| Tier | Threshold | Bump | Rationale |
|---|---|---|---|
| Instance | 30 days | 31 days | Accessed on every call; minimal expiry risk |
| Market Persistent | 45 days | 52 days | Market config/data and market list; moderate access frequency |
| Position Persistent | 14 days | 21 days | Positions and user position lists; short-lived data |

All TTLs are bumped on read or write. If a user does not interact for 14+ days, their `UserPositions` entry and `Position` records could expire. Positions are short-lived (most close within days), so the shorter TTL avoids paying rent for abandoned positions.

## Events

All events use Soroban's `#[contractevent]` derive macro. Fields marked with `#[topic]` are indexed for efficient filtering.

### Admin Events

| Event | Topics | Data |
|---|---|---|
| `SetConfig` | None | (no data) |
| `SetMarket` | `market_id` | None |
| `SetStatus` | None | `status: u32` |

### Position Events

| Event | Topics | Data |
|---|---|---|
| `PlaceLimit` | `market_id, user, position_id` | (no data) |
| `OpenMarket` | `market_id, user, position_id` | `base_fee, impact_fee` |
| `FillLimit` | `market_id, user, position_id` | `base_fee, impact_fee` |
| `ClosePosition` | `market_id, user, position_id` | `price, pnl, base_fee, impact_fee, funding, borrowing_fee` |
| `TakeProfit` | `market_id, user, position_id` | `price, pnl, base_fee, impact_fee, funding, borrowing_fee` |
| `StopLoss` | `market_id, user, position_id` | `price, pnl, base_fee, impact_fee, funding, borrowing_fee` |
| `Liquidation` | `market_id, user, position_id` | `price, base_fee, impact_fee, funding, borrowing_fee, liq_fee` |
| `RefundPosition` | `market_id, user, position_id` | `amount` |
| `ModifyCollateral` | `market_id, user, position_id` | `amount` (positive = deposit, negative = withdraw) |
| `SetTriggers` | `market_id, user, position_id` | `take_profit, stop_loss` |

### Market Events

| Event | Topics | Data |
|---|---|---|
| `DelMarket` | `market_id` | (no data) |

### System Events

| Event | Topics | Data |
|---|---|---|
| `ApplyFunding` | None | (no data) |
| `ADLTriggered` | None | `reduction_pct, deficit` |

Close events include `borrowing_fee` as a separate field alongside `base_fee`, `impact_fee`, and `funding`. The emitted `pnl` is the net PnL (after all fees, clamped to `-col`).

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
