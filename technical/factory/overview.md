---
sidebar_position: 1
title: Factory
---

# Factory

The `FactoryContract` deploys one strategy vault and one market in a single call. Any address may call `deploy`. The address in `admin` must authorize the call and both deployments. `admin` owns the new market. The market is the vault's registered strategy and the only address that moves the vault's assets. Each call creates the pair from the WASM hashes that `FactoryInitMeta` holds at that moment. The factory records each market it deploys. The factory owner is a separate role. That role controls `FactoryInitMeta` and the factory's own code. The pages below hold the contract surface. For the `Ownable` entry points and `upgrade`, refer to [Ownership and upgrade](../ownership.md).

| Page | What it holds |
| --- | --- |
| [Deploy](./deploy.md) | `deploy`, the vault salt derivation, the derivation of the two addresses, the construction order of the two contracts, the `Deploy` event, the failure modes, and `is_deployed` with its registry key. |
| [Init meta and constructor](./init-meta.md) | `__constructor`, the `FactoryInitMeta` fields, `set_init_meta`, `get_init_meta`, the instance key with its TTL, and what a factory upgrade leaves alone. |
