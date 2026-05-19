---
sidebar_position: 10
title: Keeper Execution
---

# Keeper Execution

The keeper system enables permissionless execution of limit order fills, stop-loss/take-profit triggers, and liquidations. Any address can call the `execute` function and earn fees for performing these actions.

## Batch Processing

`execute(caller: Address, market_id: u32, users: Vec<Address>, ids: Vec<u32>, price: Bytes)`

The `execute` function processes a batch of positions for a single market in one transaction. The price payload is verified once via `verify_price` (single feed) on the price-verifier, and a `Context` is loaded for the specified `market_id`, which accrues borrowing and funding indices to the current timestamp. The contract must not be `Frozen`.

`users` and `ids` are **parallel vectors**: position `i` in the batch is `Position(users[i], ids[i])`. Both vectors must have the same length. The two-vector shape is required because a single `id` is not unique across users, so the keeper must explicitly state the owner of each position.

All positions in the batch must belong to the same `market_id`. If any position fails its action (not actionable, too new, wrong market), the entire batch aborts with a hard panic. There is no partial success: either all positions are processed or none are.

### Context

The `Context` bundles the verified price (single feed), price scalar, market config and data, global trading config, vault balance, token/vault/treasury addresses, and total notional. It is loaded once at the start of the batch and auto-accrues indices on construction. After all positions are processed, mutated state is written back via `ctx.store()`.

## Auto-Detection

The `execute` function auto-detects the action for each position based on its state:

- **Not filled** (pending limit order) → attempt fill. For longs, fills when `price <= entry_price`; for shorts, fills when `price >= entry_price`. If the fill condition is not met, panics with `NotActionable`.
- **Filled** (active position) → checks in priority order:
  1. **Liquidation**: equity < liquidation threshold (`notional * liq_fee`). Bypasses `MIN_OPEN_TIME`.
  2. **Stop-loss**: trigger price hit. Requires `MIN_OPEN_TIME`.
  3. **Take-profit**: trigger price hit. Requires `MIN_OPEN_TIME`.
  4. If none apply, panics with `NotActionable`.

This simplifies keeper logic: keepers only need to submit the parallel `users` / `ids` vectors and price data for a single market.

## Error Handling

All errors are hard panics that abort the entire batch. There is no soft error or per-position result vector.

| Error | Code | Meaning |
|---|---|---|
| `NotActionable` | `731` | No valid action for this position (limit not fillable, not liquidatable, no SL/TP triggered) |
| `PositionTooNew` | `732` | `MIN_OPEN_TIME` (30s) not elapsed; SL/TP cannot fire yet |
| `PositionNotPending` | `721` | Position is already filled but was expected to be pending |
| `InvalidPrice` | `710` | Position's `market_id` does not match the batch's `market_id`, or price feed mismatch |
| `ContractFrozen` | `742` | Contract is in Frozen state, all operations blocked |
| `StalePrice` | `711` | Liquidation price predates position open time |

## Settlement Ordering

The batch aggregates all transfers into a map (`Address -> i128`). Settlement follows a specific order:

1. **Vault pays first**: if the vault's net transfer is negative (vault owes money), `strategy_withdraw` is called to bring tokens into the trading contract.
2. **Outbound transfers**: all positive transfers to non-vault addresses (keeper fees, user payouts, treasury fees) are paid.
3. **Vault receives last**: if the vault's net transfer is positive (vault gains), tokens are transferred to the vault.

This ordering prevents balance shortfalls within the trading contract during batch settlement.

## Keeper Fee

Keepers earn a percentage of trading fees (base + impact) on each successful action:

$$
\text{caller\_fee} = \text{trading\_fee} \times \frac{\text{caller\_rate}}{\text{SCALAR\_7}}
$$

Where `trading_fee = base_fee + impact_fee`. The caller fee is deducted from the vault's share, not from the user. On liquidation, `caller_fee = min(trading_fee + liq_fee, col) * caller_rate / SCALAR_7`.

## No Authentication Required

The `execute` function does not require the caller to authenticate. Any address can submit keeper requests and receive the `caller_rate` percentage of fees. This is an intentional design choice that creates a competitive, permissionless keeper network where anyone can participate.

The `caller` address parameter determines who receives the keeper fee. The caller does not need to be related to the position owner.
