---
sidebar_position: 14
title: Events
---

# Events

The trading contract emits 17 events. This page lists each one with its exact Rust definition, so an indexer can decode topics and data without reading the contract source.

Events are receipts for actions, not mirrors of contract state. The one exception is the created order row, carried on the create events because it is immutable while pending, so the payload stays authoritative until the order's fill or cancel receipt. Resulting position and market state are read back through the getters (`get_position`, `get_market_data`, ...) or from the transaction's ledger entry changes, which carry every stored row the transaction wrote.

All events use Soroban's `#[contractevent]` derive. The event-name symbol (the snake_case struct name, e.g. `create_order` for `CreateOrder`) is the first topic, then the `#[topic]` fields follow in declared order, and all remaining fields form the data map. Field comments state the units: token decimals (token-dec), base decimals (base-dec), `price_scalar`, or `SCALAR_18`. The stored types behind the rows are documented on [Storage](./storage.md#stored-types).

## Trade Orders

Emitted by `create_order` and `cancel_order`.

```rust
/// Order created via `create_order`. The row is immutable while pending, so
/// the payload stays authoritative until the order's fill or cancel receipt.
#[contractevent]
pub struct CreateOrder {
    #[topic] pub user: Address,
    #[topic] pub id: u32,
    pub order: Order, // the stored order row, as returned by `get_order`
}

/// Pending order removed via `cancel_order`.
#[contractevent]
pub struct CancelOrder {
    #[topic] pub user: Address,
    #[topic] pub id: u32,
}
```

`cancel_order` covers auto-cancels too. When a position fully closes (decrease fill, liquidation, ADL, or delist wind-down), every pending decrease order resting on that side is auto-cancelled with one `cancel_order` event per id, and its escrow is folded into the trader's payout.

## Position Fills

Emitted by `execute_order`, `execute_adl`, and `execute_liquidation`. An increase emits `increase_fill`, a partial decrease (the position survives) emits `decrease_fill`, and a full close emits `close_fill`, with `execute_adl` emitting the decrease or close receipt under id `0`. The fill is the itemized receipt; the resulting position state is the stored row, readable at `get_position(user, is_long)` and in the transaction's ledger entry changes (a fully closed position's row is removed).

