---
sidebar_position: 12
title: Storage
---

# Storage

This page is the state reference for the trading contract: its storage keys and TTL tiers, the stored types, the status lifecycle, and the error table. The `Config` singleton has its [own page](./config.md), and the events the contract emits are on [Events](./events.md).

## Storage

Three TTL tiers cover the contract's keys, at roughly 5 seconds per ledger. The instance tier (threshold 30 days, bump 31) holds the market-wide singletons and is bumped by every state-changing call. `MarketData` lives alone in a shared persistent tier (threshold 45 days, bump 46), extended on every read and write. Everything user-keyed lives in the user persistent tier (threshold 100 days, bump 120), also extended on every access. The temporary tier is unused.

| Key | Value | Tier | Notes |
|---|---|---|---|
| `Config` | `Config` | instance | Mutable singleton, replaced wholesale by `set_config` |
| `FeedId` | `u32` | instance | Immutable, constructor-set |
| `Exponent` | `i32` | instance | Immutable, `price_scalar = 10^-exponent` |
| `Status` | `u32` | instance | `Status` discriminant |
| `Token` | `Address` | instance | Settlement token |
| `Vault` | `Address` | instance | Strategy vault |
| `PriceVerifier` | `Address` | instance | |
| `Treasury` | `Address` | instance | Protocol fee sink |
| `DelistedAt` | `u64` | instance | First-delist timestamp, the grace and deadline anchor. Removed on an in-grace revert |
| `TerminalPrice` | `i128` | instance | Flat settlement price (`price_scalar` units), absent until set |
| `Adl` | `AdlState` | instance | Zeroed default until first written |
| `MarketData` | `MarketData` | shared persistent | Singleton |
| `Position(Address, bool)` | `Position` | user persistent | Keyed `(user, is_long)`, hedge mode, carries the side's pending decrease order ids |
| `Order(Address, u32)` | `Order` | user persistent | Pending trade order with its escrow |
| `VaultOrder(Address, u32)` | `VaultOrder` | user persistent | Pending deposit or redeem with its escrow |
| `OrderCounter(Address)` | `u32` | user persistent | Next order id, shared by trade and vault orders, allocated from 1 (id 0 is reserved as the retired-market instant-redeem return) |
| `ClaimableFunding(Address)` | `i128` | user persistent | Funding owed to the user (token-dec), absent until first earned |

Archival loses no state. An archived position still counts in the market totals and must be restored before it can be closed or liquidated. An archived order is restored keeper-paid at fill, and an order's `expiration` (a ledger sequence) is a pure validity gate decoupled from the storage TTL. Every order removal runs through contract code, so escrow always resolves.

## Stored Types

The structs behind the storage rows above, as read back by `get_order`, `get_vault_order`, `get_position`, `get_market_data`, and `get_adl_state`. The order rows also ride on their create [events](./events.md), while position and market state are read from the getters or from each transaction's ledger entry changes. Field comments state the units: token decimals (token-dec), base decimals (base-dec), `price_scalar`, or `SCALAR_18`.

### Order

```rust
pub struct Order {
    pub is_long: bool,       // side this order targets
    pub kind: u32,           // OrderKind discriminant, see below
    pub notional: i128,      // size change magnitude (>= 0), token-dec
    pub collateral: i128,    // margin change magnitude (>= 0), token-dec
    pub trigger_price: i128, // crossing level for a trigger kind (price_scalar); unread for a market kind
    pub price_bound: i128,   // fill slippage limit (price_scalar); 0 = unbounded
    pub exec_fee: i128,      // keeper execution fee escrowed at creation, token-dec
    pub created_at: u64,     // submission timestamp; per-fill anti-replay anchor
    pub expiration: u32,     // ledger sequence; eligible while ledger sequence <= expiration
}
```

`kind` crosses the ABI as the `u32` discriminant of `OrderKind`:

```rust
pub enum OrderKind {
    MarketIncrease = 0, // grow now; trigger_price unused
    LimitIncrease = 1,  // grow when the price crosses trigger_price favorably
    StopIncrease = 2,   // grow when the price crosses trigger_price adversely
    MarketDecrease = 3, // shrink now; trigger_price unused
    LimitDecrease = 4,  // take profit: shrink on a favorable crossing
    StopDecrease = 5,   // stop loss: shrink on an adverse crossing
}
```

### VaultOrder

