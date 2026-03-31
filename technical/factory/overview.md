---
sidebar_position: 1
title: Factory Overview
---

# Factory Contract

The factory deploys trading and vault pairs atomically with deterministic addresses. It stores WASM hashes and the global treasury address at construction time. Once deployed, these values cannot be changed.

## Constructor

```rust
__constructor(init_meta: ZenexInitMeta)
```

`ZenexInitMeta` contains three fields:

| Field | Type | Description |
|---|---|---|
| `trading_hash` | `BytesN<32>` | WASM hash for trading contracts |
| `vault_hash` | `BytesN<32>` | WASM hash for vault contracts |
| `treasury` | `Address` | Protocol-wide treasury address |

These values are **immutable**. There are no setter functions. If a security fix is needed for the trading or vault WASM, a new factory must be deployed entirely.

## Deployment Flow

```rust
deploy(
    admin,
    salt,
    token,
    price_verifier,
    config,
    vault_name,
    vault_symbol,
    vault_decimals_offset,
    vault_lock_time,
) -> (Address, Address)
```

The `deploy` function begins by requiring authentication from the `admin` parameter. Any address can serve as the admin of a new pool, but it must explicitly authorize the call.

Salt computation applies `keccak256` over the concatenation of the caller-provided salt, the admin's address bytes, and a discriminator value (`0` for trading, `1` for vault). Including the admin address in the salt prevents front-running attacks where an adversary could observe a pending deployment transaction and race to deploy at the same deterministic address first.

Before either contract is instantiated, both addresses are precomputed using `deployer().with_current_contract(salt).deployed_address()`. This allows each contract to receive the other's address during its own construction. The vault is deployed first, receiving the precomputed trading address as its `strategy` parameter. The trading contract is deployed second, receiving the precomputed vault address. This ordering satisfies the circular dependency between the two contracts without requiring a post-deployment linking step.

After both contracts are live, the factory writes `FactoryDataKey::Pools(trading_address) = true` to persistent storage with a 100-day TTL. It then emits a `Deploy { trading, vault }` event.

## Registry

The factory tracks deployed pools through a simple boolean mapping. `is_pool(pool_id) -> bool` performs a permissionless point-in-time existence check. Only trading addresses are registered, not vault addresses.

There is no enumeration function. Callers cannot list all deployed pools through the contract itself. There is also no deregistration function. Once a pool is registered, the entry persists until its TTL expires.

## Access Control

The factory has **no owner**. The constructor is called once at deployment, and no administrative functions exist beyond that point.

- `deploy` requires the `admin` parameter to authenticate. Any address can be the admin of a new pool.
- `is_pool` is fully permissionless. No authorization is required to query the registry.

## WASM Hash Immutability

Because the WASM hashes stored at construction time have no setters, every pool deployed by a given factory instance runs the same trading and vault code. Applying security fixes or upgrading contract logic requires deploying an entirely new factory with updated hashes. Pools deployed by the old factory continue to run the original code.
