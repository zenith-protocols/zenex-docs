---
sidebar_position: 1
title: Governance
---

# Governance

The governance tree covers the timelock, the calls that pass through it, and the delay that gates them. The timelock is optional. A market, an oracle, a factory, or a treasury has one owner, and that owner is either a keypair-controlled account or the timelock.

| Page | What it holds |
| --- | --- |
| [Timelock](./timelock.md) | `__constructor`, `queue`, `cancel`, `execute`, `set_status`, `get_queued`, the `QueuedCall` entry and the nonce that addresses it, the `GovKey` keys and their time-to-live constants, the error catalog, and the `Queued`, `Executed`, `Cancelled`, and `StatusSet` events. |
| [Delay changes](./delay.md) | `set_delay`, `apply_delay`, `get_delay`, the bounds on the delay, the `PendingDelay` record, the delay form of `Queued`, and the `DelaySet` event. |

The [Ownership](./timelock.md#ownership) section of the timelock page gives the two ways a contract comes to have the timelock as its owner.
