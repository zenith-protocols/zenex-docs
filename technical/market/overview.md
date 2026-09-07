---
sidebar_position: 1
title: Market Contract
---

# Market Contract

The market contract is the core perpetual futures engine. It manages orders, netted position lifecycle, PnL settlement, fee distribution, funding and borrowing accrual, liquidation, and auto-deleveraging.

## Single Market Per Contract

One market contract serves exactly one market, identified by the contract's immutable `feed_id` oracle anchor, set once in the constructor. The constructor also wires the four contracts a market depends on: the settlement token, its strategy vault, the oracle, and the treasury. The factory deploys one isolated market + vault pair per market, so running several markets means deploying several independent pairs. This isolates each market's risk, storage, and configuration.

The contract is **upgradeable by its owner**: `upgrade` replaces the WASM in place, preserving all storage, and requires the owner's signature (`#[only_owner]`, with a wrong `operator` raising the shared `UpgradeNotOwner` code, 600). The paired vault is deliberately not upgradeable — it is gated entirely by the market contract, so a vault defect is contained by freezing the market and winding it down rather than by replacing vault code under live collateral. See the [architecture overview](../index.md#upgradeability) for the full model.

## The Order then Keeper-Execute Flow

Every fill runs through a permissionless keeper entry point at a verified oracle price. The flow is two-sided:

1. A trader calls `create_order` (or `create_vault_order`) with a **price-free** intent, authorized by their own signature. An increase order escrows its margin plus the flat `exec_fee` from the trader at creation, and a decrease order escrows the `exec_fee` only. A vault order escrows its assets or shares plus the `exec_fee` immediately.
2. A permissionless **keeper** calls `execute_order` (or a sibling keeper entry point), passing a signed Chainlink Data Streams report. The contract verifies the report through the oracle against its anchored `feed_id`, checks the order's trigger and slippage bound against the returned price, and settles the fill.

The keeper is not authenticated. It is simply the reward recipient named by the caller. The trader's consent lives in the escrow they fund at order creation, and in the trigger and slippage bounds baked into the order. A market order is an order created with a market kind, fillable immediately. Limit and stop kinds carry a `trigger_price` and fill only once the execution price crosses it, in the direction implied by the kind and side.

## Public Interface

### Admin Actions (owner only)

All admin actions require the contract owner (`#[only_owner]`).

