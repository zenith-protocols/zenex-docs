---
sidebar_position: 12
title: Trading Admin (Timelock)
---

# Trading Admin (Timelock)

The `TradingAdminContract` is a timelock proxy that sits between the governance owner and the trading contract. It is an independent contract that can optionally be set as the owner of a trading contract, providing a mandatory delay for parameter changes while allowing immediate emergency actions. The admin contract is not deployed by the factory.

## Architecture

```text
Owner --> TradingAdminContract --> TradingContract
           (timelock delay)        (set_config, set_market, set_status)
```

The trading contract's OZ Ownable owner is set to the admin contract's address. The admin contract's own owner is the actual governance address.

## Timelocked Operations

### Config Updates

The owner queues a config update by calling `queue_set_config(config: TradingConfig)`, which stores the pending config with `unlock_time = now + delay`. Only one config update can be queued at a time; a new queue call overwrites the previous one. The owner can cancel a pending update via `cancel_set_config()`.

Execution is permissionless: anyone can call `set_config()` after the delay has passed. This forwards the queued config to `TradingContract::set_config`.

### Market Updates

The owner queues a market update by calling `queue_set_market(feed_id, config: MarketConfig)`. Market updates use a per-queue nonce, so multiple markets can be queued simultaneously. The owner can cancel a specific queued update via `cancel_set_market(nonce)`.

Execution is permissionless: anyone can call `set_market(nonce)` after the delay has passed.

## Immediate Operations

### Status Changes

`set_status(status)` is owner-only with no timelock. It immediately forwards to `TradingContract::set_status`. This allows emergency pause (`Frozen` or `AdminOnIce`) without delay.

## Storage

| Type | Key | Content |
|---|---|---|
| Instance | Admin config | Owner, trading address, delay |
| Instance | `MarketNonce` | Incrementing nonce for market queue |
| Temporary | `ConfigUpdate` | Pending `TradingConfig` + unlock time |
| Temporary | `MarketUpdate(nonce)` | Pending `(feed_id, MarketConfig)` + unlock time |

Queued updates use Soroban temporary storage (100-day TTL). If the ledger TTL expires before execution, the update is silently pruned. There is no event or notification on expiry.

## Design Rationale

The timelock for parameter changes gives users time to react to adverse config changes (such as fee increases or leverage limit changes) before they take effect. Immediate status changes allow the admin to respond to emergencies without delay. Permissionless execution means anyone can apply a queued change after the delay, so the admin does not need to submit a second transaction. The per-nonce market queue allows multiple market updates to be queued and executed independently, without one blocking another.

## Access Control

| Function | Auth |
|---|---|
| `queue_set_config` | Owner only |
| `cancel_set_config` | Owner only |
| `set_config` | Permissionless (after delay) |
| `queue_set_market` | Owner only |
| `cancel_set_market` | Owner only |
| `set_market` | Permissionless (after delay) |
| `set_status` | Owner only (immediate) |

The admin contract implements OZ Ownable and Upgradeable (owner-only upgrade).
