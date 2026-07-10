---
sidebar_position: 1
title: Trading Contract
---

# Trading Contract

The trading contract is the core perpetual futures engine. It manages orders, netted position lifecycle, PnL settlement, fee distribution, funding and borrowing accrual, liquidation, and auto-deleveraging.

## Single Market Per Contract

One trading contract serves exactly one market, identified by the contract's immutable `(feed_id, exponent)` oracle anchors, set once in the constructor. The factory deploys one isolated trading + vault pair per market, so running several markets means deploying several independent pairs. This isolates each market's risk, storage, and configuration.

The contract is **immutable**: a logic change ships as a fresh trading + vault pair through the factory, and existing pairs keep running the code they were deployed with.

## The Order then Keeper-Execute Flow

Every fill runs through a permissionless keeper entry point at a verified oracle price. The flow is two-sided:

1. A trader calls `create_order` (or `create_vault_order`) with a **price-free** intent, authorized by their own signature. An increase order escrows its collateral plus the flat `exec_fee` from the trader at creation, and a decrease order escrows the `exec_fee` only. A vault order escrows its assets or shares plus the `exec_fee` immediately.
2. A permissionless **keeper** calls `execute_order` (or a sibling keeper entry point), passing a serialized Pyth Lazer price update. The contract verifies the price against its feed, checks the order's trigger and slippage bound against that price, and settles the fill.

The keeper is not authenticated. It is simply the reward recipient named by the caller. The trader's consent lives in the escrow they fund at order creation, and in the trigger and slippage bounds baked into the order. A market order is an order created with a market kind, fillable immediately. Limit and stop kinds carry a `trigger_price` and fill only once the execution price crosses it, in the direction implied by the kind and side.

## Public Interface

### Admin Actions (owner only)

All admin actions require the contract owner (`#[only_owner]`).

