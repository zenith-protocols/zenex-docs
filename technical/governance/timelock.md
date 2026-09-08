---
title: Timelock
sidebar_position: 2
---

# Timelock

The governance contract is a timelock. The owner queues a call to another contract, and the entry unlocks after a delay. Any account can then execute it. The owner can cancel the entry until it runs. One owner entry, `set_status`, reaches its target with no wait.

This page holds the queue entries, the storage keys, the error codes, and the events. The delay value changes through the two calls on [Delay changes](./delay.md). The owner key surface is on [Ownership and upgrade](../ownership.md).

Every time value on this page is a unix timestamp in seconds. Every delay is a count of seconds. Every time-to-live is a count of ledgers. Every nonce is a dimensionless `u32` counter.

## Constructor

```rust
pub fn __constructor(e: Env, owner: Address, delay: u64)
```

`owner` becomes the `Ownable` owner. It is the only account that can queue a call, cancel one, queue a delay change, or forward a status. `delay` is the first value written under `GovKey::Delay`, in seconds. It sets the wait for every queue entry until `apply_delay` writes a new value. It must be in the range `(0, 5_184_000]`, which is 1 second to 60 days.

The call checks the range first. It then sets the owner through `set_owner`, writes `GovKey::Delay`, and extends the instance time-to-live. It publishes no event. The [Ownership and upgrade page](../ownership.md) covers `set_owner` and the errors it can raise.

| Error | Code | Condition |
| --- | --- | --- |
| `InvalidDelay` | 812 | `delay` is `0`, or `delay` is above `5_184_000` seconds. |
| `OwnerAlreadySet` | 2102 | `set_owner` finds an owner key. A constructor on a fresh instance never meets it. |

## Queue a call

```rust
fn queue(e: Env, target: Address, fn_name: Symbol, args: Vec<Val>) -> u32
```

Owner only. The owner must authorize the call, and `#[only_owner]` enforces it. The call stores one `QueuedCall` and returns its nonce.

The contract stores `target`, `fn_name`, and `args` as it receives them. It checks none of the three. It does not check that a contract lives at `target`, that the contract has a function named `fn_name`, or that `args` matches that function. When `execute` forwards the call, a mismatch traps.

`queue` computes `unlock_time = ledger_timestamp + delay`. `unlock_time` is the `u64` unix timestamp in seconds that the entry stores. `ledger_timestamp` is the unix timestamp in seconds of the ledger that includes the call. `delay` is the `u64` value under `GovKey::Delay`, in seconds. Both terms are `u64`, and the contract adds them as integers. The entry keeps that `unlock_time` for its whole life.

The nonce comes from `next_nonce`. It reads `GovKey::Nonce`, treats an absent key as `0`, writes the value plus one, and returns the value it read. The first nonce a contract ever issues is `0`. Each `queue` call takes the next one. `cancel` and `execute` do not return a nonce to the counter.

The same target, function, and argument list can be queued more than once. Each call gets its own nonce and its own entry, and the entries are independent.

The call reads `GovKey::Delay`, reads and writes `GovKey::Nonce`, and writes `GovKey::Queued(nonce)`. It publishes `queued`. If the owner key is absent, the owner check traps with `OwnerNotSet` (2100).

## Cancel a queued call

```rust
fn cancel(e: Env, nonce: u32)
```

Owner only. The owner must authorize the call, and `#[only_owner]` enforces it. The call reads the entry under `nonce`, removes it, and publishes `cancelled`. If no entry exists under `nonce`, the call traps with `NotQueued` (810). That covers a nonce that was never issued, one that already executed, and one that was already cancelled. If the owner key is absent, the owner check traps with `OwnerNotSet` (2100).

Cancel works at any point before execution. The unlock time does not close the window, so the owner can still cancel an entry that is unlocked.

## Execute a queued call

```rust
fn execute(e: Env, nonce: u32)
```

Permissionless. `execute` calls no `require_auth`, so the submitter needs no relationship with the owner. The submitter pays the transaction fee and earns no reward.

If no entry exists under `nonce`, the call traps with `NotQueued` (810). The call then compares two `u64` unix timestamps in seconds. `unlock_time` is the field on the entry. `ledger_timestamp` is the timestamp of the ledger that includes the call. If `unlock_time > ledger_timestamp`, the call traps with `NotUnlocked` (811). Equality unlocks, so the entry becomes executable on the first ledger whose timestamp reaches `unlock_time`. It stays queued until an account submits `execute`.

