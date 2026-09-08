---
title: Init meta and constructor
sidebar_position: 3
---

# Init meta and constructor

The factory keeps its deployment inputs in one record, `FactoryInitMeta`. The record names the market WASM hash, the vault WASM hash, and the treasury address. Every `deploy` reads the record. The two hashes are installed as the code of the new market and vault pair that `deploy` creates. The treasury address is passed to the new market's constructor. The factory constructor writes the record. The owner replaces it through `set_init_meta`.

## Constructor

```rust
fn __constructor(e: Env, owner: Address, init_meta: FactoryInitMeta)
```

The host runs the constructor once, inside the create-contract call that deploys the factory. The deployer address authorizes that call at the host level, so the body checks no authorization of its own.

The body writes three instance entries, in order. `set_owner` writes `owner` under `OwnableStorageKey::Owner`. `set_schema_version` writes `1` under `UpgradeableStorageKey::SchemaVersion`. A crate-internal storage helper writes `init_meta` under the key `Symbol("InitMeta")`. The `set_init_meta` entry point writes the same key.

If the owner key is already present, `set_owner` traps with `OwnableError::OwnerAlreadySet` (2102). The host runs the constructor once per instance, so a deployed factory cannot reach that condition.

The constructor stores both hashes and the treasury address as given, without a check against the ledger. A hash that names no uploaded blob surfaces as a host failure on the first `deploy` that uses it. The constructor emits no event. It does not extend the instance time to live (TTL). A fresh instance carries the TTL that its deploy transaction paid for.

`owner` gains `set_init_meta` and `upgrade`. That surface, and the `Ownable` entries with their authorization rules, is documented under [Ownership and upgrade](../ownership).

## `FactoryInitMeta`

```rust
#[contracttype]
pub struct FactoryInitMeta {
    pub market_hash: BytesN<32>,
    pub vault_hash: BytesN<32>,
    pub treasury: Address,
}
```

| Field | Type | Meaning |
|---|---|---|
| `market_hash` | `BytesN<32>` | The hash of the uploaded WASM blob that the market half of a deploy installs. |
| `vault_hash` | `BytesN<32>` | The hash of the uploaded WASM blob that the vault half of a deploy installs. |
| `treasury` | `Address` | The treasury address that the factory passes to the constructor of each market it deploys. |

The type carries `#[contracttype]`, so it appears in the exported contract spec and crosses the contract boundary in both directions.

## `set_init_meta`

```rust
fn set_init_meta(e: Env, init_meta: FactoryInitMeta)
```

Replaces the record. `#[only_owner]` gates the call, so the owner must sign it. The write is a full replacement of all three fields. A call that changes one field carries the current values of the other two.

The new record takes no validation, on the same terms as the constructor. The call emits no event. It extends the instance TTL under the rule in [Storage and TTL](#storage-and-ttl).

Errors: `OwnableError::OwnerNotSet` (2100) if the owner key is absent. If the owner did not authorize the call, the host traps outside the `FactoryError` table.

The new record reaches later deploys only. A deployed market keeps the treasury address its constructor received. The market exposes `get_treasury` and no setter, so no entry point on that code changes it. Its code stays under the market owner, who replaces it through the market's own `upgrade`. The factory holds no authority over a pair once `deploy` returns.

`upgrade` replaces the factory's own WASM and leaves `InitMeta` as it is. After a new market or vault blob is uploaded to the ledger, `set_init_meta` is the call that puts the new hash into future deploys.

## `get_init_meta`

```rust
fn get_init_meta(e: Env) -> FactoryInitMeta
```

Permissionless view. It returns the stored record and raises no contract error. If the key is absent, the call traps. The key is absent only if the constructor never ran. The call extends the instance TTL under the rule in [Storage and TTL](#storage-and-ttl), so it can write as well as read.

## Storage and TTL

| Key | Tier | Type | Written by | Read by |
|---|---|---|---|---|
| `Symbol("InitMeta")` | instance | `FactoryInitMeta` | `__constructor`, `set_init_meta` | `deploy`, `get_init_meta` |

Instance storage carries one TTL for the whole instance. `InitMeta` shares it with `OwnableStorageKey::Owner` and `UpgradeableStorageKey::SchemaVersion`, so the three entries are archived and restored together.

`deploy`, `is_deployed`, and `get_init_meta` call `extend_instance` as their first storage operation. `set_init_meta` calls it first in its body, after the `#[only_owner]` check. `upgrade` calls it after the `#[only_owner]` check and the `operator` equality check. If a call traps, the whole invocation reverts, and an extension that already ran is not committed. A failed call leaves the instance TTL unchanged. If the remaining TTL is below `LEDGER_THRESHOLD_INSTANCE`, `extend_instance` sets the instance TTL to `LEDGER_BUMP_INSTANCE`. Otherwise it leaves the TTL unchanged. The `Ownable` entry points do not extend it.

| Constant | Value | Derivation | Unit and meaning |
|---|---|---|---|
| `ONE_DAY_LEDGERS` | 17280 | assumes about 5 seconds per ledger | ledgers in one day |
| `LEDGER_THRESHOLD_INSTANCE` | 518400 | `ONE_DAY_LEDGERS * 30` | remaining instance TTL in ledgers, about 30 days, below which an entry point extends the instance |
| `LEDGER_BUMP_INSTANCE` | 535680 | `LEDGER_THRESHOLD_INSTANCE + ONE_DAY_LEDGERS` | instance TTL in ledgers after an extension, about 31 days |

## Owner surface

The factory exposes `upgrade` from `Upgradeable`, and `get_owner`, `transfer_ownership`, `accept_ownership`, and `renounce_ownership` from `Ownable`. `FactoryError` declares a single code, `UpgradeNotOwner` (600), which `upgrade` raises. For the signatures, the ownership storage keys, the events, and the full error table, refer to [Ownership and upgrade](../ownership).

After `renounce_ownership`, `set_init_meta` and `upgrade` trap with `OwnableError::OwnerNotSet` (2100) permanently. The factory keeps the last `FactoryInitMeta` it stored and keeps deploying from it. `deploy`, `is_deployed`, and `get_init_meta` stay open.
