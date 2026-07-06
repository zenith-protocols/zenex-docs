---
sidebar_position: 1
title: Trading Contract
---

# Trading Contract

The trading contract is the core perpetual futures engine. It manages orders, netted position lifecycle, PnL settlement, fee distribution, funding and borrowing accrual, liquidation, and auto-deleveraging.

## Single Market Per Contract

One trading contract serves exactly one market. There is no market identifier in the interface: the market is defined by the contract's immutable `(feed_id, exponent)` oracle anchors, set once in the constructor. The factory deploys one isolated trading + vault pair per market, so running several markets means deploying several independent pairs. This isolates each market's risk, storage, and configuration.

The contract is **immutable**: there is no upgrade entry point. A logic change ships as a fresh trading + vault pair through the factory. Existing pairs keep running the code they were deployed with.

## The Order then Keeper-Execute Flow

Traders never fill their own positions. The flow is two-sided:

1. A trader calls `create_order` (or `create_vault_order`) with a **price-free** intent, authorized by their own signature. Collateral for an increase is drawn later from the trader's token allowance; a vault order escrows its assets or shares immediately.
2. A permissionless **keeper** calls `execute_order` (or a sibling keeper entry point), passing a serialized Pyth Lazer price update. The contract verifies the price against its feed, checks the order's trigger and slippage bound against that price, and settles the fill.

The keeper is not authenticated. It is simply the reward recipient named by the caller. The trader's consent lives in the collateral allowance they set at order creation, and in the trigger and slippage bounds baked into the order. A "market order" is just an order with no trigger, fillable immediately; a limit or stop is an order carrying a trigger.

## Public Interface

### Admin Actions (owner only)

All admin actions require the contract owner (`#[only_owner]`).

