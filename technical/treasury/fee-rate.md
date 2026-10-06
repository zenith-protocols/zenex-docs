---
title: Fee rate and withdrawal
description: Treasury construction, protocol fee rates, authorized withdrawals, events, and storage.
sidebar_position: 2
---

# Fee rate and withdrawal

This page covers the constructor and the three trait entries of the treasury, `get_rate`, `set_rate`, and `withdraw`. The treasury holds one number, the protocol fee rate, and a balance in every token that reaches its address. The market reads the rate at each settlement and pays the treasury cut by a plain token transfer.

`TreasuryContract` implements the `Treasury` trait, and the crate generates a `TreasuryClient` from it. `__constructor` sits outside that trait, so the client carries no method for it.

Units follow [Units and scales](../units.md). A rate is an `i128` `SCALAR_18` fraction, so `1e17` is 10%. A withdrawal `amount` is token-dec, in the decimals of the token named in the same call.

## The constructor stores the owner and the rate

```rust
pub fn __constructor(e: Env, owner: Address, rate: i128)
```

`owner` is the address that every `#[only_owner]` entry checks from then on. `rate` is the initial protocol fee rate. The constructor checks `rate` against the [range below](#rate-validity) and traps with `InvalidRate` (900) when it lies outside. It then stores `owner` and writes `rate` under the instance key `Rate`. The runtime calls it once, at deploy, with the arguments the deployer supplies.

## The rate stays between 0% and 50% {#rate-validity}

`__constructor` and `set_rate` run the same inline check before either writes `Rate`.

```rust
(0..=SCALAR_18 / 2).contains(&rate)
```

`SCALAR_18 / 2` is `500_000_000_000_000_000`, which is 50%. Both ends are inclusive. A rate outside the range traps with `InvalidRate` (900), and the call writes and publishes nothing. The bound holds each treasury cut at or below half of the fee it splits.

## `get_rate` is open to every caller

```rust
fn get_rate(e: Env) -> i128
```

Permissionless. Any account or contract may call it. It extends the instance time to live (TTL), then returns the stored `Rate`, a `SCALAR_18` fraction inside `[0, SCALAR_18 / 2]` on a deployed treasury. An unset `Rate` key reads as `0`, so the call raises no error code. It publishes no event. The market calls `get_rate` once per settlement. [Fees and settlement](../market/fee-system.md) gives the legs the rate splits. [Constructor and dependencies](../market/dependencies.md) lists the market entries that make the call.

## `set_rate` replaces the rate at once

```rust
fn set_rate(e: Env, rate: i128)
```

Owner only. The `#[only_owner]` guard runs before the body. A call that the owner did not sign fails host authorization. After `renounce_ownership`, the call traps with `OwnerNotSet` (2100). The body then extends the instance TTL and runs the range check. If the check passes, it writes `Rate` and publishes `rate_update`. A rejected rate traps with `InvalidRate` (900) and publishes nothing.

The new value is visible to every later call, the next `get_rate` included. The treasury holds no delay of its own. When the owner is the timelock, the call reaches `set_rate` through `execute`, and the [timelock](../governance/timelock.md) page gives that path.

## `withdraw` moves any token to any recipient

```rust
fn withdraw(e: Env, token: Address, to: Address, amount: i128)
```

Owner only, behind the same `#[only_owner]` guard, with the same extension of the instance TTL. `token` is any token contract address. `to` is any recipient address. `amount` is token-dec, in the decimals of `token`.

The body calls `transfer` on `token` with the treasury contract address as the sender, and `amount` reaches that call unchanged. The token contract holds the balance. Its `transfer` decides whether a zero or a negative `amount` passes, and it traps when `amount` exceeds the treasury's balance. A trap reverts the whole call. After the transfer succeeds, the body publishes `withdraw`. The TTL extension is the only storage the treasury writes on this path.

## Storage and TTL

| Key | Class | Type | Written by | Read by |
| --- | --- | --- | --- | --- |
| `Rate` | instance | `i128`, `SCALAR_18` fraction | `__constructor`, `set_rate` | `get_rate` |

`Rate` is a bare `Symbol` key and not a variant of a key enum. It is the only key the treasury defines. The stellar-access module adds `OwnableStorageKey::Owner`, an instance entry that shares the TTL below, and `OwnableStorageKey::PendingOwner`, a temporary entry. [Market storage](../market/storage.md#ledger-keys) describes both. The treasury's holdings are the token contracts' balances for the treasury address.

`extend_instance` calls `extend_ttl` on instance storage with `LEDGER_THRESHOLD_INSTANCE` and `LEDGER_BUMP_INSTANCE`. `LEDGER_THRESHOLD_INSTANCE` is 30 times `ONE_DAY_LEDGERS`. `LEDGER_BUMP_INSTANCE` is `LEDGER_THRESHOLD_INSTANCE` plus one `ONE_DAY_LEDGERS`.

| Constant | Value | Unit | Meaning |
| --- | --- | --- | --- |
| `ONE_DAY_LEDGERS` | 17280 | ledgers | One day at about 5 seconds per ledger. |
| `LEDGER_THRESHOLD_INSTANCE` | 518400 | ledgers | About 30 days. The remaining TTL below which the entry extends. |
| `LEDGER_BUMP_INSTANCE` | 535680 | ledgers | About 31 days. The TTL after the extension. |

`extend_instance` runs in `get_rate`, `set_rate`, and `withdraw`. `__constructor` leaves it out, so the first extension happens on the first call to one of those three entries. A call that traps extends nothing, because a trap reverts every effect of the invocation. The market reads the rate at every settlement, so market activity alone keeps the instance and the `Rate` entry alive.

## The owner controls the rate and the balance {#ownership}

The treasury implements `Ownable` from stellar-access and exposes `get_owner`, `transfer_ownership`, `accept_ownership`, and `renounce_ownership`. The same `Ownable` surface is on every contract that carries it. [Constructor and dependencies](../market/dependencies.md#ownership-and-upgrade) gives the signatures and the transfer rule. [Ownable codes](../market/errors.md#ownable-codes) lists the error codes. The treasury's code is fixed at deploy, and no entry replaces it. `set_rate` and `withdraw` are the two entries that carry `#[only_owner]`.

**`renounce_ownership` is final on this contract.** After it, `set_rate` and `withdraw` trap with `OwnerNotSet` (2100) for the life of the contract. The rate freezes at its last value, and `get_rate` keeps serving it. Every token balance the contract holds stays on the contract.

## Errors

| Error | Code | Condition |
| --- | --- | --- |
| `InvalidRate` | 900 | `rate` is outside `[0, SCALAR_18 / 2]` in `__constructor` or `set_rate`. |
| `OwnerNotSet` | 2100 | `set_rate` or `withdraw` runs after `renounce_ownership`. |
| `OwnerAlreadySet` | 2102 | Constructor writes an owner when the key already exists. A fresh deployment cannot meet this condition. |

`OwnerNotSet` comes from stellar-access, and [Ownable codes](../market/errors.md#ownable-codes) gives the full code table for that module. A call that the owner did not sign fails host authorization and carries no contract error code. A `withdraw` that the token contract rejects carries that contract's error.

## Events

Every treasury event follows the layout rule of [Events](../market/events.md). The first topic is the event name symbol, the struct name in lower snake case. Fields marked as topics follow it, and every other field sits in the data map under its own name.

| Event | Topics after the name | Data map | Published by |
| --- | --- | --- | --- |
| `rate_update` (`RateUpdate`) | none | `rate` (`i128`, `SCALAR_18` fraction) | `set_rate`, after the write |
| `withdraw` (`Withdraw`) | `token`, `to` | `amount` (`i128`, token-dec) | `withdraw`, after the transfer |

A rejected rate publishes no `rate_update`. A failed transfer publishes no `withdraw`. The token contract publishes its own transfer event during `withdraw`, so that event comes before `withdraw` in the transaction. `get_rate` publishes nothing.

The contract also carries the three stellar-access events, `ownership_transfer`, `ownership_transfer_completed`, and `ownership_renounced`. [Ownership events](../market/events.md#ownership-events) gives their payloads.

## Invariants

- `Rate` exists on a deployed treasury and sits inside `[0, SCALAR_18 / 2]`. `__constructor` writes it at deploy, and `set_rate` is the only entry that changes it. Both run the same range check.
- The stored rate changes in the same transaction as `set_rate`, and each successful call publishes exactly one `rate_update` with the new value. The market reads the rate at settlement, so a change first reaches a position at the next settlement.
- The treasury's balance grows when another party transfers tokens to its address. The market transfers at settlement only when the cut it computed from `get_rate` is above zero.
- `withdraw` is the only path out of the contract. It moves any token, in any amount, to any recipient, under the owner's signature and the token contract's checks.
