---
title: Timelock
sidebar_position: 2
---

# Timelock

The governance contract is a timelock. The owner queues a call to another contract, and the queued call unlocks after a delay. Any account can then execute it. The owner can cancel it until it runs. One owner function, `set_status`, reaches its target at once.

This page covers the queue functions, the storage keys, the error codes, the events, and the `Ownable` surface. The [Delay changes](./delay.md) page covers the two functions that change the delay value.

Every time value is a unix timestamp in seconds. Every delay is a count of seconds. Every time-to-live (TTL) is a count of ledgers. Every nonce is a dimensionless `u32` counter. The word entry means one stored `QueuedCall`.

## Constructor

```rust
pub fn __constructor(e: Env, owner: Address, delay: u64)
```

`owner` becomes the `Ownable` owner. It is the only account that can queue a call, cancel one, queue a delay change, or forward a status. `delay` is the first value under `GovKey::Delay`, in seconds. It sets the wait for every entry until `apply_delay` writes a new value. Its range is `(0, 5_184_000]`, which is 1 second to 60 days.

The gates run in this order:

1. The range check on `delay`. A value outside the range traps with `InvalidDelay` (812).
2. The `set_owner` call. An existing owner key traps with `OwnerAlreadySet` (2102). A constructor on a fresh instance never meets it.

The call then writes `GovKey::Delay` and extends the instance TTL. It publishes no event.

## Queue a call

```rust
fn queue(e: Env, target: Address, fn_name: Symbol, args: Vec<Val>) -> u32
```

Owner only. The `#[only_owner]` check runs first. It traps with `OwnerNotSet` (2100) when the owner key is absent. A call signed by any other account fails host authorization and carries no contract error code. The call stores one `QueuedCall` and returns its nonce.

`queue` stores `target`, `fn_name`, and `args` exactly as received. Validation happens when `execute` forwards the call. A `target` with no contract, a `fn_name` that the contract lacks, or `args` that do not match its signature trap at that point. The entry stays queued until then, and the delay is already spent. Only `cancel` removes it.

The unlock time comes from one addition.

```
unlock_time = ledger_timestamp + delay
```

- `unlock_time`: `u64`, unix seconds. The first timestamp at which `execute` succeeds. The entry keeps this value for its whole life.
- `ledger_timestamp`: `u64`, unix seconds. The timestamp of the ledger that includes the call.
- `delay`: `u64`, seconds. The value under `GovKey::Delay` when the call runs.

The addition is on integers, so no rounding applies. An entry unlocks exactly `delay` seconds after the ledger that queued it.

| `ledger_timestamp` | `delay` | `unlock_time` |
| --- | --- | --- |
| `1_788_000_000` | `1` | `1_788_000_001` |
| `1_788_000_000` | `172_800` (2 days) | `1_788_172_800` |
| `1_788_000_000` | `5_184_000` (60 days) | `1_793_184_000` |

The nonce comes from `next_nonce`. It reads `GovKey::Nonce`, treats an absent key as `0`, writes the value plus one, and returns the value it read. The first nonce is `0`, and each `queue` call takes the next one. `cancel` and `execute` return no nonce to the counter. The release profile has overflow checks on, so the call that would issue `4_294_967_295` traps with an arithmetic error. That value is the sentinel nonce that `set_delay` uses, so no queued call holds it.

The same target, function, and argument list can be queued more than once. Each call gets its own nonce and its own independent entry.

The call extends the instance TTL, reads `GovKey::Delay`, reads and writes `GovKey::Nonce`, and writes `GovKey::Queued(nonce)`. It publishes `queued`.

## Cancel a queued call

```rust
fn cancel(e: Env, nonce: u32)
```

Owner only. The gates run in this order:

1. The owner check. The owner key must exist (`OwnerNotSet` (2100)) and the owner must sign.
2. The entry lookup. If no entry exists under `nonce`, the call traps with `NotQueued` (810). That covers a nonce that was never issued, one that executed, and one that was cancelled.

The call then removes the entry and publishes `cancelled`. Cancel works at any point before execution. The unlock time does not close the window, so the owner can cancel an unlocked entry.

## Execute a queued call

```rust
fn execute(e: Env, nonce: u32)
```

Permissionless. Any account can submit it, and the submitter pays the transaction fee. The contract needs no relationship with the owner.

The gates run in this order:

1. If no entry exists under `nonce`, the call traps with `NotQueued` (810).
2. If `unlock_time > ledger_timestamp`, the call traps with `NotUnlocked` (811). Equality unlocks, so the entry becomes executable on the first ledger whose timestamp reaches `unlock_time`. It stays queued until an account submits `execute`.

The call then removes `GovKey::Queued(nonce)` and invokes `fn_name` on `target` with the stored `args`. The removal comes first, so the target runs against state in which the entry is already consumed. The host also prohibits any call from the target back into the governance contract while `execute` runs. The call reads the return value as `Val` and discards it. It publishes `executed` after the forwarded call returns, so the target's own events come first in the transaction.