| Function | Description |
|---|---|
| `set_config` | Replace the global `Config`. A borrowing-parameter change requires a same-ledger `accrue`, else `BorrowingNotAccrued` (703). |
| `set_status` | Set operational status per the [status lifecycle](#operational-status). Entering `Retired` sweeps the funding-pool surplus to the vault. |
| `set_terminal_price` | Set or refresh the flat settlement price of a delisted market, after its grace window expires. |

The contract also exposes the OpenZeppelin two-step Ownable surface (`transfer_ownership`, `accept_ownership`, `renounce_ownership`, `get_owner`). That is the full extent of privileged control: ownership can transfer, but the deployed contract logic is fixed for the life of the pair.

### Trader Actions (auth = the user's own signature, price-free)

| Function | Description |
|---|---|
| `create_order` | Create an order of one of six kinds (market, limit, or stop, each as an increase or a decrease) for the keeper to fill. An increase escrows `collateral + exec_fee`, a decrease escrows `exec_fee` only. Returns the order id. |
| `cancel_order` | Cancel a pending order the caller owns and refund its full escrow. |
| `create_vault_order` | Create a deposit or redeem vault order, escrowing assets or shares plus the flat `exec_fee`. Returns the order id. |
| `cancel_vault_order` | Cancel a pending vault order and refund the escrow (principal plus `exec_fee`). Returns the escrowed principal. |
| `claim_funding` | Pay out the caller's claimable funding, capped at the current funding-pool balance. Any remainder stays claimable. |

### Keeper Actions (permissionless, price-bearing)

Anyone may call these, passing a serialized Pyth Lazer price. The named `keeper` is the reward recipient.

| Function | Description |
|---|---|
| `execute_order` | Fill a pending order (increase or decrease) at the verified price and settle it. |
| `execute_liquidation` | Force-close a position `(user, is_long)` that has fallen below maintenance margin (or any position past a delisted market's deadline). |
| `execute_vault_order` | Fill the whole pending vault order at the verified price and remove it. Vault orders fill in full or not at all. |
| `update_adl_state` | Recompute both sides' pending PnL and set or clear the per-side ADL flags. |
| `execute_adl` | Deleverage a winning position on a flagged side. |
| `accrue` | Advance both accrual indices (borrowing and funding) to now at a verified price. |

`execute_order` and `execute_vault_order` pay the caller the `keeper_rate` cut of the relevant fee plus the order's escrowed `exec_fee`. `execute_liquidation` and `execute_adl` pay the `keeper_rate` cut of the trade fee only (there is no order, so no `exec_fee`). `update_adl_state` and `accrue` pay nothing. See [Keeper Execution](./keeper-execution.md).

### Maintenance (permissionless, price-free)

| Function | Description |
|---|---|
| `accrue_funding` | Advance the funding index to now. Funding accrual needs no price. |

### Read-Only

| Function | Description |
|---|---|
| `get_config` | Current global `Config` |
| `get_market_data` | `MarketData` as of its last accrual |
| `get_position` | Netted `Position` for `(user, is_long)`, zeroed if none open |
| `get_order` | `Order` row for `(user, id)` |
| `get_vault_order` | `VaultOrder` row for `(user, id)` |
| `get_status` | Operational status discriminant |
| `get_adl` | `AdlState` (per-side flags) |
| `get_claimable_funding` | Funding owed to a user |
| `get_token` / `get_vault` / `get_treasury` / `get_price_verifier` | Wired dependency addresses |
| `get_retirement` | `None` until first delist, else `(terminal_price, delisted_at)` |
| `get_feed` | The immutable `(feed_id, exponent)` pair |

## Netted Positions

Positions are **netted, one per `(user, is_long)`**. A user holds at most one long and one short position in a market. An Increase order grows the netted position on its side, and a Decrease shrinks it. A position is stored under the `Position(Address, bool)` key, `(user, is_long)`, and a fully closed position is a zeroed row (zero notional), which is the canonical closed state. See [Position Lifecycle](./position-lifecycle.md).

Orders and vault orders, by contrast, do carry ids allocated per user, so a trader can have several resting orders at once.

## Operational Status

The market runs through a five-state lifecycle. The full transition matrix and wind-down mechanics are on [Storage & Events](./storage.md#status-lifecycle). Short version:

```text
Active   (0) : normal trading; the only status that accepts opens
OnIce    (1) : opens blocked; closes, decreases, vault orders, claims, accrual keep running
Frozen   (2) : emergency halt; everything blocked except trade-order cancels
Delisted (3) : wind-down; opens blocked, a terminal price can eventually be set
Retired  (4) : final; only claims, direct vault redeems, and cancels remain
```

Only `Active` accepts opens (size-growing increases). `Frozen` blocks `create_order`, `create_vault_order`, `cancel_vault_order`, `claim_funding`, every keeper fill, and both accrual entry points with `MarketFrozen` (704). `cancel_order` is never status-gated, so a trader can always recover a resting order's escrow. Entering `Retired` requires an empty book and sweeps the funding-pool surplus to the vault.

## Constants and Scales

All rates, ratios, fees, and margins are stored as `SCALAR_18` (`10^18`) fixed-point fractions. Rate parameters (borrowing, funding) are expressed **per second**. Prices use the feed's own `price_scalar = 10^-exponent`. Token amounts (notional, collateral, payouts) are in the settlement token's decimals, while base sizes (`tokens`) use the derived base scale `10^(18 + token_decimals + exponent)`, defined by `tokens = notional * SCALAR_18 / price`.

The protocol constants that bound config validation, plus the fixed wind-down windows:

| Constant | Value | Meaning |
|---|---|---|
| `MAX_KEEPER_RATE` | `SCALAR_18 / 2` | 50% cap on the keeper share of trade and vault fill fees |
| `MAX_FEE_RATE` | `SCALAR_18 / 100` | 1% cap on trade fee rates and the vault fill fee |
| `MAX_MARGIN` | `SCALAR_18 / 2` | 50% max initial margin (2x min leverage) |
| `MIN_MARGIN` | `SCALAR_18 / 1000` | 0.1% min initial margin (1000x max leverage) |
| `MAX_LIQ_FEE` | `SCALAR_18 / 4` | 25% cap on the liquidation fee |
| `MIN_IMPACT` | `10 * SCALAR_18` | Impact divisor floor |
| `MAX_UTIL` | `10 * SCALAR_18` | Utilization cap ceiling |
| `MAX_BORROW_RATE` / `MAX_FUNDING_RATE` | `10 * SCALAR_18 / SECONDS_PER_YEAR` | ~1000% APR ceiling per second |
| `DELIST_GRACE` | `86_400` (1 day) | Window in which a delist is revertible |
| `DELIST_DEADLINE` | `7 * 86_400` (7 days) | After this, any remaining position can be force-closed regardless of margin health (at the stored terminal price once one is set) |
| `MIN_NOTIONAL_LOCK` / `MAX_NOTIONAL_LOCK` | `15` / `86_400` s | Bounds on the decrease lock |
| `MAX_REDEEM_LOCK` | `2_592_000` s (30 days) | Max redeem cooldown |
| `MIN_ADL_TRIGGER` | `45 * SCALAR_18 / 100` | 45% floor on the ADL trigger ratio |
| `MIN_ADL_CLEAR` | `40 * SCALAR_18 / 100` | 40% floor on the ADL clear target |
| `MIN_DEPOSIT_DIVISOR` | `100` | `min_deposit` may not exceed `max_vault_balance / 100` |

The treasury rate is bounded separately: trading reads it live through `get_rate`, and the treasury contract itself holds the rate to at most 50%.

Every concrete fee rate, margin, lock, cap, and threshold is a `Config` field set per market through the owner-gated `set_config`, not a protocol constant. The [Config field table](./storage.md#config-fields) lists them all.
