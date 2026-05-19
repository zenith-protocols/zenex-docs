---
sidebar_position: 1
title: Governance Contract
---

# Governance Contract

The `GovernanceContract` is a general-purpose timelock proxy for deferred admin operations. It queues arbitrary contract calls with a mandatory delay, giving users time to react to parameter changes before they take effect. Emergency status changes bypass the delay for immediate halts.

## Constructor

```
__constructor(owner: Address, delay: u64)
```

- `owner` -- Admin address authorized to queue/cancel calls and set status.
- `delay` -- Mandatory waiting period in seconds before queued calls can execute. Must be in the range `[1, 5_184_000]` (1 second to 60 days). Panics with `InvalidDelay` (772) if zero or above the 60-day cap.

## Entry Points

### queue

```
queue(target: Address, fn_name: Symbol, args: Vec<Val>) -> u32
```

*Owner only.* Queues an arbitrary contract call to execute after the delay. Returns a monotonically increasing nonce identifying the queued call. The call is stored with `unlock_time = now + delay`.

### cancel

```
cancel(nonce: u32)
```

*Owner only.* Cancels a queued call before it is executed. Panics with `NotQueued` (770) if the nonce is not found or has expired.

### execute

```
execute(nonce: u32)
```

*Permissionless.* Executes a queued call after the delay has passed. The queued entry is removed from storage before the external call (CEI pattern). Panics with `NotQueued` (770) if not found, or `NotUnlocked` (771) if the delay has not yet passed.

### set_status

```
set_status(target: Address, status: u32)
```

*Owner only.* Immediately calls `set_status(status)` on the target contract, bypassing the timelock delay. This allows emergency pause (`Frozen`, `AdminOnIce`) without waiting.

### set_delay

```
set_delay(new_delay: u64)
```

*Owner only.* Queues a delay change. The new delay must be in `[1, 5_184_000]` seconds (60-day cap). The change is subject to the *current* delay before it can take effect, preventing instant delay reduction attacks. Panics with `InvalidDelay` (772) if the value is out of range.

### apply_delay

```
apply_delay()
```

*Permissionless.* Applies a pending delay change after the current delay has passed. Panics with `NotQueued` (770) if no pending delay change exists, or `NotUnlocked` (771) if the current delay has not yet passed.

### get_delay

```
get_delay() -> u64
```

*Permissionless.* Returns the current delay in seconds.

### get_queued

```
get_queued(nonce: u32) -> QueuedCall
```

*Permissionless.* Returns the queued call for a given nonce. Panics with `NotQueued` (770) if not found or expired.

## Access Control

| Function | Auth |
|---|---|
| `queue` | Owner only |
| `cancel` | Owner only |
| `execute` | Permissionless (after delay) |
| `set_status` | Owner only (immediate, no delay) |
| `set_delay` | Owner only (queues change subject to current delay) |
| `apply_delay` | Permissionless (after current delay) |
| `get_delay` | Permissionless (read-only) |
| `get_queued` | Permissionless (read-only) |

The contract implements OZ `Ownable` only. The `Upgradeable` impl was deliberately removed: an upgradeable governance contract could swap out its own bytecode (and the timelock with it) under the owner key, which defeats the point of the delay. The contract is now permanently pinned to its deployed WASM.

## Two-Step Delay Change

The delay itself cannot be changed instantly. `set_delay` stores a `PendingDelay { new_delay, unlock_time }` in temporary storage, where `unlock_time = now + current_delay`. Only after the current delay elapses can anyone call `apply_delay` to activate the new value. This prevents an attacker who gains owner access from immediately reducing the delay to zero and bypassing the timelock.

## Storage

| Storage Type | Key | Value |
|---|---|---|
| Instance | `Delay` | Current delay in seconds (`u64`) |
| Instance | `Nonce` | Monotonically incrementing counter (`u32`) |
| Temporary | `Queued(nonce)` | `QueuedCall { target, fn_name, args, unlock_time }` |
| Temporary | `PendingDelay` | `PendingDelay { new_delay, unlock_time }` |

### TTL Calculation

Queued entries and pending delay changes use Soroban temporary storage. The TTL is derived from the delay:

```
delay_ledgers = delay_seconds / 5
threshold     = max(2 * delay_ledgers, 1_day_ledgers)
bump          = threshold + 1_day_ledgers
```

Where `1_day_ledgers = 17280` (assuming 5-second ledger close time). The 2x multiplier ensures the entry survives long enough to be executed after the delay, with a minimum floor of 1 day. If the TTL expires before execution, the entry is silently pruned with no event or notification.

## Error Codes

| Code | Name | Description |
|---|---|---|
| 1 | `Unauthorized` | Caller is not the contract owner |
| 770 | `NotQueued` | Queue entry not found or expired |
| 771 | `NotUnlocked` | Timelock delay not yet passed |
| 772 | `InvalidDelay` | Delay value is zero or exceeds the 60-day cap |

## Events

| Event | Topics | Data |
|---|---|---|
| `Queued` | `nonce` | `target, fn_name, unlock_time` |
| `Executed` | `nonce` | `target, fn_name` |
| `Cancelled` | `nonce` | (no data) |
| `StatusSet` | `target` | `status` |
| `DelaySet` | None | `old_delay, new_delay` |

The `set_delay` function emits a `Queued` event with `nonce = u32::MAX` and `target = self` to signal the pending delay change through the same event stream as regular queued calls.