The call removes `GovKey::Queued(nonce)`, then invokes `fn_name` on `target` with the stored `args`. It reads the return value as `Val` and discards it. It publishes `executed` after the forwarded call returns, so the target's own events come first in the transaction.

The forwarded call carries the governance contract address as the invoker. An owner-gated entry on the target accepts it when the governance contract is that target's owner.

An error from the target propagates and reverts the whole transaction. The removal of the entry reverts with it. A failed execution therefore leaves the entry queued and executable later.

Entries execute in any order. The contract enforces no order between nonces, and an entry queued later can execute first.

## Forward a status at once

```rust
fn set_status(e: Env, target: Address, status: u32)
```

Owner only. The owner must authorize the call, and `#[only_owner]` enforces it. The call forwards exactly one function name, `set_status`, with exactly one argument, `status`, to `target`. It consumes no nonce, writes no queue entry, and waits for no delay.

`status` is a `u32` discriminant of the market `Status` enum. This contract passes it through without a check, and the target validates it. The [Market status page](../market/status.md) gives the values and what each one permits.

The `set_status` entry on the target is owner gated. The target accepts the forwarded call when the governance contract is that target's owner. If the owner key of the governance contract is absent, the owner check traps with `OwnerNotSet` (2100). An error from the target propagates and reverts the transaction. It publishes `status_set` after the forwarded call returns.

## Read a queued call

```rust
fn get_queued(e: Env, nonce: u32) -> QueuedCall
```

Permissionless. It returns the whole record under `nonce`, and traps with `NotQueued` (810) when no entry exists. The read extends the time-to-live of the persistent entry, so an on-chain call writes state. A simulation of the call commits nothing.

## The queued call record

`QueuedCall` is the stored form of one entry. `get_queued` returns it.

| Field | Type | Meaning |
| --- | --- | --- |
| `target` | `Address` | The contract that `execute` invokes. |
| `fn_name` | `Symbol` | The function name on `target`. |
| `args` | `Vec<Val>` | The argument list, forwarded verbatim. |
| `unlock_time` | `u64`, unix seconds | The first timestamp at which `execute` succeeds. |

## Storage

The contract owns four `GovKey` variants. The `Ownable` mixin owns two more keys, `OwnableStorageKey::Owner` on the instance and `OwnableStorageKey::PendingOwner` in temporary storage, both covered by [Ownership and upgrade](../ownership.md).

| Key | Value | Class | Written by | Read by |
| --- | --- | --- | --- | --- |
| `GovKey::Delay` | `u64`, seconds | instance | `__constructor`, `apply_delay` | `queue`, `set_delay`, `apply_delay`, `get_delay` |
| `GovKey::Nonce` | `u32`, the next nonce | instance | `queue` | `queue` |
| `GovKey::Queued(u32)` | `QueuedCall` | persistent | `queue`, and `cancel` and `execute` remove it | `cancel`, `execute`, `get_queued` |
| `GovKey::PendingDelay` | `PendingDelay` | persistent | `set_delay`, and `apply_delay` removes it | `apply_delay` |

`PendingDelay` and the two calls that touch it belong to [Delay changes](./delay.md). A removal of an absent entry is not an error.

### Time-to-live

A ledger lasts about 5 seconds. A threshold is the remaining time-to-live below which an access extends an entry. A bump is the time-to-live that the access extends the entry to.

| Constant | Ledgers | Time |
| --- | --- | --- |
| `ONE_DAY_LEDGERS` | 17_280 | 1 day |
| `LEDGER_THRESHOLD_INSTANCE` | 1_036_800 | 60 days |
| `LEDGER_BUMP_INSTANCE` | 1_054_080 | 61 days |
| `LEDGER_THRESHOLD_QUEUED` | 1_728_000 | 100 days |
| `LEDGER_BUMP_QUEUED` | 2_073_600 | 120 days |

`extend_instance` applies `LEDGER_THRESHOLD_INSTANCE` and `LEDGER_BUMP_INSTANCE`. It opens the body of `queue`, `cancel`, `execute`, `set_status`, `set_delay`, and `apply_delay`, and it closes `__constructor`. On the four owner-gated entries the injected owner check runs before it. The host tests the threshold and extends the contract code entry apart from the instance entry. One entry can be extended while the other is not. `get_delay` and `get_queued` leave the instance time-to-live as it is.