```rust
/// A keeper fill of an increase order (the user's itemized receipt).
#[contractevent]
pub struct IncreaseFill {
    #[topic] pub user: Address,
    #[topic] pub id: u32,
    #[topic] pub is_long: bool,
    pub keeper: Address,  // reward recipient named by the fill's caller
    pub price: i128,      // entry-side execution price (ask for a long, bid for a short), price_scalar units
    pub notional: i128,   // size added, token-dec
    pub tokens: i128,     // base size bought, base-dec
    pub collateral: i128, // collateral pulled from the trader, token-dec
    pub base_fee: i128,   // trade fee charged, token-dec
    pub impact_fee: i128, // impact fee charged, token-dec
    pub funding: i128,    // settled funding, token-dec; + = paid from collateral, - = credited claimable
    pub borrowing: i128,  // settled borrowing fee, token-dec
}

/// A keeper fill of a partial decrease (the position survives the fill).
#[contractevent]
pub struct DecreaseFill {
    #[topic] pub user: Address,
    #[topic] pub id: u32, // filled order id; 0 = forced ADL close via `execute_adl`
    #[topic] pub is_long: bool,
    pub keeper: Address,  // reward recipient named by the fill's caller
    pub price: i128,      // exit-side execution price (bid for a long, ask for a short), price_scalar units
    pub notional: i128,   // closed size, token-dec
    pub tokens: i128,     // base size closed, base-dec
    pub collateral: i128, // requested withdrawal, token-dec
    pub pnl: i128,        // realized PnL on the closed fraction (post-haircut), gross of settled costs, token-dec
    pub base_fee: i128,   // trade fee charged, token-dec
    pub impact_fee: i128, // impact fee charged, token-dec
    pub funding: i128,    // settled funding, token-dec; + = paid from collateral, - = credited claimable
    pub borrowing: i128,  // settled borrowing fee, token-dec
    pub returned: i128,   // payout to the trader: the gross legs less the fees they cover, token-dec
}

/// A keeper fill that closes the whole position (the stored row zeroes).
#[contractevent]
pub struct CloseFill {
    #[topic] pub user: Address,
    #[topic] pub id: u32, // filled order id; 0 = forced ADL close via `execute_adl`
    #[topic] pub is_long: bool,
    pub keeper: Address,  // reward recipient named by the fill's caller
    pub price: i128,      // exit-side execution price (bid for a long, ask for a short), price_scalar units
    pub notional: i128,   // full closed size, token-dec
    pub tokens: i128,     // base size closed, base-dec
    pub collateral: i128, // freed margin, gross of the itemized fees, token-dec
    pub pnl: i128,        // realized PnL on the closed size (post-haircut), gross of settled costs, token-dec
    pub base_fee: i128,   // trade fee charged, token-dec
    pub impact_fee: i128, // impact fee charged, token-dec
    pub funding: i128,    // settled funding, token-dec; + = paid from collateral, - = credited claimable
    pub borrowing: i128,  // settled borrowing fee, token-dec
    pub bad_debt: i128,   // fees and losses past the freed margin, absorbed by the vault, token-dec
    pub returned: i128,   // post-fee equity paid to the trader, token-dec
}

/// A keeper liquidation receipt (the full size is force-closed).
#[contractevent]
pub struct Liquidation {
    #[topic] pub user: Address,
    #[topic] pub is_long: bool,
    pub keeper: Address,  // reward recipient named by the fill's caller
    pub price: i128,      // exit-side execution price (bid for a long, ask for a short), price_scalar units
    pub notional: i128,   // force-closed size, token-dec
    pub tokens: i128,     // base size closed, base-dec
    pub collateral: i128, // freed margin, gross of the itemized fees, token-dec
    pub pnl: i128,        // realized PnL on the closed size (post-haircut), gross of settled costs, token-dec
    pub base_fee: i128,   // trade fee charged, token-dec
    pub impact_fee: i128, // impact fee charged, token-dec
    pub funding: i128,    // settled funding, token-dec; + = paid from collateral, - = credited claimable
    pub borrowing: i128,  // settled borrowing fee, token-dec
    pub bad_debt: i128,   // fees and losses past the freed margin, absorbed by the vault, token-dec
    pub liq_fee: i128,    // liquidation fee, token-dec; 0 = soft tier, > 0 = hard tier
    pub returned: i128,   // post-fee remainder paid to the trader (soft tier), token-dec
    pub forfeit: i128,    // post-fee remainder forfeited to the vault (hard tier), token-dec
}
```

### Reading the fill receipts

- **`price` is the execution price** the fill settled at: the entry side (ask for a long, bid for a short) on an `increase_fill`, the exit side (bid for a long, ask for a short) on the close receipts. On a close, `notional` and `tokens` are the closed size at entry pricing, so `notional * SCALAR_18 / tokens` is the entry price of the closed chunk while `price` is what it closed at.
- **`collateral` and `pnl` are gross** of the itemized fees, and `pnl` is post-haircut. `returned` is the actual payout: the gross legs less the fees they cover, floored at zero. On a `decrease_fill` a realized loss debits the surviving margin, never the payout, and no bad debt is possible, which is why the partial receipt has no `bad_debt` field. On a `close_fill` the payout is the post-fee equity and any shortfall past the freed margin lands on `bad_debt`.
- **`liquidation` tier**: `liq_fee = 0` is the soft tier (post-fee remainder on `returned`, to the trader), while `liq_fee > 0` is the hard tier (remainder on `forfeit`, to the vault).
- **The trader transfer exceeds `returned`** when a full closure auto-cancels resting decrease orders: their refunded escrow is folded into the single payout transfer, itemized by the accompanying `cancel_order` events.

## Vault Orders

Emitted by `create_vault_order`, `cancel_vault_order`, and `execute_vault_order`.

