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
| `cancel_position` | Not Frozen | Cancel a pending limit order, or refund a filled position on a deleted market |
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
| `del_market` | Remove a market (existing positions can be refunded via `cancel_position`) |
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

Global fee, rate, and limit parameters set by the admin.

| Field | Type | Description |
|---|---|---|
| `caller_rate` | `i128` (SCALAR_7) | Keeper's share of trading fees (0 to 50%) |
| `min_notional` | `i128` (token decimals) | Minimum notional size per position |
| `max_notional` | `i128` (token decimals) | Maximum notional size per position |
| `fee_dom` | `i128` (SCALAR_7) | Trading fee rate for the dominant side (heavier open interest) |
| `fee_non_dom` | `i128` (SCALAR_7) | Trading fee rate for the minority side |
| `max_util` | `i128` (SCALAR_7) | Global utilization cap: total_notional / vault_balance |
| `r_funding` | `i128` (SCALAR_18) | Base hourly funding rate (all markets) |
| `r_base` | `i128` (SCALAR_18) | Base hourly borrowing rate (all markets) |
| `r_var` | `i128` (SCALAR_18) | Vault-level variable borrowing rate at full vault utilization |

`caller_rate` in `[0, MAX_CALLER_RATE]` (50%). `fee_dom >= fee_non_dom >= 0`, both `<= MAX_FEE_RATE` (1%). `r_base`, `r_funding` in `[0, MAX_RATE_HOURLY]`. `r_var` in `[0, MAX_R_VAR]`. `min_notional > 0`, `max_notional > min_notional`, `max_util > 0`.

### MarketConfig

Per-market parameters set by the admin via `set_market`.

| Field | Type | Description |
|---|---|---|
| `enabled` | `bool` | Whether this market accepts new positions |
| `max_util` | `i128` (SCALAR_7) | Per-market utilization cap |
| `r_var_market` | `i128` (SCALAR_18) | Per-market variable borrowing rate at full market utilization |
| `margin` | `i128` (SCALAR_7) | Initial margin ratio. Max leverage = `1 / margin` |
| `liq_fee` | `i128` (SCALAR_7) | Liquidation fee/threshold. Position liquidatable when equity < notional * liq_fee |
| `impact` | `i128` (SCALAR_7) | Price impact fee divisor: fee = notional / impact |

`margin > liq_fee > 0`. `margin <= MAX_MARGIN` (50%). `liq_fee <= MAX_LIQ_FEE` (25%). `r_var_market` in `[0, MAX_R_VAR_MARKET]`. `impact >= MIN_IMPACT` (10x). `max_util > 0`.

### MarketData

Per-market mutable state, updated on every position action.

| Field | Type | Description |
|---|---|---|
| `l_notional` | `i128` | Sum of all long notional sizes (token decimals) |
| `s_notional` | `i128` | Sum of all short notional sizes (token decimals) |
| `l_fund_idx` | `i128` (SCALAR_18) | Cumulative long funding index |
| `s_fund_idx` | `i128` (SCALAR_18) | Cumulative short funding index |
| `l_borr_idx` | `i128` (SCALAR_18) | Cumulative long borrowing index |
| `s_borr_idx` | `i128` (SCALAR_18) | Cumulative short borrowing index |
| `l_entry_wt` | `i128` | `sum(notional_i / entry_price_i)` for longs |
| `s_entry_wt` | `i128` | `sum(notional_i / entry_price_i)` for shorts |
| `fund_rate` | `i128` (SCALAR_18) | Current signed funding rate (positive = longs pay) |
| `last_update` | `u64` | Timestamp of last accrual (seconds) |
| `l_adl_idx` | `i128` (SCALAR_18) | Long ADL reduction factor (starts at SCALAR_18) |
| `s_adl_idx` | `i128` (SCALAR_18) | Short ADL reduction factor (starts at SCALAR_18) |

The `entry_wt` fields enable aggregate PnL computation without iterating all positions. They are used by the circuit breaker and ADL system. The `borr_idx` fields track cumulative borrowing costs per unit of notional, accrued alongside funding.

### Position

| Field | Type | Description |
|---|---|---|
| `user` | `Address` | Position owner |
| `filled` | `bool` | `false` = pending limit order, `true` = active position |
| `feed` | `u32` | Pyth Lazer feed ID |
| `long` | `bool` | Direction |
| `sl` | `i128` | Stop-loss trigger price (0 = disabled) |
| `tp` | `i128` | Take-profit trigger price (0 = disabled) |
| `entry_price` | `i128` | Fill price (price decimals) |
| `col` | `i128` | Current collateral (token decimals) |
| `notional` | `i128` | Notional value, may be reduced by ADL (token decimals) |
| `fund_idx` | `i128` (SCALAR_18) | Funding index snapshot at fill |
| `borr_idx` | `i128` (SCALAR_18) | Borrowing index snapshot at fill |
| `adl_idx` | `i128` (SCALAR_18) | ADL index snapshot at fill (starts at SCALAR_18) |
| `created_at` | `u64` | Timestamp of creation or fill (seconds) |

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
| `SCALAR_7` | `10,000,000` | 7-decimal fixed-point base (rates, fees, ratios) |
| `SCALAR_18` | `10^18` | 18-decimal fixed-point base (funding, borrowing, ADL indices) |
| `MAX_ENTRIES` | `50` | Maximum markets or positions per user |
| `UTIL_ONICE` | `9,500,000` | 95%. Triggers OnIce when net PnL >= 95% of vault |
| `UTIL_ACTIVE` | `9,000,000` | 90%. Restores Active when PnL drops below 90% |
| `ONE_HOUR_SECONDS` | `3600` | Funding/borrowing update minimum interval |
| `MIN_OPEN_TIME` | `30` | Minimum seconds before user-initiated close |
| `MAX_CALLER_RATE` | `5,000,000` | 50% max keeper fee share |
| `MAX_FEE_RATE` | `100,000` | 1% max base fee rate |
| `MAX_RATE_HOURLY` | `100,000,000,000,000` | 0.01%/hr max for r_base, r_funding (~88% APR) |
| `MAX_R_VAR` | `100,000,000,000,000` | 0.01%/hr max vault variable rate |
| `MAX_R_VAR_MARKET` | `100,000,000,000,000` | 0.01%/hr max per-market variable rate |
| `MAX_UTIL` | `100,000,000` | 1000% max utilization cap (10x SCALAR_7) |
| `MIN_IMPACT` | `100,000,000` | Impact divisor floor (caps impact fee at 10%) |
| `MAX_MARGIN` | `5,000,000` | 50% max initial margin (2x min leverage) |
| `MAX_LIQ_FEE` | `2,500,000` | 25% max liquidation fee/threshold |
