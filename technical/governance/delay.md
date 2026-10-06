---
title: Delay changes
description: Delay bounds, pending changes, unlock times, events, and effects on queued calls.
sidebar_position: 3
---

# Delay changes

This page covers how the timelock delay changes: the bounds on the delay, the two calls `set_delay` and `apply_delay`, the `PendingDelay` record, and the two events those calls publish.

The delay is a `u64` count of seconds under `GovKey::Delay` in instance storage. `queue` adds it to the ledger timestamp to set the unlock time of every new queue entry. A change to the delay passes through the timelock itself, in two steps. The owner calls `set_delay` to record a pending change. Any account calls `apply_delay` after the delay in force has passed, and the new value then takes effect. The change takes effect only after the delay in force when `set_delay` runs, so the owner cannot shorten the timelock instantly.

A queue entry keeps the unlock time it received at queue time, so a change reaches only the entries that `queue` writes after `apply_delay` returns. The [timelock page](./timelock.md#the-queued-call-record) gives the `QueuedCall` record and that rule. The same page holds the [storage table](./timelock.md#storage), the [time to live (TTL) constants](./timelock.md#time-to-live), and the [event list](./timelock.md#events) for the queued calls.

## The delay stays between 1 second and 60 days

A valid delay is at least `1` second and at most `5_184_000` seconds, which is 60 days. Both ends are inclusive. Zero would make every entry executable in the ledger that queues it. The ceiling stays below the 120-day TTL that `LEDGER_BUMP_QUEUED` gives a queue entry, so an entry outlives its own delay.

| Delay in seconds | Result |
| --- | --- |
| `0` | `InvalidDelay` (812) |
| `1` | Valid |
| `5_184_000` | Valid |
| `5_184_001` | `InvalidDelay` (812) |

`set_delay` applies the check to `new_delay`. `__constructor` applies the same check to the delay recorded at deploy. The value that `get_delay` returns is therefore always inside the range.

## `set_delay` records a pending change

```rust
#[only_owner]
fn set_delay(e: Env, new_delay: u64)
```

The owner must sign. `new_delay` is a count of seconds.

The call writes a `PendingDelay` record under `GovKey::PendingDelay` in persistent storage and writes no other storage value. `get_delay` keeps returning the delay in force until `apply_delay` runs. A second `set_delay` overwrites the record, and the replacement carries a fresh unlock time from the ledger timestamp of the second call. Only another `set_delay` replaces a pending change, and only `apply_delay` removes it.

The gates run in this order.

1. The owner check, injected by `#[only_owner]`. If the owner key is absent, the call traps with `OwnerNotSet` (2100). If the owner does not sign, the host rejects the call, and that failure carries no contract error code. The [market dependency page](../market/dependencies.md#ownership-and-upgrade) gives the owner check.
2. The range check. If `new_delay` is `0` or above `5_184_000`, the call traps with `InvalidDelay` (812).

A trapped call reverts every write and publishes no event. The TTL rules for the instance entry and for `GovKey::PendingDelay` are under [Time to live](./timelock.md#time-to-live).

### Unlock time

```
unlock_time = ledger_timestamp + current_delay
```

Where:

- `unlock_time` is a `u64` in unix seconds. It is the first time at which `apply_delay` succeeds.
- `ledger_timestamp` is a `u64` in unix seconds. It is the timestamp of the ledger that includes the call.
- `current_delay` is a `u64` count of seconds read from `GovKey::Delay`. It is the delay in force at that moment, not `new_delay`.

`set_delay` computes this as an integer addition, so no rounding applies. In words, a change takes the delay that is in force when the owner asks for it, whatever the new value is. A move from a long delay to a short one takes effect after the long delay, and a move from a short delay to a long one takes effect after the short delay.

The rows below use `ledger_timestamp = 1_800_000_000`.

| `current_delay` | `new_delay` | `unlock_time` | Time until `apply_delay` succeeds |
| --- | --- | --- | --- |
| `604_800` (7 days) | `86_400` (1 day) | `1_800_604_800` | 7 days |
| `86_400` (1 day) | `2_592_000` (30 days) | `1_800_086_400` | 1 day |
| `172_800` (2 days) | `172_800` (2 days) | `1_800_172_800` | 2 days |

### The delay form of `Queued`

`set_delay` publishes the `Queued` event under the topic symbol `queued`. The `nonce` topic carries the sentinel `u32::MAX`, which is `4_294_967_295`. The data map carries `fn_name` set to the symbol `set_delay`, `target` set to the governance contract's own address, and `unlock_time` as computed above. The sentinel lets a consumer tell a delay change from a queued call inside one event stream. The queue holds no entry for the change, so `get_queued` with that nonce traps with `NotQueued` (810).

## `apply_delay` puts the change in force

```rust
fn apply_delay(e: Env)
```

Any account may call it once the record unlocks. The call reads `GovKey::PendingDelay` and applies two gates in order.

1. If no record exists, the call traps with `NotQueued` (810).
2. If `pending.unlock_time > ledger_timestamp`, the call traps with `NotUnlocked` (811). Equality unlocks, so the call succeeds from `unlock_time` onward.

On success the call reads the old delay from `GovKey::Delay`, removes `GovKey::PendingDelay`, writes `pending.new_delay` to `GovKey::Delay`, and publishes `DelaySet`. The call does not check the range again, because `set_delay` checked it before the record was written.

## `get_delay` returns the delay in force

```rust
fn get_delay(e: Env) -> u64
```

Any account may call this view. It returns the value under `GovKey::Delay` in seconds, which is the delay in force until `apply_delay` runs. It never returns a pending value.

## The `PendingDelay` record

```rust
#[contracttype]
pub struct PendingDelay {
    pub new_delay: u64,
    pub unlock_time: u64,
}
```

| Field | Type | Unit | Meaning |
| --- | --- | --- | --- |
| `new_delay` | `u64` | seconds | The delay that `apply_delay` writes to `GovKey::Delay` |
| `unlock_time` | `u64` | unix seconds | The time from which `apply_delay` succeeds |

No entry point returns `PendingDelay`. A consumer reads the record from the ledger entry under `GovKey::PendingDelay`. The `set_delay` invocation carries `new_delay`. Of the two fields, the `queued` event carries `unlock_time` alone. The `DelaySet` event is the first event to carry the new value.

## `DelaySet` carries the old and the new delay

```rust
#[contractevent]
pub struct DelaySet {
    pub old_delay: u64,
    pub new_delay: u64,
}
```

The event has one topic, the name symbol `delay_set`. No field is a `#[topic]`, so `old_delay` and `new_delay` both sit in the data map, and both are counts of seconds. `old_delay` is the value under `GovKey::Delay` before the write, and `new_delay` is the value after it. `apply_delay` publishes the event after the write to `GovKey::Delay`.

## Four error codes cover these calls

| Error | Code | Raised by | Condition |
| --- | --- | --- | --- |
| `OwnerNotSet` | 2100 | `set_delay` | The owner key is absent. |
| `InvalidDelay` | 812 | `set_delay` | `new_delay` is `0` or above `5_184_000`. |
| `NotQueued` | 810 | `apply_delay` | No `GovKey::PendingDelay` record exists. |
| `NotUnlocked` | 811 | `apply_delay` | `unlock_time` is later than the ledger timestamp. |

## Invariants

- At most one delay change is pending. A second `set_delay` replaces the first record and sets a fresh unlock time.
- Every delay change takes the delay in force when `set_delay` ran as its own delay. That rule binds the owner as it binds any other account.
- The delay in force stays between `1` and `5_184_000` seconds inclusive for the life of the contract.

Only `__constructor` and `apply_delay` write `GovKey::Delay`.
