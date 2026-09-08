---
title: Ownership and upgrade
sidebar_position: 3
---

# Ownership and upgrade

The market, oracle, factory, treasury, and governance contracts each have one owner, an address set by the constructor. Each of the five mixes in the `Ownable` trait from `stellar-access` 0.7.2 and gates its owner-only entries with `#[only_owner]` from `stellar-macros` 0.7.2. The market, oracle, and factory also implement `Upgradeable` from `stellar-contract-utils` 0.7.2 and expose `upgrade`. The surface is the same on every contract that carries it, so this page is its home. The per-contract sections name their owner-only entries and link here.

## Owner check

Every `#[only_owner]` entry runs `enforce_owner_auth` as its first statement, before the body. `enforce_owner_auth` reads `OwnableStorageKey::Owner` from instance storage. If the key is absent, the call traps with `OwnerNotSet` (2100). Otherwise it calls `require_auth` on the stored owner. A call signed by any other account fails host authorization and carries no contract error code. Because the check runs first, 2100 precedes every other error the entry can raise.

The constructor sets the owner through `set_owner`. If `OwnableStorageKey::Owner` exists, `set_owner` traps with `OwnerAlreadySet` (2102). A constructor runs on a fresh instance, so 2102 is unreachable there. After deploy, `accept_ownership` is the only call that sets the owner key.

A contract can be the owner. One such owner is the [governance contract](./governance/overview). When it owns a market, a call forwarded by `execute` runs with the governance contract as the invoker. That satisfies `require_auth` on the owner. A queued `upgrade` names the governance contract as `operator`.

## Ownable surface

```rust
fn get_owner(e: &Env) -> Option<Address>
fn transfer_ownership(e: &Env, new_owner: Address, live_until_ledger: u32)
fn accept_ownership(e: &Env)
fn renounce_ownership(e: &Env)
```

### `get_owner`

Permissionless view. Returns `Some(owner)` while an owner is set and `None` after `renounce_ownership`. Raises no error.

### `transfer_ownership`

Starts or cancels a two-step transfer. The current owner must sign. `live_until_ledger` is a ledger sequence number, the last ledger at which `accept_ownership` succeeds.

If `live_until_ledger` is above `0`, the call writes `PendingTransfer { address: new_owner, live_until_ledger }` under `OwnableStorageKey::PendingOwner` in temporary storage. The call then extends the time to live (TTL) of that entry to `live_until_ledger` minus the current ledger sequence. The current ledger sequence is the sequence number of the ledger that runs the call. The extension runs only when the remaining TTL is below that value. The extension is a floor. The network minimum temporary TTL can keep the entry alive past it. A second call overwrites the pending entry in place. The owner uses that to extend the window or to name a different account. The current owner keeps every privilege until the pending owner accepts.

If `live_until_ledger` is `0`, the call cancels the pending transfer. It reads the pending entry, checks that `pending.address` equals `new_owner`, and removes the entry.

Errors. The owner check runs first on both paths. The remaining checks differ by path, so one call reaches only one of the two groups:

- Both paths: `OwnerNotSet` (2100) when the owner key is absent.
- Cancel path, `live_until_ledger` at `0`, in check order: `NoPendingTransfer` (2200) when no pending entry exists, then `InvalidPendingAccount` (2202) when `new_owner` differs from `pending.address`.
- Start path, `live_until_ledger` above `0`: `InvalidLiveUntilLedger` (2201) when `live_until_ledger` is below the current ledger sequence or above `max_live_until_ledger`.

`max_live_until_ledger` is the highest ledger sequence a ledger entry can live to. The host derives it from the current ledger sequence and the network limit on entry TTL, so the bound is a ledger sequence and not a count of ledgers.

Both paths emit `ownership_transfer`. On the cancel path the event carries `live_until_ledger` equal to `0`.

### `accept_ownership`

