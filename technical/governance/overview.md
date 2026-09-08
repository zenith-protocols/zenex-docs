---
sidebar_position: 1
title: Governance
---

# Governance

The governance tree covers the timelock and the calls that pass through it. The owner queues a call to any contract, and the entry becomes executable only after a wait. Any account can then execute it. One owner call, `set_status`, reaches its target at once with no wait. A change to the delay itself waits out the delay in force, so nobody can shorten the timelock instantly. A deployment can leave a market, an oracle, a factory, or a treasury owned by a keypair-controlled account. A deployment adopts the timelock when it owns those contracts, either at deploy or after a transfer. Ownership transfer has its own page, [Ownership and upgrade](../ownership.md). The pages below hold those calls, their storage, and their errors.

| Page | What it holds |
| --- | --- |
| [Timelock](./timelock.md) | `__constructor`, `queue`, `cancel`, `execute`, `set_status`, `get_queued`, the `QueuedCall` row and the nonce that addresses it, the `GovKey` keys and their time-to-live constants, the error catalog, and the `Queued`, `Executed`, `Cancelled`, and `StatusSet` events. |
| [Delay changes](./delay.md) | `set_delay`, `apply_delay`, `get_delay`, the bounds on the delay, the `PendingDelay` record, the delay form of `Queued`, and the `DelaySet` event. |
