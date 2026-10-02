---
sidebar_position: 1
title: Factory
---

# Factory

The `FactoryContract` deploys one strategy vault and one market together in a single call, so the vault's only strategy is the market it was deployed with. The call creates both contracts or neither, and each one stores the address of the other at construction. A separate factory owner controls the code hashes the factory installs, the treasury address it wires, and the factory's own code. Every other deploy input comes from the caller. The [owner surface](./init-meta.md#owner-surface) gives that role.

| Page | What it holds |
| --- | --- |
| [Deploy](./deploy.md) | `deploy`, the vault salt derivation, the derivation of the two addresses, the construction order of the two contracts, the `Deploy` event, the failure modes, and `is_deployed` with its registry key. |
| [Init meta and constructor](./init-meta.md) | `__constructor`, the `FactoryInitMeta` fields, `set_init_meta` with the `InitMetaUpdate` event, `get_init_meta`, the instance key with its time to live (TTL), and what a factory upgrade leaves alone. |