```rust
pub struct VaultOrder {
    pub kind: u32,       // 0 = Deposit, 1 = Redeem
    pub amount: i128,    // escrowed assets (deposit, token-dec) or shares (redeem, share decimals)
    pub min_out: i128,   // minimum received at fill, net of the vault fee: shares (deposit) or assets (redeem); 0 = unset
    pub exec_fee: i128,  // keeper execution fee escrowed at creation in the settlement token, token-dec
    pub created_at: u64, // creation timestamp; fills need a strictly later publish_time, redeems also the redeem_lock cooldown
}
```

Share decimals are the underlying token's decimals plus the vault's decimals offset.

### Position

```rust
pub struct Position {
    pub collateral: i128,      // posted margin, token-dec
    pub notional: i128,        // size in quote, token-dec; 0 = no open position
    pub tokens: i128,          // size in base, base-dec; entry price implied = notional/tokens
    pub funding_idx: i128,     // funding index snapshot at last change (SCALAR_18)
    pub borrowing_idx: i128,   // borrowing index snapshot at last change (SCALAR_18)
    pub locked_notional: i128, // notional under the decrease lock, token-dec
    pub unlocks_at: u64,       // lock deadline ts; locked_notional counts while now < unlocks_at
    pub priced_at: u64,        // publish_time of the last fill's price; force-close anti-replay floor
    pub decrease_orders: Vec<u32>, // pending decrease order ids on this side (max 16)
}
```

The zeroed row is the canonical closed state, whether the storage entry exists or not. `decrease_orders` is pruned when an order fills or cancels, and cleared with escrow refunds when the position closes.

### MarketData

```rust
pub struct MarketData {
    pub notional: SidePair,      // open interest per side, token-dec
    pub collateral: SidePair,    // posted collateral per side, token-dec
    pub tokens: SidePair,        // base size per side = sum(notional/entry), base-dec
    pub funding_idx: SidePair,   // cumulative funding index per side (SCALAR_18)
    pub borrowing_idx: SidePair, // cumulative borrowing index per side (SCALAR_18)
    pub funding_rate: i128,      // signed funding rate, + = longs pay (SCALAR_18, per second)
    pub funding_update: u64,     // last funding accrual timestamp
    pub borrowing_update: u64,   // last borrowing accrual timestamp (independent of funding)
    pub funding_pool: i128,      // internal funding pool, token-dec
    pub funding_owed: i128,      // total funding owed to traders, token-dec
    pub last_price_time: u64,    // publish_time of the most recent consumed price (monotonic)
}

pub struct SidePair {
    pub long: i128,
    pub short: i128,
}
```

The funding pool's surplus is `funding_pool - funding_owed`.

### AdlState

```rust
pub struct AdlState {
    pub long: bool,  // long-side ADL enabled: long increases blocked
    pub short: bool, // short-side ADL enabled: short increases blocked
}
```

`Config` is a stored type as well, an instance singleton documented on the [Config](./config.md) page together with its validation rules. `ClaimableFunding` is a bare `i128` (token-dec).

## Status Lifecycle {#status-lifecycle}

The market runs through five states (the `u32` discriminant is in parentheses):

```text
Active (0)   OnIce (1)   Frozen (2)   Delisted (3)   Retired (4)
```

| Status | Opens | Closes / decreases | Vault orders | Claims | Keeper fills | Accrual |
|---|---|---|---|---|---|---|
| Active | yes | yes | yes | yes | yes | yes |
| OnIce | no | yes | yes | yes | yes | yes |
| Frozen | no | no | no | no | no | no |
| Delisted | no | yes | yes | yes | yes | yes |
| Retired | no | no (book already empty) | redeem (direct) only | yes | no | no |