The forwarded call carries the governance contract address as the invoker. An owner-only function on the target accepts it when the governance contract is the owner of that target.

An error from the target propagates and reverts the whole transaction, and the removal of the entry reverts with it. A failed execution leaves the entry queued and executable later.

Entries execute in any order. The contract enforces no order between nonces, so an entry queued later can execute first.

## Forward a status at once

```rust
fn set_status(e: Env, target: Address, status: u32)
```

Owner only. The gates run in this order:

1. The owner check. The owner key must exist (`OwnerNotSet` (2100)) and the owner must sign.
2. The forwarded call to `target`.

The call takes effect in the same transaction as the owner's authorization. It is the only owner function that skips the queue and the delay. It forwards one function name, `set_status`, with one argument, `status`, and writes no entry and no nonce. If the forwarded call succeeds, `set_status` publishes `status_set`. If the target returns an error, the error propagates as on `execute`.

`target` is any `Address`. The contract does not check that it is a market or that it exposes `set_status`, and the forwarded call traps when it does not. `status` is a `u32` discriminant of the market `Status` enum. The target validates it. The [Market status page](../market/status.md) gives the values and what each one permits.

The owner-only `set_status` function on the target accepts the forwarded call when the governance contract is the owner of that target.

## Read a queued call

```rust
fn get_queued(e: Env, nonce: u32) -> QueuedCall
```

Permissionless. It returns the whole entry under `nonce` and traps with `NotQueued` (810) when none exists. The read extends the TTL of the persistent entry, so a submitted transaction that calls it writes state. A simulation commits nothing. The call leaves the instance TTL as it is.

## The queued call record

`QueuedCall` is the stored form of one entry. `get_queued` returns it.

| Field | Type | Meaning |
| --- | --- | --- |
| `target` | `Address` | The contract that `execute` invokes. |
| `fn_name` | `Symbol` | The function name on `target`. |
| `args` | `Vec<Val>` | The argument list, forwarded verbatim. |
| `unlock_time` | `u64`, unix seconds | The first timestamp at which `execute` succeeds. |

## Storage