| Function | Description |
|---|---|
| `set_config` | Replace the global `Config`. A borrowing- or funding-parameter change requires a same-ledger `accrue`, else `MarketNotAccrued` (703). |
| `set_status` | Set operational status per the [status lifecycle](#operational-status). Entering `Retired` sweeps the funding-pool surplus to the vault. |
| `set_terminal_price` | Set or refresh the flat settlement price of a delisted market, after its grace window expires. |
| `upgrade` | Replace the contract WASM in place, preserving all storage. The `operator` argument must be the owner (`UpgradeNotOwner`, 600). |

The contract also exposes the OpenZeppelin two-step Ownable surface (`transfer_ownership`, `accept_ownership`, `renounce_ownership`, `get_owner`), whose behavior and error codes are the [OpenZeppelin `stellar-access`](https://github.com/OpenZeppelin/stellar-contracts/tree/main/contracts/access) library's, not this contract's. That is the full extent of privileged control. The paired vault has no owner at all: its code is fixed for the life of the pair, and only the market contract can mutate it.

### Trader Actions (auth = the user's own signature, price-free)

| Function | Description |
|---|---|
| `create_order` | Create an order of one of six kinds (market, limit, or stop, each as an increase or a decrease) for the keeper to fill. An increase escrows `margin + exec_fee`, a decrease escrows `exec_fee` only. Returns the order id. |
| `cancel_order` | Cancel a pending order the caller owns and refund its full escrow. |
| `create_vault_order` | Create a deposit or redeem vault order, escrowing assets or shares plus the flat `exec_fee`. Returns the order id. |
| `cancel_vault_order` | Cancel a pending vault order and refund the escrow (principal plus `exec_fee`). Returns the escrowed principal. |
| `claim_credit` | Pay out the caller's claimable credit (earned funding plus any parked failed payout), capped at the current credit-pool balance. Any remainder stays claimable. |

### Keeper Actions (permissionless, price-bearing)

Anyone may call these, passing a signed Chainlink Data Streams report. The named `keeper` is the reward recipient. Order and vault-order fills verify the report against the oracle's strict trade staleness window, and liquidation, ADL, and accrual against its wider protective window.

| Function | Description |
|---|---|
| `execute_order` | Fill a pending order (increase or decrease) at the verified price and settle it. |
| `execute_liquidation` | Force-close a position `(user, is_long)` that has fallen below maintenance margin (or any position past a delisted market's deadline). |
| `execute_vault_order` | Fill the whole pending vault order at the verified price and remove it. Vault orders fill in full or not at all. |
| `update_adl_state` | Recompute both sides' pending PnL and set or clear the per-side ADL flags. |
| `execute_adl` | Deleverage a winning position on a flagged side. |
| `accrue` | Advance both accrual indices (borrowing and funding) to now at a verified price. |

`execute_order` and `execute_vault_order` pay the caller the `keeper_rate` cut of the relevant fee plus the order's escrowed `exec_fee`. `execute_adl` pays the `keeper_rate` cut of the trade fee only, and `execute_liquidation` the cut of the trade fee plus the liquidation fee (neither carries an order, so no `exec_fee`). `update_adl_state` and `accrue` pay nothing. See [Keeper Execution](./keeper-execution.md).

### Read-Only

| Function | Description |
|---|---|
| `get_config` | Current global `Config` |
| `get_market_data` | `MarketData` as of its last accrual |
| `get_position` | Netted `Position` for `(user, is_long)`. A miss creates and persists the zeroed row |
| `get_order` | `Order` row for `(user, id)`, trapping `OrderNotFound` (730) when absent |
| `get_vault_order` | `VaultOrder` row for `(user, id)`, trapping `VaultOrderNotFound` (750) when absent |
| `get_status` | Operational status discriminant |
| `get_order_counter` | Next unallocated order id for a user, `1` when none exists yet |
| `get_adl` | `AdlState` (per-side flags) |
| `get_claimable_funding` | Funding owed to a user |
| `get_token` / `get_vault` / `get_treasury` / `get_oracle` | Wired dependency addresses |
| `get_retirement` | `None` until first delist, else `(terminal_price, delisted_at)` |
| `get_feed` | The immutable `feed_id` price stream id (`BytesN<32>`) |

## Netted Positions

Positions are **netted, one per `(user, is_long)`**. A user holds at most one long and one short position in a market. An Increase order grows the netted position on its side, and a Decrease shrinks it. A position is stored under the `Position(Address, bool)` key, `(user, is_long)`, and a fully closed position is a zeroed row (zero notional), which is the canonical closed state. See [Position Lifecycle](./position-lifecycle.md).

Orders and vault orders, by contrast, do carry ids allocated per user, so a trader can have several resting orders at once.

## Operational Status

The market runs through a five-state lifecycle. The full transition matrix and wind-down mechanics are on [Storage](./storage.md#status-lifecycle). Short version:

```text
Active   (0) : normal trading; the only status that accepts opens
OnIce    (1) : opens blocked; closes, decreases, vault orders, claims, accrual keep running
Frozen   (2) : emergency halt; trading, cancels, claims, and accrual all blocked
Delisted (3) : wind-down; opens blocked, a terminal price can eventually be set
Retired  (4) : final; only claims, direct vault redeems, and cancels remain
```

Only `Active` accepts opens (size-growing increases). `Frozen` blocks `create_order`, `cancel_order`, `create_vault_order`, `cancel_vault_order`, `claim_credit`, every keeper fill, and `accrue` with `MarketFrozen` (704). `create_order` also rejects `Retired`, while `cancel_order` and `cancel_vault_order` stay open in every status but `Frozen`, so a trader can recover a resting order's escrow through the wind-down. Entering `Retired` requires an empty book and sweeps the credit-pool surplus to the vault.

## Constants and Scales

All rates, ratios, fees, and margins are stored as `SCALAR_18` (`10^18`) fixed-point fractions. Rate parameters (borrowing, funding) are expressed **per second**. Prices carry the feed's own precision. Token amounts (notional, margin, payouts) are in the settlement token's decimals, while base sizes (`tokens`) use the derived base scale defined by `tokens = notional * SCALAR_18 / price`, so price precision cancels through the round trip.

The protocol constants that bound config validation, plus the fixed wind-down windows:

| Constant | Value | Meaning |
|---|---|---|
| `MAX_KEEPER_RATE` | `SCALAR_18 / 2` | 50% cap on the keeper share of trade and vault fill fees |
| `MAX_FEE_RATE` | `SCALAR_18 / 100` | 1% cap on trade fee rates and the vault fill fee |
| `MAX_MARGIN` | `SCALAR_18 / 2` | 50% max initial margin (2x min leverage) |
| `MIN_MARGIN` | `SCALAR_18 / 1000` | 0.1% min initial margin (1000x max leverage) |
| `MAX_LIQ_FEE` | `SCALAR_18 / 4` | 25% cap on the liquidation fee |
| `MAX_IMPACT_RATE` | `SCALAR_18 / 10` | Impact fee rate ceiling (10% of a fill's notional) |
| `MIN_CHUNK_IMPACT_CAP` | `SCALAR_18 / 1000` | 0.1% cap on the impact rate of a minimum-size fill, floor for `impact_scalar` and part of the born-liquidatable rail |
| `MAX_UTIL` | `10 * SCALAR_18` | Utilization cap ceiling |
| `MAX_BORROW_RATE` / `MAX_FUNDING_RATE` | `10 * SCALAR_18 / SECONDS_PER_YEAR` | ~1000% APR ceiling per second |
| `DELIST_GRACE` | `86_400` (1 day) | Window in which a delist is revertible |
| `DELIST_DEADLINE` | `7 * 86_400` (7 days) | After this, any remaining position can be force-closed regardless of margin health (at the stored terminal price once one is set) |
| `MIN_NOTIONAL_LOCK` / `MAX_NOTIONAL_LOCK` | `15` / `86_400` s | Bounds on the decrease lock |
| `MAX_REDEEM_LOCK` | `2_592_000` s (30 days) | Max redeem cooldown |
| `MIN_ADL_TRIGGER` | `45 * SCALAR_18 / 100` | 45% floor on the ADL trigger ratio |
| `MIN_ADL_CLEAR` | `40 * SCALAR_18 / 100` | 40% floor on the ADL clear target |
| `MIN_DEPOSIT_DIVISOR` | `100` | `min_deposit` may not exceed `max_vault_balance / 100` |

The treasury rate is bounded separately: the market contract reads it live through `get_rate`, while the treasury contract itself holds the rate to at most 50%.

Every concrete fee rate, margin, lock, cap, and threshold is a `Config` field set per market through the owner-gated `set_config`, not a protocol constant. The [Config page](./config.md) lists them all, with the validation rules they must satisfy.