`LEDGER_THRESHOLD_QUEUED` and `LEDGER_BUMP_QUEUED` govern the two persistent keys, `GovKey::Queued(u32)` and `GovKey::PendingDelay`. A read or a write of one of those keys extends that key when its remaining time-to-live is below the 100-day threshold. A removal extends nothing. The 120-day bump outlives the 60-day delay ceiling. An entry written at queue time survives the longest wait the contract permits, with no further traffic. An entry whose time-to-live still lapses is archived rather than deleted, and a restore brings it back.

## Errors

`GovernanceError` is the contract error enum. Governance owns the 8xx range. The table is the complete set of codes and the calls that raise each one.

| Error | Code | Condition |
| --- | --- | --- |
| `Unauthorized` | 1 | Declared to match the shared access-control numbering. No path in the contract raises it. |
| `NotQueued` | 810 | `cancel`, `execute`, and `get_queued` find no entry under `nonce`. `apply_delay` finds no pending delay change. |
| `NotUnlocked` | 811 | `execute` runs before `unlock_time`. `apply_delay` runs before the unlock time of the pending change. |
| `InvalidDelay` | 812 | `__constructor` or `set_delay` receives a delay of `0`, or one above `5_184_000` seconds. |

A call to an owner-only entry from another account fails host authorization. The owner check raises no code from `GovernanceError`. After a renounce, the same entries trap with `OwnerNotSet` (2100). The [Ownership and upgrade page](../ownership.md) gives the `OwnableError` and `RoleTransferError` codes and their conditions.

An error raised by the target of `execute` or `set_status` propagates unchanged and reverts the transaction.

## Events

Every event derives `contractevent` from soroban-sdk 26.1.1. The first topic is the event name, which is the struct name in lower snake case. Each `#[topic]` field follows in declaration order, and every other field sits in the data map under its own field name.

| Event | Topics after the name | Data | Published by |
| --- | --- | --- | --- |
| `queued` | `nonce: u32` | `target: Address`, `fn_name: Symbol`, `unlock_time: u64` in unix seconds | `queue` |
| `executed` | `nonce: u32` | `target: Address`, `fn_name: Symbol` | `execute`, after the forwarded call returns |
| `cancelled` | `nonce: u32` | an empty map, because the struct carries no data field | `cancel` |
| `status_set` | `target: Address` | `status: u32`, a market `Status` discriminant | `set_status`, after the forwarded call returns |

`set_delay` publishes a second form of `queued` for a delay change, and `apply_delay` publishes `delay_set`. Both forms are on [Delay changes](./delay.md).

## Invariants

A nonce is consumed once. `queue` issues it, and no later call reissues it. After `cancel` or `execute` on nonce `n`, every read of `n` traps with `NotQueued` for the life of the contract.

An entry freezes its `unlock_time` when `queue` writes it. A later delay change moves no entry that is already in the queue. It governs only the entries that `queue` writes after it.

`execute` needs no signature. Once an entry unlocks, any account can submit it, and the owner cannot stop it except by a `cancel` that lands first.

`set_status` is the only owner action that reaches a target with no wait, and it can carry only one function name and one `u32` argument.

## Ownership

The contract mixes in `Ownable` from stellar-access 0.7.2 and exposes `get_owner`, `transfer_ownership`, `accept_ownership`, and `renounce_ownership`. Four entries carry `#[only_owner]`: `queue`, `cancel`, `set_status`, and `set_delay`.

`renounce_ownership` removes the owner key, and nothing restores it. The four owner-only entries then trap with `OwnerNotSet` (2100) on every call, and so do `transfer_ownership` and `renounce_ownership`. A renounce traps while a live pending transfer exists, so no pending entry survives it. `accept_ownership` then traps with `NoPendingTransfer` (2200). `get_owner` keeps working and returns `None`. `execute`, `apply_delay`, `get_delay`, and `get_queued` keep working, so an entry queued before the renounce still executes at its unlock time. The [Ownership and upgrade page](../ownership.md) gives the signatures, the transfer window, the error codes, and the events.
