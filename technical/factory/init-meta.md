---
title: Init meta and constructor
sidebar_position: 3
---

# Init meta and constructor

This page covers the factory constructor, the `FactoryInitMeta` record, the two entry points that write and read it, the instance key that stores it, and the time to live (TTL) that keeps that key alive.

The factory stores everything a `deploy` needs from its own configuration in one record, `FactoryInitMeta`. The record holds the market WASM hash, the vault WASM hash, and the treasury address. Every `deploy` reads it. The two hashes become the code of the new market and vault pair, and the treasury address goes to the new market's constructor. The record lives in instance storage, not in the factory's code, so the owner can change what future deploys install without a code upgrade. The constructor writes the record once. `set_init_meta` replaces it.

## Constructor

```rust
fn __constructor(e: Env, owner: Address, init_meta: FactoryInitMeta)
```

| Argument | Type | Meaning |
|---|---|---|
| `owner` | `Address` | The factory owner. It signs `set_init_meta` and `upgrade`. |
| `init_meta` | `FactoryInitMeta` | The first deployment record. |

The host runs the constructor once, inside the create-contract call that deploys the factory. The host authorizes that call, so the body performs no authorization check of its own.

The body writes three instance entries, in this order.

1. `set_owner` writes `owner` under `OwnableStorageKey::Owner`.
2. `set_schema_version` writes `1` under `UpgradeableStorageKey::SchemaVersion`.
3. A crate-internal storage helper writes `init_meta` under `Symbol("InitMeta")`. `set_init_meta` uses the same helper and the same key.

If the owner key already exists, `set_owner` traps with `OwnableError::OwnerAlreadySet` (2102). The host runs a constructor once per instance, so a deployed factory never meets that condition.

The constructor stores both hashes and the treasury address as given. It makes no check against the ledger. A hash that names no uploaded blob surfaces as a host failure on the first `deploy` that installs it. The constructor emits no event and does not extend the instance TTL.

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

The call replaces the record in full. Authorization is `#[only_owner]`, so the owner must sign. A change to one field needs a call that carries the current values of the other two.

The body runs in this order.

1. The `#[only_owner]` check reads the owner key and requires the owner's authorization.
2. `extend_instance` runs.
3. The storage helper writes `init_meta` under `Symbol("InitMeta")`.
4. The call publishes `InitMetaUpdate`, described under [Event](#event).

The call stores the record as given and makes no check against the ledger. A hash that names no uploaded blob surfaces as a host failure on the first `deploy` that installs it.

| Condition | Result |
|---|---|
| The owner key is absent | `OwnableError::OwnerNotSet` (2100) |
| The owner did not authorize the call | Host authorization failure, with no contract error code |

The call declares no `FactoryError` code. The new record reaches later deploys only. A deployed market keeps the treasury address that its constructor received, and the market owner controls the market's code through the market's own `upgrade`. The [Deploy page](./deploy.md#the-vault-deploys-first-and-the-market-second) gives the split of authority over a new pair.

The record holds hashes, not code. A new market or vault blob reaches future deploys only when `set_init_meta` stores its hash. A factory `upgrade` leaves `InitMeta` untouched.

## `get_init_meta`

```rust
fn get_init_meta(e: Env) -> FactoryInitMeta
```

Any account may call this view. It extends the instance TTL first and then returns the stored record, so a read can write. The call declares no contract error. If the key is absent, the storage helper traps, which happens only when the constructor never ran.

## Event

`set_init_meta` publishes one event, after the write.

| Event | Topics after the name | Data |
|---|---|---|
| `init_meta_update` | none | map with one field, `init_meta: FactoryInitMeta` |

The first topic is the event name symbol, the `InitMetaUpdate` struct name in lower snake case. The struct declares no `#[topic]` field, so the name is the only topic. The one field sits in the data map under its own name and carries the full replacement record, both hashes and the treasury. The event attests to the hashes because they decide which code every future market runs. The [Deploy page](./deploy.md#event) gives the `deploy` event under the same layout rule.

## Storage and TTL {#storage-and-ttl}

| Key | Tier | Type | Written by | Read by |
|---|---|---|---|---|
| `Symbol("InitMeta")` | instance | `FactoryInitMeta` | `__constructor`, `set_init_meta` | `deploy`, `get_init_meta` |

Instance storage carries one TTL for the whole instance. `InitMeta` shares it with `OwnableStorageKey::Owner` and `UpgradeableStorageKey::SchemaVersion`, so the three entries are archived and restored together.

`extend_instance` compares the remaining instance TTL with `LEDGER_THRESHOLD_INSTANCE`. If the remaining TTL is lower, it sets the TTL to `LEDGER_BUMP_INSTANCE`. Otherwise it changes nothing.

| Constant | Value | Derivation | Unit and meaning |
|---|---|---|---|
| `ONE_DAY_LEDGERS` | 17280 | assumes about 5 seconds per ledger | ledgers in one day |
| `LEDGER_THRESHOLD_INSTANCE` | 518400 | `ONE_DAY_LEDGERS * 30` | remaining instance TTL in ledgers, about 30 days, below which an entry point extends the instance |
| `LEDGER_BUMP_INSTANCE` | 535680 | `LEDGER_THRESHOLD_INSTANCE + ONE_DAY_LEDGERS` | instance TTL in ledgers after an extension, about 31 days |

Each entry point calls `extend_instance` at a fixed point.

| Entry point | Position of `extend_instance` |
|---|---|
| `deploy` | After `admin` authorizes, before the first storage read |
| `is_deployed` | First storage operation |
| `get_init_meta` | First storage operation |
| `set_init_meta` | After the `#[only_owner]` check, before the write |
| `upgrade` | After the `#[only_owner]` check and the `operator` equality check |

The `Ownable` entry points never extend the instance. A call that traps reverts the whole invocation, so an extension that already ran is not committed and the TTL stays as it was.

## The owner controls two entry points {#owner-surface}

The factory exposes `upgrade` from `Upgradeable`, and `get_owner`, `transfer_ownership`, `accept_ownership`, and `renounce_ownership` from `Ownable`. `set_init_meta` and `upgrade` carry `#[only_owner]`.

The factory `upgrade` has the same body as the market `upgrade`. The [market dependency page](../market/dependencies.md#ownership-and-upgrade) gives the signatures, the transfer rule, and the `operator` check that raises `UpgradeNotOwner` (600). That code is the only variant of `FactoryError`. On the factory, `upgrade` replaces the factory's own WASM and keeps storage as it is. The [Ownable codes](../market/errors.md#ownable-codes) and the [ownership events](../market/events.md#ownership-events) are on the market pages. The factory publishes the same three ownership events from its own address.

After `renounce_ownership`, `set_init_meta` and `upgrade` trap with `OwnableError::OwnerNotSet` (2100) permanently. The factory keeps the last `FactoryInitMeta` it stored and keeps deploying from it. `deploy`, `is_deployed`, and `get_init_meta` stay open to every caller. From that point the code that new markets install and the treasury they receive are fixed for the life of the factory.
