---
sidebar_position: 1
title: Factory Overview
---

# Factory Contract

The factory deploys trading and vault pairs atomically with deterministic addresses. It stores WASM hashes and the global treasury address at construction time. Once deployed, these values cannot be changed.

## Constructor

```rust
__constructor(init_meta: FactoryInitMeta)
```

`FactoryInitMeta` contains three fields:

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
    vault_min_deposit,
) -> Address
```

The `deploy` function begins by requiring authentication from the `admin` parameter. Any address can serve as the admin of a new pool, but it must explicitly authorize the call.

The vault salt is derived by XORing the last byte of the user-provided salt (`salt[31] ^= 1`), producing a distinct but deterministic salt for the vault contract.

Both addresses are precomputed using Soroban's native `deployer().with_current_contract(salt).deployed_address()`. This allows each contract to receive the other's address during its own construction. The vault is deployed first, receiving the precomputed trading address as its `strategy` parameter. The trading contract is deployed second, receiving the precomputed vault address. This ordering satisfies the circular dependency between the two contracts without requiring a post-deployment linking step.

After both contracts are live, the factory records the trading address in persistent storage and emits a `Deploy { trading, vault }` event.

## Registry

The factory tracks deployed pools through a simple boolean mapping. `is_deployed(trading) -> bool` performs a permissionless existence check. Only trading addresses are registered, not vault addresses.

There is no enumeration function. Callers cannot list all deployed pools through the contract itself.

## Access Control

The factory has **no owner**. The constructor is called once at deployment, and no administrative functions exist beyond that point.

- `deploy` requires the `admin` parameter to authenticate. Any address can be the admin of a new pool.
- `is_deployed` is fully permissionless. No authorization is required to query the registry.

## WASM Hash Immutability

Because the WASM hashes stored at construction time have no setters, every pool deployed by a given factory instance runs the same trading and vault code. Applying security fixes or upgrading contract logic requires deploying an entirely new factory with updated hashes. Pools deployed by the old factory continue to run the original code.