- **Active** is the only status that accepts opens (size-growing increases).
- **OnIce** blocks opens, and everything else keeps running.
- **Frozen** is an emergency halt: `create_order`, `create_vault_order`, `cancel_vault_order`, `claim_funding`, every keeper fill, `accrue`, and `accrue_funding` revert with `MarketFrozen` (704). No accrual runs while a market is Frozen.
- **Delisted** starts the wind-down. Opens are blocked. Within `DELIST_GRACE` (1 day) of the first delist it can be reverted to `Active` or `OnIce`, after that the trading statuses are unreachable for good, and a flat terminal settlement price can be set and refreshed. Once `DELIST_DEADLINE` (7 days) passes, keepers may force-close any remaining position regardless of health, at the flat terminal price if one has been stored and at a verified feed price otherwise (healthy positions flow through the soft liquidation tier and keep full equity). Vault orders keep working in both directions, with redeems still gated by the withdraw-utilization and pending-PnL checks.
- **Retired** is final and reachable from any other status. The only gate is an **empty book** (all positions closed), else `MarketNotCleared` (706). Entering it sweeps the funding-pool surplus to the vault. Only `claim_funding`, a direct vault redeem (a `create_vault_order` redeem executes immediately through the vault's `strategy_redeem` at the raw share price, charges no `exec_fee`, and returns id `0`, deposits are rejected), and cancels stay live. No transition leaves `Retired`.

`Active`, `OnIce`, and `Frozen` interchange freely on a live market. `Frozen`, `Delisted`, and `Retired` are each reachable from any other status except `Retired` itself. A same-status set is rejected with `InvalidStatus` (702). The switch to flat pricing is governed by terminal-price presence, not by the status value. Accrual never stops during the wind-down. Once a terminal price is stored, it keeps running with everything priced flat at the stored value.

## Error Codes

All errors are hard panics that abort the transaction. Trading errors occupy the `7xx` range.

| Code | Name | Meaning |
|---|---|---|
| 700 | `InvalidConfig` | A config value is out of bounds or an ordering invariant is violated |
| 701 | `InvalidPrice` | Flat settlement price is not strictly positive |
| 702 | `InvalidStatus` | Illegal status transition, or the action needs a different status |
| 703 | `BorrowingNotAccrued` | A borrowing rate changed without a same-ledger `accrue` |
| 704 | `MarketFrozen` | Action halted by status (`Frozen`, or `Retired` on trading paths) |
| 705 | `IncreaseHalted` | An Increase ran while the market does not accept opens (status or ADL flag) |
| 706 | `MarketNotCleared` | Retirement attempted while positions remain open |
| 710 | `NegativeValueNotAllowed` | A value that must be non-negative is negative |
| 711 | `NotionalBelowMinimum` | Resulting notional below `min_position_notional` |
| 712 | `NotionalAboveMaximum` | Notional (or an increase delta) above `max_position_notional` |
| 713 | `InsufficientMargin` | Equity below the initial-margin floor (open, increase, or withdraw) or below maintenance margin |
| 714 | `UtilizationExceeded` | Open interest or withdrawal would exceed the utilization cap |
| 715 | `OpenInterestExceeded` | A side's open interest would exceed `max_open_interest` |
| 720 | `PositionNotFound` | No position exists for `(user, is_long)` |
| 721 | `NotionalLocked` | Requested close exceeds the position's unlocked notional |
| 722 | `NotLiquidatable` | Liquidation attempted while equity is still above maintenance margin |
| 730 | `OrderNotFound` | No keeper order for `(user, id)` |
| 731 | `OrderExpired` | Order `expiration` is behind the current ledger sequence |
| 732 | `InvalidOrder` | Disallowed delta pair, a moved value below a dust floor, a trigger kind with `trigger_price == 0`, or a non-positive `execute_adl` amount |
| 733 | `TooManyOrders` | The side already holds `MAX_ORDERS_PER_SIDE` (16) pending decrease orders |
| 734 | `UnknownKind` | Order or vault-order `kind` discriminant is not a known variant |
| 740 | `StalePrice` | Verified price predates the position, the order, or the market's newest consumed price (anti-replay) |
| 741 | `PriceBoundExceeded` | Fill price is worse than the order's `price_bound` |
| 742 | `TriggerNotMet` | The order's `trigger_price` was not crossed |
| 750 | `VaultOrderNotFound` | No vault order for `(user, id)` |
| 751 | `VaultOrderLocked` | A redeem filled before `redeem_lock` seconds from `created_at` elapsed |
| 752 | `MinOutNotMet` | Vault order fill returned less than the order's `min_out` |
| 753 | `VaultBalanceExceeded` | Deposit fill would push the vault above `max_vault_balance` |
| 754 | `PendingPnlExceeded` | Redeem fill while a side's pending PnL exceeds `max_pnl_withdraw` of half the post-redeem balance |
| 760 | `NothingToClaim` | Claim attempted with no claimable funding balance |
| 770 | `AdlNotTriggered` | ADL execution while the side is unflagged or already at the clear target |
| 771 | `AdlOvershoot` | ADL close overshot below the side's clear target |
| 772 | `AdlNotEligible` | ADL close did not reduce the side's pending PnL (not a winner) |

Access-control failures (a non-owner calling an owner-only entry point) raise the Ownable module's own unauthorized error.
