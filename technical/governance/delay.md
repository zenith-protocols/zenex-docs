---
title: Delay changes
sidebar_position: 3
---

# Delay changes

The delay is the wait that `queue` adds to the ledger timestamp to set the unlock time of every new entry. It is a `u64` count of seconds, held under `GovKey::Delay` in instance storage.

A change to the delay passes through the timelock itself, in two steps. The owner calls `set_delay` to record the change. Any account calls `apply_delay` after the wait to put the new value in force.

The wait is the delay in force when `set_delay` runs, so the owner cannot shorten the wait for that change.

For the queued call surface and the time to live (TTL) constants, refer to [Timelock](./timelock.md).

## Delay range

A valid delay is at least `1` second and at most `5_184_000` seconds, which is 60 days. Both ends are inclusive. If `new_delay` is outside that range, `set_delay` traps with `InvalidDelay` (812). The delay recorded at deploy passes the same check. The value that `get_delay` returns is therefore always inside the range.

## `set_delay`

```rust
#[only_owner]
fn set_delay(e: Env, new_delay: u64)
```

Records a pending delay change. The owner must sign. `new_delay` is whole seconds.

The call writes a `PendingDelay` record under `GovKey::PendingDelay` in persistent storage. That record is the only value it writes. `get_delay` keeps returning the delay in force until `apply_delay` runs. A second `set_delay` overwrites the record, and the replacement carries a fresh unlock time from the ledger timestamp of the second call. A pending change is replaced only by another `set_delay`, and it is removed only by `apply_delay`.

The checks run in order. If the owner key is absent, the call traps with `OwnerNotSet` (2100). If the owner does not sign, the host rejects the call, and that failure carries no contract error code. The range check runs last, so only the owner reaches `InvalidDelay` (812) for a `new_delay` outside the delay range. A rejected call leaves storage and the event log as they were. For the owner check, refer to [Ownership and upgrade](../ownership.md).

### Unlock time

```
unlock_time = ledger_timestamp + current_delay
```

- `unlock_time`: `u64`, unix seconds. The time from which `apply_delay` succeeds.
- `ledger_timestamp`: `u64`, unix seconds. The ledger timestamp of the transaction that carries the call.
- `current_delay`: `u64`, seconds, read from `GovKey::Delay`. It is the delay in force at that moment, and not `new_delay`.

`set_delay` computes this. The addition is integer, and no rounding applies. A move from a long delay to a short one waits the long delay. A move from a short delay to a long one waits the short delay.

### Event

`set_delay` publishes the `Queued` event under the topic symbol `queued`. The `nonce` topic carries the sentinel `u32::MAX`, which is `4_294_967_295`. The data map carries `fn_name` set to the symbol `set_delay`, `target` set to the governance contract's own address, and `unlock_time` as computed above. The sentinel marks a delay change inside the same event stream as the queued calls. The change itself lives under `GovKey::PendingDelay` alone, so `get_queued` with that nonce traps with `NotQueued` (810).

## `apply_delay`

```rust
fn apply_delay(e: Env)
```

Puts the pending delay in force. The call is permissionless and unrewarded. Any account may submit it once the record unlocks.

The call reads `GovKey::PendingDelay`. If no record exists, the call traps with `NotQueued` (810). If `pending.unlock_time > ledger_timestamp`, the call traps with `NotUnlocked` (811). Equality unlocks, so the call succeeds from `unlock_time` onward. On success the call removes `GovKey::PendingDelay`, writes `pending.new_delay` to `GovKey::Delay`, and publishes `DelaySet`.

An entry queued before the change keeps its own unlock time. `QueuedCall` freezes that field at queue time for the life of the entry. The new delay reaches only the entries that `queue` writes after `apply_delay` returns.

## `get_delay`

```rust
fn get_delay(e: Env) -> u64
```

`get_delay` is a permissionless view. It returns the value under `GovKey::Delay`, in seconds, which is the delay in force until `apply_delay` runs. `get_delay` does not extend the instance TTL, so that TTL stands as the last write left it.

## `PendingDelay`

```rust
#[contracttype]
pub struct PendingDelay {
    pub new_delay: u64,
    pub unlock_time: u64,
}
```

| Field | Type | Unit | Meaning |
|---|---|---|---|
| `new_delay` | `u64` | seconds | The delay that `apply_delay` writes to `GovKey::Delay` |
| `unlock_time` | `u64` | unix seconds | The time from which `apply_delay` succeeds |

No entry point returns `PendingDelay`. A consumer reads the record from the ledger entry under `GovKey::PendingDelay`. The `set_delay` invocation carries `new_delay`. Of the two record fields, the `queued` event carries `unlock_time` alone. The `DelaySet` event that `apply_delay` publishes is the first event to carry the new value.

## Storage

| Key | Value | Class | Written by | Read by |
|---|---|---|---|---|
| `GovKey::Delay` | `u64` seconds | instance | `__constructor`, `apply_delay` | `queue`, `set_delay`, `apply_delay`, `get_delay` |
| `GovKey::PendingDelay` | `PendingDelay` | persistent | `set_delay` (write), `apply_delay` (remove) | `apply_delay` |

Both the write and the read of `GovKey::PendingDelay` extend that entry's TTL. `set_delay` and `apply_delay` also extend the instance TTL.

## `DelaySet`

```rust
#[contractevent]
pub struct DelaySet {
    pub old_delay: u64,
    pub new_delay: u64,
}
```

The topic symbol is `delay_set`. The event carries one topic, the name symbol. No field is a `#[topic]`, so `old_delay` and `new_delay` both sit in the data map, and both are whole seconds. `apply_delay` publishes it after the write to `GovKey::Delay`.

## Invariants

- At most one delay change is pending. A second `set_delay` replaces the first record and restarts its wait.
- Every delay change waits the delay in force at the moment `set_delay` ran. That wait binds the owner as much as any other account.
- A queued call keeps the unlock time it received at queue time, across any number of delay changes.
- The delay in force stays inside `[1, 5_184_000]` seconds for the life of the contract.