The contract owns four `GovKey` variants. The `Ownable` mixin owns two more keys. `OwnableStorageKey::Owner` sits on the instance. `OwnableStorageKey::PendingOwner` sits in temporary storage. Both hold what they hold on the [market](../market/storage.md#ledger-keys).

| Key | Value | Class | Written by | Read by |
| --- | --- | --- | --- | --- |
| `GovKey::Delay` | `u64`, seconds | instance | `__constructor`, `apply_delay` | `queue`, `set_delay`, `apply_delay`, `get_delay` |
| `GovKey::Nonce` | `u32`, the next nonce | instance | `queue` | `queue` |
| `GovKey::Queued(u32)` | `QueuedCall` | persistent | `queue`, and `cancel` and `execute` remove it | `cancel`, `execute`, `get_queued` |
| `GovKey::PendingDelay` | `PendingDelay` | persistent | `set_delay`, and `apply_delay` removes it | `apply_delay` |

[Delay changes](./delay.md) covers `PendingDelay` and the two functions that touch it.

### Time-to-live

A ledger lasts about 5 seconds. A threshold is the remaining TTL below which an access extends an entry. A bump is the TTL to which the access extends it.

| Constant | Ledgers | Time |
| --- | --- | --- |
| `ONE_DAY_LEDGERS` | 17_280 | 1 day |
| `LEDGER_THRESHOLD_INSTANCE` | 1_036_800 | 60 days |
| `LEDGER_BUMP_INSTANCE` | 1_054_080 | 61 days |
| `LEDGER_THRESHOLD_QUEUED` | 1_728_000 | 100 days |
| `LEDGER_BUMP_QUEUED` | 2_073_600 | 120 days |

`extend_instance` applies the two instance constants. It runs in `queue`, `cancel`, `execute`, `set_status`, `set_delay`, and `apply_delay`, and at the end of `__constructor`. On the four owner-only functions it runs after the owner check. `get_delay` and `get_queued` leave the instance TTL as it is.

The instance entry holds the instance keys and the reference to the contract code. The code is a separate ledger entry. The extension call tests the threshold for each entry apart. The host can extend one and leave the other.

`LEDGER_THRESHOLD_QUEUED` and `LEDGER_BUMP_QUEUED` govern the two persistent keys, `GovKey::Queued(u32)` and `GovKey::PendingDelay`. A read or a write of one of them extends it when its remaining TTL is below the 100-day threshold. A removal extends nothing. The 120-day bump outlives the 60-day delay ceiling, so an entry survives the longest wait the contract permits with no further traffic. An entry whose TTL lapses is archived, not deleted, and a restore brings it back.

## Errors

`GovernanceError` is the contract error enum. Governance owns the 810 to 812 domain. The strategy vault uses 800 and 801 from the same 8xx range. The table is the complete set of `GovernanceError` codes.

| Error | Code | Condition |
| --- | --- | --- |
| `Unauthorized` | 1 | The code sits outside the 810 to 812 domain and mirrors the shared access-control numbering. No function raises it. |
| `NotQueued` | 810 | `cancel`, `execute`, and `get_queued` find no entry under `nonce`. `apply_delay` finds no pending delay change. |
| `NotUnlocked` | 811 | `execute` runs before `unlock_time`. `apply_delay` runs before the unlock time of the pending change. |
| `InvalidDelay` | 812 | `__constructor` or `set_delay` receives a delay of `0`, or one above `5_184_000` seconds. |

An owner-only function called by another account fails host authorization, and the failure carries no `GovernanceError` code. The Ownable codes come from `OwnableError`, not `GovernanceError`. After a renounce, the four owner-only functions trap with `OwnerNotSet` (2100). `__constructor` traps with `OwnerAlreadySet` (2102) when an owner key exists, as the constructor gates describe. The [Ownable codes](../market/errors.md#ownable-codes) table gives the `OwnableError` and `RoleTransferError` codes and their conditions. [Execute a queued call](#execute-a-queued-call) covers an error raised by a target.

## Events

Every event derives `contractevent` from soroban-sdk 26.1.1. The first topic is the event name, which is the struct name in lower snake case. Each `#[topic]` field follows in declaration order. Every other field sits in the data map under its own field name.

| Event | Topics after the name | Data | Published by |
| --- | --- | --- | --- |
| `queued` | `nonce: u32` | `target: Address`, `fn_name: Symbol`, `unlock_time: u64` in unix seconds | `queue` |
| `executed` | `nonce: u32` | `target: Address`, `fn_name: Symbol` | `execute`, after the forwarded call returns |
| `cancelled` | `nonce: u32` | an empty map, because the struct carries no data field | `cancel` |
| `status_set` | `target: Address` | `status: u32`, a market `Status` discriminant | `set_status`, after the forwarded call returns |

`set_delay` publishes a second form of `queued` for a delay change, and `apply_delay` publishes `delay_set`. [Delay changes](./delay.md) covers both.

## Ownership

The contract mixes in `Ownable` from stellar-access 0.7.2. It exposes `get_owner`, `transfer_ownership`, `accept_ownership`, and `renounce_ownership`, and these four extend no TTL. Four functions carry `#[only_owner]`:

- `queue`
- `cancel`
- `set_status`
- `set_delay`

The Ownable surface is the same on every contract that carries it. These pages document it:

- Signatures and the transfer rule: the [market dependency page](../market/dependencies.md#ownership-and-upgrade).
- Codes: [Ownable codes](../market/errors.md#ownable-codes).
- Payloads: [ownership events](../market/events.md#ownership-events).

`renounce_ownership` removes the owner key, and nothing restores it. A renounce traps with `TransferInProgress` (2101) while an unexpired pending transfer exists. A renounce that succeeds therefore leaves no pending transfer, and `accept_ownership` then traps with `NoPendingTransfer` (2200). From then on the four owner-only functions, `transfer_ownership`, and `renounce_ownership` trap with `OwnerNotSet` (2100). `get_owner` returns `None`. `execute`, `apply_delay`, `get_delay`, and `get_queued` keep working, so an entry queued before the renounce still executes at its unlock time.

The governance code is fixed at deploy. The contract exposes no `upgrade`, so the timelock rules and the delay range hold for the life of the contract. The market, oracle, and factory contracts expose `upgrade`.

### The timelock becomes an owner by construction or by transfer

A contract whose constructor takes an `owner` argument has the timelock as its owner when the deploy passes the timelock address there. The factory gives each new market the `admin` it receives as owner, so a market gets the timelock the same way.

An existing owner hands a contract to the timelock in two steps. The owner calls `transfer_ownership` on the target with the timelock address and a `live_until_ledger`. The timelock then has to sign `accept_ownership` on the target, because the pending owner authorizes that call. The timelock signs only inside `execute`, where the forwarded call carries the timelock address as invoker. The transfer therefore completes through `queue` with the target, the function name `accept_ownership`, and an empty argument list, followed by `execute` once the delay has passed.

The pending transfer expires after `live_until_ledger`. The value must reach past the unlock time of the queued `accept_ownership` entry, or the transfer lapses before the entry can run.

## Rules that hold across calls

A nonce is consumed once. `queue` issues it, and no later call reissues it. After `cancel` or `execute` on nonce `n`, every read of `n` traps with `NotQueued`.

An entry freezes its `unlock_time` when `queue` writes it. A later delay change moves no entry already in the queue. It governs only the entries that `queue` writes after it.

An unlocked entry stays executable by any account. The owner can stop it only with a `cancel` that lands before the `execute`.
