---
sidebar_position: 1
title: Trading Contract
---

# Trading Contract

The trading contract is the core perpetual futures engine. It manages position lifecycle, PnL settlement, fee distribution, funding rate accrual, liquidation, and auto-deleveraging.

## Public Interface

### User Actions

All user actions require authentication from the position owner.

| Function | Status Required | Description |
|---|---|---|
| `place_limit` | Active | Place a limit order (pending fill) |
| `open_market` | Active | Open a position at market price |
| `close_position` | Not Frozen | Close a filled position |
| `cancel_limit` | Not Frozen | Cancel a pending limit order |
| `modify_collateral` | Not Frozen | Add or remove collateral |
| `set_triggers` | Not Frozen | Set stop-loss and take-profit prices |

### Keeper Actions

All keeper actions are permissionless. Any address can call them and earn fees.

| Function | Description |
|---|---|
| `execute` | Batch process: fills, SL/TP triggers, liquidations |
| `apply_funding` | Update funding rates (hourly) |
| `update_status` | Circuit breaker / ADL (requires threshold conditions) |

### Admin Actions

All admin actions require the contract owner (`#[only_owner]`).

| Function | Description |
|---|---|
| `set_config` | Update global trading configuration |
| `set_market` | Add or update a market |
| `set_status` | Set contract status (cannot set OnIce, use `update_status` instead) |
| `upgrade` | Upgrade contract WASM |
| `transfer_ownership` | Transfer admin rights (OZ Ownable) |

### Read-Only

| Function | Description |
|---|---|
| `get_config` | Current `TradingConfig` |
| `get_market` | `(MarketConfig, MarketData)` for a feed ID |
| `get_markets` | All registered feed IDs |
| `get_position` | Position by ID |
| `get_user_positions` | All position IDs for an address |
| `get_status` | Current contract status |
| `get_treasury` | Treasury contract address |

## Data Structures

### TradingConfig

Global fee and limit parameters set by the admin.

| Field | Type | Description |
|---|---|---|
| `caller_take_rate` | `i128` (SCALAR_7) | Keeper's share of total fees (0 to 100%) |
| `min_open_time` | `u64` | Minimum seconds before a filled position can be closed (0 = disabled) |
| `vault_skim` | `i128` (SCALAR_7) | Vault's cut of funding received by a position (0 to 100%) |
| `min_collateral` | `i128` (token decimals) | Minimum collateral to open |
| `max_collateral` | `i128` (token decimals) | Maximum collateral per position |
| `max_payout` | `i128` (SCALAR_7) | Maximum user payout as a ratio of collateral |
| `base_fee_dominant` | `i128` (SCALAR_7) | Fee rate for the dominant side (heavier open interest) |
| `base_fee_non_dominant` | `i128` (SCALAR_7) | Fee rate for the minority side |

`caller_take_rate` and `vault_skim` must be in `[0, SCALAR_7]`. Both base fees must be `>= 0`. `min_collateral > 0`, `max_collateral > min_collateral`, `max_payout > 0`.

### MarketConfig

Per-market parameters set by the admin via `set_market`.

| Field | Type | Description |
|---|---|---|
| `enabled` | `bool` | Whether this market accepts new positions |
| `init_margin` | `i128` (SCALAR_7) | Initial margin ratio. Max leverage = `1 / init_margin` |
| `base_hourly_rate` | `i128` (SCALAR_18) | Maximum hourly funding rate |
| `price_impact_scalar` | `i128` (SCALAR_7) | Divisor for price impact fee |

`init_margin >= SCALAR_7 / 200` (at least 0.5% maintenance margin), `base_hourly_rate >= 0`, `price_impact_scalar > 0`.

### MarketData

Per-market mutable state, updated on every position action.

| Field | Type | Description |
|---|---|---|
| `long_notional_size` | `i128` | Sum of all long notional sizes |
| `short_notional_size` | `i128` | Sum of all short notional sizes |
| `long_funding_index` | `i128` (SCALAR_18) | Cumulative funding cost index for longs |
| `short_funding_index` | `i128` (SCALAR_18) | Cumulative funding cost index for shorts |
| `long_entry_weighted` | `i128` | `sum(notional_i / entry_price_i)` for longs |
| `short_entry_weighted` | `i128` | `sum(notional_i / entry_price_i)` for shorts |
| `funding_rate` | `i128` (SCALAR_18) | Current signed funding rate (positive = longs pay) |
| `last_update` | `u64` | Timestamp of last funding accrual |
| `long_adl_index` | `i128` (SCALAR_18) | ADL reduction factor for longs (starts at SCALAR_18) |
| `short_adl_index` | `i128` (SCALAR_18) | ADL reduction factor for shorts |

The `entry_weighted` fields enable aggregate PnL computation without iterating all positions. They are used by the circuit breaker and ADL system.

### Position

| Field | Type | Description |
|---|---|---|
| `user` | `Address` | Position owner |
| `filled` | `bool` | `false` = pending limit order, `true` = active position |
| `feed_id` | `u32` | Pyth Lazer feed ID |
| `is_long` | `bool` | Direction |
| `stop_loss` | `i128` | SL trigger price (0 = disabled) |
| `take_profit` | `i128` | TP trigger price (0 = disabled) |
| `entry_price` | `i128` | Fill price (price decimals) |
| `collateral` | `i128` | Current collateral (token decimals) |
| `notional_size` | `i128` | Notional value (token decimals) |
| `entry_funding_index` | `i128` | Funding index snapshot at fill |
| `entry_adl_index` | `i128` | ADL index snapshot at fill |
| `created_at` | `u64` | Timestamp when filled |

## Contract Status System

```text
Active (0)      : Normal operation, all actions allowed
OnIce (1)       : Permissionless circuit breaker; no new positions
AdminOnIce (2)  : Admin-set pause; same restrictions as OnIce
Frozen (3)      : Full freeze; all operations blocked
```

| Status | Open position | Manage position | Keeper execute | Apply funding |
|---|---|---|---|---|
| Active | Yes | Yes | Yes | Yes |
| OnIce | No | Yes | Yes | Yes |
| AdminOnIce | No | Yes | Yes | Yes |
| Frozen | No | No | No | No |

Admin can set `Active`, `AdminOnIce`, or `Frozen` directly. `OnIce` can only be set by the permissionless `update_status` function when utilization thresholds are met.

## Constants

| Constant | Value | Description |
|---|---|---|
| `SCALAR_7` | `10,000,000` | 7-decimal fixed-point base |
| `SCALAR_18` | `10^18` | 18-decimal fixed-point base (funding/ADL) |
| `MAINTENANCE_MARGIN_DIVISOR` | `200` | Maintenance margin = 0.5% of notional |
| `MIN_LEVERAGE` | `2` | Minimum leverage (notional >= 2x collateral) |
| `MAX_MARKETS` | `32` | Maximum registered markets |
| `MAX_POSITIONS` | `25` | Maximum open positions per user |
| `UTIL_FREEZE` | `9,500,000` | 95%. Triggers OnIce when net PnL >= 95% of vault |
| `UTIL_UNFREEZE` | `9,000,000` | 90%. Restores Active when PnL drops below 90% |
| `ONE_HOUR_SECONDS` | `3600` | Funding update minimum interval |
| `MAX_STALENESS_USER` | `60` | Max price age for user actions (seconds) |
| `MAX_STALENESS_KEEPER` | `300` | Max price age for keeper actions (seconds) |