| Function | Description |
|---|---|
| `set_config` | Replace the global `Config`. A borrowing-parameter change requires a same-ledger `accrue`, else `BorrowingNotAccrued` (703). |
| `set_status` | Set operational status per the [status lifecycle](#operational-status). Entering `Retired` sweeps the funding-pool surplus to the vault. |
| `set_terminal_price` | Set or refresh the flat settlement price of a delisted market, after its grace window expires. |

The Ownable surface (`transfer_ownership` as a two-step, `accept_ownership`, `renounce_ownership`, `get_owner`) is also owner-gated. There is no `upgrade`.

### Trader Actions (auth = the user's own signature, price-free)

| Function | Description |
|---|---|
| `create_order` | Create an order (Increase or Decrease) for the keeper to fill. Returns the order id. |
| `cancel_order` | Cancel a pending order the caller owns. |
| `create_vault_order` | Create a deposit or redeem vault order, escrowing assets or shares. Returns the order id. |
| `cancel_vault_order` | Cancel a pending vault order and refund the escrow. Returns the refunded amount. |
| `claim_funding` | Pay out the caller's accrued claimable funding balance from the pool. |

### Keeper Actions (permissionless, price-bearing)

Anyone may call these, passing a serialized Pyth Lazer price. The named `keeper` is the reward recipient.

| Function | Description |
|---|---|
| `execute_order` | Fill a pending order (increase or decrease) at the verified price and settle it. |
| `execute_liquidation` | Force-close a position `(user, is_long)` that has fallen below maintenance margin (or any position past a delisted market's deadline). |
| `execute_vault_order` | Fill up to `amount` of a pending vault order at the verified price. |
| `update_adl_state` | Recompute both sides' pending PnL and set or clear the per-side ADL flags. |
| `execute_adl` | Deleverage a winning position on a flagged side. |
| `accrue` | Advance both accrual indices (borrowing and funding) to now at a verified price. |

Each keeper entry point pays the caller the `keeper_rate` cut of the relevant fee (the trade fee, or the vault fill fee). See [Keeper Execution](./keeper-execution.md).

### Maintenance (permissionless, price-free)

| Function | Description |
|---|---|
| `accrue_funding` | Advance the funding index to now. Funding accrual needs no price. |

### Read-Only

| Function | Description |
|---|---|
| `get_config` | Current global `Config` |
| `get_market_data` | `MarketData` as of its last accrual |
| `get_position` | Netted `Position` for `(user, is_long)`; zeroed if none open |
| `get_order` | `Order` row for `(user, id)` |
| `get_vault_order` | `VaultOrder` row for `(user, id)` |
| `get_status` | Operational status discriminant |
| `get_adl` | `AdlState` (per-side flags) |
| `get_claimable_funding` | Funding owed to a user |
| `get_token` / `get_vault` / `get_treasury` / `get_price_verifier` | Wired dependency addresses |
| `get_retirement` | `None` until first delist, else `(terminal_price, delisted_at)` |
| `get_feed` | The immutable `(feed_id, exponent)` pair |

## Netted Positions

Positions are **netted, one per `(user, is_long)`**. A user holds at most one long and one short position in a market. There are no per-user position id counters and no position ids. An Increase order grows the netted position on its side; a Decrease shrinks it. A position is stored under the `(user, is_long)` key, and a fully closed position is a zeroed row (zero notional), which is the canonical closed state. See [Position Lifecycle](./position-lifecycle.md).

Orders and vault orders, by contrast, do carry ids allocated per user, so a trader can have several resting orders at once.

## Operational Status

The market runs through a five-state lifecycle. The full transition matrix and wind-down mechanics are on [Storage & Events](./storage-and-events.md#status-lifecycle); the short version:

```text
Active   (0) : normal trading; the only status that accepts opens
OnIce    (1) : opens blocked; closes, decreases, vault orders, claims, accrual keep running
Frozen   (2) : emergency halt; every price-bearing and fund-moving path blocked
Delisted (3) : wind-down; opens blocked, a terminal price can eventually be set
Retired  (4) : final; only claims, direct vault redeems, and cancels remain
```

Only `Active` accepts opens (size-growing increases). `Frozen` blocks `create_order`, `create_vault_order`, `cancel_vault_order`, `claim_funding`, and every keeper fill with `MarketFrozen` (704). Entering `Retired` requires an empty book and sweeps the funding-pool surplus to the vault.

## Constants and Scales

All rates, ratios, fees, and margins are stored as `SCALAR_18` (`10^18`) fixed-point fractions. Rate parameters (borrowing, funding) are expressed **per second**. Prices use the feed's own `price_scalar = 10^-exponent`. Token amounts (notional, collateral, payouts) are in the settlement token's decimals; base sizes (`tokens`) are in the feed's base decimals.

The protocol bounds enforced by config validation include:

| Constant | Value | Meaning |
|---|---|---|
| `MAX_KEEPER_RATE` | `SCALAR_18 / 2` | 50% cap on the keeper (and treasury) rate |
| `MAX_FEE_RATE` | `SCALAR_18 / 100` | 1% cap on trade fee rates |
| `MAX_MARGIN` | `SCALAR_18 / 2` | 50% max initial margin (2x min leverage) |
| `MIN_MARGIN` | `SCALAR_18 / 1000` | 0.1% min initial margin (1000x max leverage) |
| `MAX_LIQ_FEE` | `SCALAR_18 / 4` | 25% cap on the liquidation fee |
| `MIN_IMPACT` | `10 * SCALAR_18` | Impact divisor floor |
| `MAX_UTIL` | `10 * SCALAR_18` | Utilization cap ceiling |
| `MAX_BORROW_RATE` / `MAX_FUNDING_RATE` | `10 * SCALAR_18 / SECONDS_PER_YEAR` | ~1000% APR ceiling per second |
| `DELIST_GRACE` | `86_400` (1 day) | Window in which a delist is revertible |
| `DELIST_DEADLINE` | `7 * 86_400` (7 days) | After this, any remaining position can be force-closed at the terminal price |
| `MIN_NOTIONAL_LOCK` / `MAX_NOTIONAL_LOCK` | `15` / `86_400` s | Bounds on the decrease lock |

Every concrete fee rate, margin, lock, cap, and threshold is a `Config` field set per market by governance, not a protocol constant. The [Config field table](./storage-and-events.md#config-fields) lists them all.
