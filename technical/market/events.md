---
sidebar_position: 14
title: Events
---

# Events

The market contract emits 18 events. This page lists each one with its exact Rust definition, so an indexer can decode topics and data without reading the contract source.

Events are receipts for actions, not mirrors of contract state. The one exception is the created order row, carried on the create events because it is immutable while pending, so the payload stays authoritative until the order's fill or cancel receipt. Resulting position and market state are read back through the getters (`get_position`, `get_market_data`, ...) or from the transaction's ledger entry changes, which carry every stored row the transaction wrote.

All events use Soroban's `#[contractevent]` derive. The event-name symbol (the snake_case struct name, e.g. `create_order` for `CreateOrder`) is the first topic, then the `#[topic]` fields follow in declared order, and all remaining fields form the data map, keyed by field name and sorted by that name's bytes, so the declaration order below is documentation rather than wire layout. An event with no non-topic fields carries an empty map rather than a void value. Field comments state the units: token decimals (token-dec), base decimals (base-dec), feed precision for prices, or `SCALAR_18`. The stored types behind the rows are documented on [Storage](./storage.md#stored-types).

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

/// Pending order cancelled by its owner via `cancel_order`, or by the closure
/// sweep that cancels every decrease order still resting on a closed side.
#[contractevent]
pub struct CancelOrder {
    #[topic] pub user: Address,
    #[topic] pub id: u32,
    pub refund: i128, // escrow returned by this cancel (Order::escrow_amount), token-dec
}
```

`cancel_order` covers auto-cancels too. When a position fully closes (decrease fill, liquidation, ADL, or delist wind-down), every pending decrease order resting on that side is auto-cancelled with one `cancel_order` event per id, each carrying its own `refund`. An owner-initiated cancel pays its refund in its own transfer, while the swept refunds ride the closure payout's single transfer.

## Position Fills

Emitted by `execute_order`, `execute_adl`, and `execute_liquidation`. An increase that opens the side (the position was empty before the fill) emits `open_fill`, an increase on an already-open position emits `increase_fill`, a partial decrease (the position survives) emits `decrease_fill`, and a full close emits `close_fill`, with `execute_adl` emitting the decrease or close receipt under id `0`. Both lifecycle boundaries are chain-attested: `open_fill` marks zero to size exactly as `close_fill` marks size to zero. Only the order-fill path can open, so ADL and liquidation never emit `open_fill`. The fill is the itemized receipt. The resulting position state is the stored row, readable at `get_position(user, is_long)` and in the transaction's ledger entry changes (a fully closed position persists as the canonical zeroed row).

```rust
/// A keeper fill that opens the position (the side was empty before the fill).
/// Same payload keys as IncreaseFill minus `funding` and `borrowing`: accruals
/// settle over the pre-fill notional, which is 0 when the side was empty, so
/// both are structurally zero on an open.
#[contractevent]
pub struct OpenFill {
    #[topic] pub user: Address,
    #[topic] pub id: u32,
    #[topic] pub is_long: bool,
    pub keeper: Address,  // reward recipient named by the fill's caller
    pub price: i128,      // entry-side execution price (ask for a long, bid for a short), feed precision
    pub notional: i128,   // size opened, token-dec
    pub tokens: i128,     // base size bought, base-dec
    pub margin: i128,     // margin pulled from the trader, token-dec
    pub base_fee: i128,   // trade fee charged, token-dec
    pub impact_fee: i128, // impact fee charged, token-dec
}

/// A keeper fill of an increase order on an already-open position (the user's
/// itemized receipt); an order that opens the side emits OpenFill instead.
#[contractevent]
pub struct IncreaseFill {
    #[topic] pub user: Address,
    #[topic] pub id: u32,
    #[topic] pub is_long: bool,
    pub keeper: Address,  // reward recipient named by the fill's caller
    pub price: i128,      // entry-side execution price (ask for a long, bid for a short), feed precision
    pub notional: i128,   // size added, token-dec
    pub tokens: i128,     // base size bought, base-dec
    pub margin: i128,     // margin pulled from the trader, token-dec
    pub base_fee: i128,   // trade fee charged, token-dec
    pub impact_fee: i128, // impact fee charged, token-dec
    pub funding: i128,    // settled funding, token-dec; + = paid from margin, - = credited claimable
    pub borrowing: i128,  // settled borrowing fee, token-dec
}

/// A keeper fill of a partial decrease (the position survives the fill).
#[contractevent]
pub struct DecreaseFill {
    #[topic] pub user: Address,
    #[topic] pub id: u32, // filled order id; 0 = forced ADL close via `execute_adl`
    #[topic] pub is_long: bool,
    pub keeper: Address,  // reward recipient named by the fill's caller
    pub price: i128,      // exit-side execution price (bid for a long, ask for a short), feed precision
    pub notional: i128,   // closed size, token-dec
    pub tokens: i128,     // base size closed, base-dec
    pub margin: i128,     // requested withdrawal, token-dec
    pub pnl: i128,        // realized PnL on the closed fraction (post-haircut), gross of settled costs, token-dec
    pub base_fee: i128,   // trade fee charged, token-dec
    pub impact_fee: i128, // impact fee charged, token-dec
    pub funding: i128,    // settled funding, token-dec; + = paid from margin, - = credited claimable
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
    pub price: i128,      // exit-side execution price (bid for a long, ask for a short), feed precision
    pub notional: i128,   // full closed size, token-dec
    pub tokens: i128,     // base size closed, base-dec
    pub margin: i128,     // freed margin, gross of the itemized fees, token-dec
    pub pnl: i128,        // realized PnL on the closed size (post-haircut), gross of settled costs, token-dec
    pub base_fee: i128,   // trade fee charged, token-dec
    pub impact_fee: i128, // impact fee charged, token-dec
    pub funding: i128,    // settled funding, token-dec; + = paid from margin, - = credited claimable
    pub borrowing: i128,  // settled borrowing fee, token-dec
    pub bad_debt: i128,   // fees and losses past the freed margin, absorbed by the vault, token-dec
    pub returned: i128,   // post-fee equity paid to the trader, token-dec
}

/// A keeper liquidation receipt (the full size is force-closed). Every
/// liquidation charges the capped `liq_fee`, split keeper/treasury/vault like a
/// trade fee, and pays the trader the rest on `returned`. Any shortfall past
/// the freed margin lands on `bad_debt`.
#[contractevent]
pub struct Liquidation {
    #[topic] pub user: Address,
    #[topic] pub is_long: bool,
    pub keeper: Address,  // reward recipient named by the fill's caller
    pub price: i128,      // exit-side execution price (bid for a long, ask for a short), feed precision
    pub notional: i128,   // force-closed size, token-dec
    pub tokens: i128,     // base size closed, base-dec
    pub margin: i128,     // freed margin, gross of the itemized fees, token-dec
    pub pnl: i128,        // realized PnL on the closed size (post-haircut), gross of settled costs, token-dec
    pub base_fee: i128,   // trade fee charged, token-dec
    pub impact_fee: i128, // impact fee charged, token-dec
    pub funding: i128,    // settled funding, token-dec; + = paid from margin, - = credited claimable
    pub borrowing: i128,  // settled borrowing fee, token-dec
    pub bad_debt: i128,   // fees and losses past the freed margin, absorbed by the vault, token-dec
    pub returned: i128,   // remainder paid to the trader net of the liquidation fee, token-dec
    pub liq_fee: i128,    // liquidation fee charged: min(equity, ceil(liq_fee_rate * notional)), token-dec
}
```

### Reading the fill receipts

- **`price` is the execution price** the fill settled at: the entry side (ask for a long, bid for a short) on an `open_fill` or `increase_fill`, the exit side (bid for a long, ask for a short) on the close receipts. On a close, `notional` and `tokens` are the closed size at entry pricing, so `notional * SCALAR_18 / tokens` is the entry price of the closed chunk while `price` is what it closed at.
- **`open_fill` carries no `funding` or `borrowing`**: accruals settle over the notional held before the fill, which is zero when the side opens, so both fields would always be zero and are omitted from the payload.
- **`margin` and `pnl` are gross** of the itemized fees, and `pnl` is post-haircut. `returned` is the actual payout: the gross legs less the fees they cover, floored at zero. On a `decrease_fill` a realized loss debits the surviving margin, never the payout, and margin floors at zero with any shortfall past it booked as bad debt. The survivor must still clear its margin lines, so a partial that would leave bad debt behind aborts, and the partial receipt carries no `bad_debt` field. On a `close_fill` the payout is the post-fee equity and any shortfall past the freed margin lands on `bad_debt`.
- **`liquidation` always charges `liq_fee`**, capped at the close's post-fee equity. `returned` is the remainder paid to the trader net of that fee, zero exactly where the fee saturates the whole remainder.
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

## Credit

```rust
/// A user claimed their credit balance through `claim_credit`.
#[contractevent]
pub struct ClaimCredit {
    #[topic] pub user: Address,
    pub amount: i128, // paid claimable balance, token-dec
}
```

The credit ledger holds earned funding plus any payout whose direct token
transfer failed (the market parks it as claimable credit instead of
trapping the fill).

## Market State

```rust
/// ADL flags recomputed via `update_adl_state`.
#[contractevent]
pub struct AdlUpdate {
    pub long: bool,  // long-side ADL enabled (long increases blocked)
    pub short: bool, // short-side ADL enabled (short increases blocked)
}

/// A keeper advanced the accrual indices through `accrue`. The event only
/// marks the poke and carries no payload; the post-accrual market state is
/// read from `get_market_data`.
#[contractevent]
pub struct AccrualUpdate {}

/// Operational status changed via `set_status`.
#[contractevent]
pub struct StatusUpdate {
    pub status: u32, // the new operational status (Status discriminant)
}

/// Global configuration replaced via `set_config`.
#[contractevent]
pub struct ConfigUpdate {
    pub config: Config, // the new global market configuration
}

/// Flat settlement price set or refreshed via `set_terminal_price`.
#[contractevent]
pub struct TerminalPriceUpdate {
    pub price: i128, // flat settlement price (feed precision)
}
```

Both accrual events come only from `accrue`, always as a pair on one accrual clock (`MarketData::accrued_at`), so they always carry the same `timestamp`. Every other price-bearing call (order fills, vault-order fills, liquidation, ADL) advances the same indices silently, so the authoritative live indices between accrual pokes are the `MarketData` row in each transaction's ledger entry changes.

## Other Emitters

The factory emits one further event, `Deploy { trading, vault }`, when it deploys a pair. See [Factory](../factory/overview). The strategy vault emits the share token's standard events plus the library's `Deposit` and `Withdraw` (see [Vault](../vault/overview)). The Ownable module additionally emits its standard ownership-transfer events.
