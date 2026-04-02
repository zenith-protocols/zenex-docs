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
| `PlaceLimit` | `feed_id, user, position_id` | `base_fee, impact_fee` |
| `OpenMarket` | `feed_id, user, position_id` | `base_fee, impact_fee` |
| `FillLimit` | `feed_id, user, position_id` | `base_fee, impact_fee` |
| `ClosePosition` | `feed_id, user, position_id` | `price, pnl, base_fee, impact_fee, funding, borrowing_fee` |
| `TakeProfit` | `feed_id, user, position_id` | `price, pnl, base_fee, impact_fee, funding, borrowing_fee` |
| `StopLoss` | `feed_id, user, position_id` | `price, pnl, base_fee, impact_fee, funding, borrowing_fee` |
| `Liquidation` | `feed_id, user, position_id` | `price, base_fee, impact_fee, funding, borrowing_fee, liq_fee` |
| `RefundPosition` | `feed_id, user, position_id` | `amount` |
| `ModifyCollateral` | `feed_id, user, position_id` | `amount` (positive = deposit, negative = withdraw) |
| `SetTriggers` | `feed_id, user, position_id` | `take_profit, stop_loss` |

### System Events

| Event | Topics | Data |
|---|---|---|
| `ApplyFunding` | None | (no data) |
| `ADLTriggered` | None | `reduction_pct, deficit` |

Close events include `borrowing_fee` as a separate field alongside `base_fee`, `impact_fee`, and `funding`. The emitted `pnl` is the net PnL (after all fees, clamped to `-col`).

## Error Codes

All errors use `panic_with_error!(e, TradingError::Variant)`. In keeper batch execution, per-request errors are returned as `u32` codes in the result vector instead of panicking.

| Code | Name | Description |
|---|---|---|
| 1 | `Unauthorized` | Non-owner tried owner-only action |
| 701 | `NotInitialized` | Reserved |
| 702 | `InvalidConfig` | Config validation failure |
| 710 | `MarketNotFound` | Unknown feed ID |
| 712 | `MarketDisabled` | Market not enabled for new positions |
| 720 | `PriceNotFound` | Feed not in price payload |
| 721 | `PriceStale` | Price exceeds staleness threshold |
| 730 | `PositionNotFound` | Unknown position ID |
| 733 | `PositionNotPending` | Fill on already-filled position |
| 734 | `MaxPositionsReached` | User at 25-position limit |
| 735 | `NegativeValueNotAllowed` | Negative notional, price, TP, or SL |
| 736 | `NotionalBelowMinimum` | Below `min_notional` |
| 737 | `NotionalAboveMaximum` | Above `max_notional` |
| 738 | `LeverageBelowMinimum` | Below 2x leverage |
| 739 | `LeverageAboveMaximum` | Exceeds `1/margin` |
| 740 | `CollateralUnchanged` | Modify to same value |
| 741 | `WithdrawalBreaksMargin` | Withdrawal would breach initial margin |
| 744 | `TakeProfitNotTriggered` | TP price not reached |
| 745 | `StopLossNotTriggered` | SL price not reached |
| 746 | `PositionNotLiquidatable` | Equity above liquidation threshold (`liq_fee`) |
| 747 | `LimitOrderNotFillable` | Price not at limit level |
| 748 | `PositionTooNew` | `MIN_OPEN_TIME` not elapsed |
| 750 | `ActionNotAllowedForStatus` | Wrong position state for action |
| 760 | `InvalidStatus` | Unknown status value or admin setting OnIce |
| 761 | `ContractOnIce` | New position while not Active |
| 762 | `ContractFrozen` | Any action while Frozen |
| 770 | `MaxMarketsReached` | `MAX_ENTRIES` limit |
| 780 | `NoDeficit` | ADL triggered but no deficit |
| 782 | `ThresholdNotMet` | Circuit breaker threshold not met |
| 790 | `FundingTooEarly` | `apply_funding` within same hour |
