---
sidebar_position: 13
title: Events
---

# Events

The trading contract emits 16 events. This page lists each one with its exact Rust definition, so an indexer can decode topics and data without reading the contract source.

All events use Soroban's `#[contractevent]` derive. The event-name symbol (the snake_case struct name, e.g. `create_order` for `CreateOrder`) is the first topic, then the `#[topic]` fields follow in declared order, and all remaining fields form the data map. Field comments state the units: token decimals (token-dec), base decimals (base-dec), `price_scalar`, or `SCALAR_18`. The `Order`, `VaultOrder`, and `Position` rows carried as payloads are the stored types documented on [Storage & Config](./storage.md#stored-types).

## Trade Orders

Emitted by `create_order` and `cancel_order`.

```rust
/// Order created via `create_order`.
pub struct CreateOrder {
    #[topic] pub user: Address,
    #[topic] pub id: u32,
    pub order: Order, // the stored order row, as returned by `get_order`
}

/// Pending order removed via `cancel_order`.
pub struct CancelOrder {
    #[topic] pub user: Address,
    #[topic] pub id: u32,
}
```

`cancel_order` covers auto-cancels too. When a position fully closes (decrease fill, liquidation, ADL, or delist wind-down), every pending decrease order resting on that side is auto-cancelled with one `cancel_order` event per id, and its escrow is folded into the trader's payout.

## Position Fills

Emitted by `execute_order`, `execute_adl`, and `execute_liquidation`. Every fill also emits the paired `position_update` carrying the resulting position state.

```rust
/// A keeper fill of an increase order (the user's itemized receipt).
pub struct IncreaseFill {
    #[topic] pub user: Address,
    #[topic] pub id: u32,
    #[topic] pub is_long: bool,
    pub notional: i128,   // size added, token-dec
    pub tokens: i128,     // base size bought, base-dec
    pub collateral: i128, // collateral pulled from the trader, token-dec
    pub base_fee: i128,   // trade fee charged, token-dec
    pub impact_fee: i128, // impact fee charged, token-dec
    pub funding: i128,    // settled funding, token-dec; + = paid from collateral, - = credited claimable
    pub borrowing: i128,  // settled borrowing fee, token-dec
}

/// A keeper fill of a decrease order (the user's itemized receipt).
pub struct DecreaseFill {
    #[topic] pub user: Address,
    #[topic] pub id: u32, // filled order id; 0 = forced ADL close via `execute_adl`
    #[topic] pub is_long: bool,
    pub notional: i128,   // closed size: the order's request clamped to the position, token-dec
    pub tokens: i128,     // base size closed, base-dec
    pub collateral: i128, // gross collateral leg: requested withdrawal (partial) or freed margin (full), token-dec
    pub pnl: i128,        // realized PnL on the closed fraction, gross of settled costs, token-dec
    pub base_fee: i128,   // trade fee charged, token-dec
    pub impact_fee: i128, // impact fee charged, token-dec
    pub funding: i128,    // settled funding, token-dec; + = paid from collateral, - = credited claimable
    pub borrowing: i128,  // settled borrowing fee, token-dec
    pub bad_debt: i128,   // fees and losses past the freed margin, absorbed by the vault, token-dec; 0 on partial closes
    pub returned: i128,   // closed-position payout, token-dec
}

/// A keeper liquidation receipt (the full size is force-closed).
pub struct Liquidation {
    #[topic] pub user: Address,
    #[topic] pub is_long: bool,
    pub notional: i128,   // force-closed size, token-dec
    pub tokens: i128,     // base size closed, base-dec
    pub collateral: i128, // freed margin, gross of the itemized fees, token-dec
    pub pnl: i128,        // realized PnL on the closed size, gross of settled costs, token-dec
    pub base_fee: i128,   // trade fee charged, token-dec
    pub impact_fee: i128, // impact fee charged, token-dec
    pub funding: i128,    // settled funding, token-dec; + = paid from collateral, - = credited claimable
    pub borrowing: i128,  // settled borrowing fee, token-dec
    pub bad_debt: i128,   // fees and losses past the freed margin, absorbed by the vault, token-dec
    pub liq_fee: i128,    // liquidation fee, token-dec; 0 = soft tier, > 0 = hard tier
    pub returned: i128,   // post-fee remainder paid to the trader (soft tier), token-dec
    pub forfeit: i128,    // post-fee remainder forfeited to the vault (hard tier), token-dec
}

/// The resulting netted position after any change (fill or liquidation).
pub struct PositionUpdate {
    #[topic] pub user: Address,
    #[topic] pub is_long: bool,
    pub position: Position, // the stored position row, as returned by `get_position`; zeroed = closed
}
```

### Reading the fill receipts