Completes the transfer. The pending owner must sign. The call reads `OwnableStorageKey::PendingOwner`. If the entry is absent, the call traps with `NoPendingTransfer` (2200). If the current ledger sequence is above `pending.live_until_ledger`, the call traps with `TransferExpired` (2203). The deadline check reads the stored `live_until_ledger` field. A TTL extension can hold the entry in the ledger past that value, and the call still traps with 2203. The call then needs `pending.address` to authorize, removes the pending entry, and writes `pending.address` to `OwnableStorageKey::Owner`. It emits `ownership_transfer_completed`.

### `renounce_ownership`

Removes the owner permanently. The current owner must sign. If an unexpired pending transfer exists, the call traps with `TransferInProgress` (2101). An expired pending entry counts as absent, and the check removes it. On success the call removes `OwnableStorageKey::Owner` and emits `ownership_renounced`. From then on every `#[only_owner]` entry on that contract traps with `OwnerNotSet` (2100), and so do `transfer_ownership` and `renounce_ownership`. No call can set an owner again. The table under [Per contract](#per-contract) lists what stops on each contract.

Errors: `OwnerNotSet` (2100), `TransferInProgress` (2101).

## Upgrade

```rust
fn upgrade(e: &Env, new_wasm_hash: BytesN<32>, operator: Address)
```

The market, the oracle, and the factory implement `upgrade`. `Upgradeable` carries no default body, so each of the three writes its own, and the three bodies do the same work.

`#[only_owner]` gates the call, so the owner must sign. `operator` must equal the stored owner, or the call traps with `UpgradeNotOwner` (600). The body compares `operator` against the address that `get_owner` returns. The owner's signature is the only authorization the call needs. After the check, the call extends the instance TTL and replaces the contract WebAssembly (WASM) with the blob whose hash is `new_wasm_hash`. The extension sets the instance TTL to 535680 ledgers, about 31 days, when the remaining TTL is below 518400 ledgers, about 30 days. The blob must be uploaded to the ledger before the call. The new code takes effect after the invocation completes.

Storage is kept as is. Every instance, persistent, and temporary entry survives the upgrade unchanged, and no migration runs. The market, oracle, and factory constructors stamp `UpgradeableStorageKey::SchemaVersion` with `1`, and `upgrade` leaves it at `1`. The stamp lets a later migration tell schema version 1 from an unset key, which reads as `0`. Ledger inspection is the way to read the value, because no entry point returns it.

Errors, in check order: `OwnerNotSet` (2100), host authorization failure, then `UpgradeNotOwner` (600). `MarketError`, `OracleError`, and `FactoryError` each declare their own `UpgradeNotOwner` variant at code 600.

On the factory, `upgrade` replaces the factory's own code. The WASM hashes that future deploys install live in `FactoryInitMeta`, and only `set_init_meta` changes them. For that call, refer to [Init meta and constructor](./factory/init-meta).

## Storage

| Key | Tier | Type | Written by | Read by |
|---|---|---|---|---|
| `OwnableStorageKey::Owner` | instance | `Address` | constructor through `set_owner`, `accept_ownership`, `renounce_ownership` on removal | `get_owner`, every `#[only_owner]` entry, `transfer_ownership`, `renounce_ownership` |
| `OwnableStorageKey::PendingOwner` | temporary | `PendingTransfer` | `transfer_ownership` on the start path, `transfer_ownership` on the cancel path and `accept_ownership` on removal, `renounce_ownership` on removal of an expired entry | `transfer_ownership` on the cancel path, `accept_ownership`, `renounce_ownership` |
| `UpgradeableStorageKey::SchemaVersion` | instance | `u32` | constructor of market, oracle, and factory, value `1` | ledger inspection only |

```rust
#[contracttype]
pub struct PendingTransfer {
    pub address: Address,       // the proposed owner
    pub live_until_ledger: u32, // last ledger sequence at which accept_ownership succeeds
}
```

`PendingOwner` carries the TTL that `transfer_ownership` sets, under the rule given for that call. `Owner` and `SchemaVersion` share the instance TTL. On the market, the oracle, and the governance contract, the entries that change state extend that TTL. The view entries on those three do not. On the factory and the treasury, every entry of the `Factory` and `Treasury` traits extends it, views included. Three constructors extend it, on the market, the oracle, and the governance contract. The four Ownable entries extend it on none of the five contracts.

## Events

```rust
#[contractevent]
pub struct OwnershipTransfer {
    pub old_owner: Address,
    pub new_owner: Address,
    pub live_until_ledger: u32, // 0 on a cancel
}

#[contractevent]
pub struct OwnershipTransferCompleted {
    pub new_owner: Address,
}

#[contractevent]
pub struct OwnershipRenounced {
    pub old_owner: Address,
}
```

The topic symbols are `ownership_transfer`, `ownership_transfer_completed`, and `ownership_renounced`. Each event carries one topic, the name symbol. No field is a `#[topic]`, so every field sits in the data map under the layout rule on [Events](./market/events). The emitter is the contract whose owner changed.

## Errors

Codes 2100 to 2102 are `OwnableError` and codes 2200 to 2203 are `RoleTransferError`, both from `stellar-access` 0.7.2. The codes are the same on every contract.

| Code | Name | Raised by | Condition |
|---|---|---|---|
| 600 | `UpgradeNotOwner` | `upgrade` | `operator` differs from the stored owner |
| 2100 | `OwnerNotSet` | every `#[only_owner]` entry, `transfer_ownership`, `renounce_ownership`, `upgrade` | the owner key is absent |
| 2101 | `TransferInProgress` | `renounce_ownership` | an unexpired pending transfer exists |
| 2102 | `OwnerAlreadySet` | constructor | the owner key exists, which a constructor on a fresh instance never meets |
| 2200 | `NoPendingTransfer` | `transfer_ownership` with `0`, `accept_ownership` | no pending entry exists |
| 2201 | `InvalidLiveUntilLedger` | `transfer_ownership` with a value above `0` | `live_until_ledger` is below the current ledger sequence or above `max_live_until_ledger` |
| 2202 | `InvalidPendingAccount` | `transfer_ownership` with `0` | `new_owner` differs from `pending.address` |
| 2203 | `TransferExpired` | `accept_ownership` | the current ledger sequence is above `pending.live_until_ledger` |

## Per contract

| Contract | `#[only_owner]` entries | Exposes `upgrade` | Stays open after `renounce_ownership` |
|---|---|---|---|
| [Market](./market/overview) | `set_config`, `set_status`, `set_terminal_price`, `upgrade` | yes | the views, plus the trader and keeper entries the status allows |
| [Oracle](./oracle/overview) | `update_staleness`, `update_spread_reduction_factor`, `upgrade` | yes | `verify_price` and the views |
| [Factory](./factory/overview) | `set_init_meta`, `upgrade` | yes | `deploy`, `is_deployed`, `get_init_meta` |
| [Treasury](./treasury/overview) | `set_rate`, `withdraw` | no | `get_rate` |
| [Governance](./governance/overview) | `queue`, `cancel`, `set_status`, `set_delay` | no | `execute`, `apply_delay`, `get_delay`, `get_queued` |

A renounce stops the `#[only_owner]` entries of the row, plus `transfer_ownership` and `renounce_ownership`. It is irreversible on every contract. **On the treasury it locks the balance permanently, because `withdraw` is the only outflow.** **On the market it locks the status value, because `set_status` is the only entry that changes it.** A market renounced while `Frozen` stays frozen, and no trader or keeper entry runs again. A market renounced while `Delisted` freezes its terminal price. Settlement uses the value stored before the renounce, and `set_terminal_price` stops, so no new value can be set. For the entries each status allows, refer to [Market status](./market/status). On the governance contract, a call queued before the renounce stays executable through `execute`. A delay change queued before it stays applicable through `apply_delay`.