```rust
/// Vault deposit or redeem order created via `create_vault_order`. The row is
/// immutable while pending, so the payload stays authoritative until the
/// order's fill or cancel receipt.
#[contractevent]
pub struct CreateVaultOrder {
    #[topic] pub user: Address,
    #[topic] pub id: u32,
    pub order: VaultOrder, // the stored vault-order row, as returned by `get_vault_order`
}

/// Pending vault order removed via `cancel_vault_order`.
#[contractevent]
pub struct CancelVaultOrder {
    #[topic] pub user: Address,
    #[topic] pub id: u32,
}

/// A keeper fill of a deposit order via `execute_vault_order` (the user's receipt).
#[contractevent]
pub struct DepositFill {
    #[topic] pub user: Address,
    #[topic] pub id: u32,
    pub keeper: Address, // reward recipient named by the fill's caller
    pub assets: i128,    // gross assets deposited from escrow, token-dec; the vault receives assets - fee
    pub shares: i128,    // vault shares minted to the user
    pub fee: i128,       // vault fee charged (keeper, treasury, and vault cuts), token-dec
    pub net_pnl: i128,   // capped net pending trader PnL the share mint priced against, signed, token-dec
}

/// A keeper fill of a redeem order via `execute_vault_order` (the user's receipt).
#[contractevent]
pub struct RedeemFill {
    #[topic] pub user: Address,
    #[topic] pub id: u32, // vault order id; 0 = retired-market instant redeem executed at creation
    pub keeper: Address,  // reward recipient named by the fill's caller; the redeeming user on a retired-market instant redeem
    pub shares: i128,     // vault shares burned from escrow
    pub assets: i128,     // gross assets redeemed from the vault, token-dec; the user is paid assets - fee
    pub fee: i128,        // vault fee charged (keeper, treasury, and vault cuts), token-dec
    pub net_pnl: i128,    // capped net pending trader PnL the share burn priced against, signed, token-dec
}
```

## Funding

```rust
/// Claimable funding balance paid out via `claim_funding`.
#[contractevent]
pub struct ClaimFunding {
    #[topic] pub user: Address,
    pub amount: i128, // paid claimable balance, token-dec
}
```

## Market State

```rust
/// ADL flags recomputed via `update_adl_state`.
#[contractevent]
pub struct AdlUpdate {
    pub long: bool,  // long-side ADL enabled (long increases blocked)
    pub short: bool, // short-side ADL enabled (short increases blocked)
}

/// The market's post-accrual funding state, emitted by the `accrue` and
/// `accrue_funding` entries.
#[contractevent]
pub struct FundingAccrual {
    pub funding_rate: i128,    // signed funding rate after the accrual, + = longs pay (SCALAR_18, per second)
    pub funding_idx: SidePair, // cumulative funding index per side (SCALAR_18)
    pub timestamp: u64,        // ledger timestamp the funding index is accrued to
}

/// The market's post-accrual borrowing state, emitted by the `accrue` entry.
#[contractevent]
pub struct BorrowingAccrual {
    pub borrowing_idx: SidePair, // cumulative borrowing index per side (SCALAR_18)
    pub timestamp: u64,          // ledger timestamp the borrowing index is accrued to
}

/// Operational status changed via `set_status`.
#[contractevent]
pub struct StatusUpdate {
    pub status: u32, // the new operational status (Status discriminant)
}

/// Global configuration replaced via `set_config`.
#[contractevent]
pub struct ConfigUpdate {
    pub config: Config, // the new global trading configuration
}

/// Flat settlement price set or refreshed via `set_terminal_price`.
#[contractevent]
pub struct TerminalPriceUpdate {
    pub price: i128, // flat settlement price (price_scalar units)
}
```

The accrual events come only from the maintenance entries: `accrue` emits `funding_accrual` and `borrowing_accrual`, `accrue_funding` emits `funding_accrual` alone. Fills and `set_config` advance the same indices without emitting an accrual event, so the authoritative live indices between accrual pokes are the `MarketData` row in each transaction's ledger entry changes.

## Other Emitters

The factory emits one further event, `Deploy { trading, vault }`, when it deploys a pair. See [Factory](../factory/overview). The strategy vault emits the share token's standard events plus the library's `Deposit` and `Withdraw` (see [Vault](../vault/overview)). The Ownable module additionally emits its standard ownership-transfer events.