- **Fill price is implied.** On `increase_fill`, `notional * SCALAR_18 / tokens` is the fill price (in `price_scalar` units). On `decrease_fill` and `liquidation`, `notional` and `tokens` are the closed fraction at entry pricing, so that ratio is the entry price of the closed chunk, not the close price. The close price derives through `pnl`: `tokens * P_close = notional + pnl` for a long, `notional - pnl` for a short. No event carries a price field.
- **`collateral` and `pnl` are gross** of the itemized fees. On a `decrease_fill`, `returned` is the actual payout: the gross legs less the fees they cover, floored at zero. A partial close pays only the profit leg while a realized loss debits the surviving margin. `bad_debt` is `0` on partial closes.
- **`liquidation` tier**: `liq_fee = 0` is the soft tier (post-fee remainder on `returned`, to the trader), while `liq_fee > 0` is the hard tier (remainder on `forfeit`, to the vault).
- **The trader transfer exceeds `returned`** when the same call auto-cancels resting decrease orders: their refunded escrow is folded into the single payout transfer, itemized by the accompanying `cancel_order` events.

## Vault Orders

Emitted by `create_vault_order`, `cancel_vault_order`, and `execute_vault_order`.

```rust
/// Vault deposit or redeem order created via `create_vault_order`.
pub struct CreateVaultOrder {
    #[topic] pub user: Address,
    #[topic] pub id: u32,
    pub order: VaultOrder, // the stored vault-order row, as returned by `get_vault_order`
}

/// Pending vault order removed via `cancel_vault_order`.
pub struct CancelVaultOrder {
    #[topic] pub user: Address,
    #[topic] pub id: u32,
}

/// A keeper fill of a deposit order via `execute_vault_order` (the user's receipt).
pub struct DepositFill {
    #[topic] pub user: Address,
    #[topic] pub id: u32,
    pub assets: i128,  // gross assets deposited from escrow, token-dec; the vault receives assets - fee
    pub shares: i128,  // vault shares minted to the user
    pub fee: i128,     // vault fee charged (keeper, treasury, and vault cuts), token-dec
    pub net_pnl: i128, // capped net pending trader PnL the share mint priced against, signed, token-dec
}

/// A keeper fill of a redeem order via `execute_vault_order` (the user's receipt).
pub struct RedeemFill {
    #[topic] pub user: Address,
    #[topic] pub id: u32, // vault order id; 0 = retired-market instant redeem executed at creation
    pub shares: i128,  // vault shares burned from escrow
    pub assets: i128,  // gross assets redeemed from the vault, token-dec; the user is paid assets - fee
    pub fee: i128,     // vault fee charged (keeper, treasury, and vault cuts), token-dec
    pub net_pnl: i128, // capped net pending trader PnL the share burn priced against, signed, token-dec
}
```

## Funding

```rust
/// Claimable funding balance paid out via `claim_funding`.
pub struct ClaimFunding {
    #[topic] pub user: Address,
    pub amount: i128, // paid claimable balance, token-dec
}
```

## Market State

```rust
/// ADL flags recomputed via `update_adl_state`.
pub struct AdlUpdate {
    pub long: bool,  // long-side ADL enabled (long increases blocked)
    pub short: bool, // short-side ADL enabled (short increases blocked)
}

/// The market's post-accrual funding and borrowing state, emitted by the
/// first call in a ledger that advances either accrual clock (a
/// same-timestamp re-accrual emits nothing).
pub struct AccrualUpdate {
    pub funding_rate: i128,      // signed funding rate after the accrual, + = longs pay (SCALAR_18, per second)
    pub funding_idx: SidePair,   // cumulative funding index per side (SCALAR_18)
    pub borrowing_idx: SidePair, // cumulative borrowing index per side (SCALAR_18)
    pub timestamp: u64,          // ledger timestamp the indices are accrued to
}

/// Operational status changed via `set_status`.
pub struct StatusUpdate {
    pub status: u32, // the new operational status (Status discriminant)
}

/// Global configuration replaced via `set_config`.
pub struct ConfigUpdate {
    pub config: Config, // the new global trading configuration
}

/// Flat settlement price set or refreshed via `set_terminal_price`.
pub struct TerminalPriceUpdate {
    pub price: i128, // flat settlement price (price_scalar units)
}
```

`accrual_update` fires on any entry point that advances the accrual clocks (fills, liquidations, ADL, `accrue`, `accrue_funding`, and `set_config`), so it is the stream to follow for live funding and borrowing indices between fills.

## Other Emitters

The factory emits one further event, `Deploy { trading, vault }`, when it deploys a pair. See [Factory](../factory/overview). The strategy vault emits the share token's standard events plus the library's `Deposit` and `Withdraw` (see [Vault](../vault/overview)). The Ownable module additionally emits its standard ownership-transfer events.
