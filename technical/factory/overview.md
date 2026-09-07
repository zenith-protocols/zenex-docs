---
sidebar_position: 1
title: Factory Overview
---

# Factory Contract

The factory deploys a market contract and its strategy vault as an atomic pair, with deterministic addresses. It stores the two WASM hashes and the protocol treasury address that future deploys use, and its owner can replace them.

## Constructor

```rust
__constructor(owner: Address, init_meta: FactoryInitMeta)
```

`owner` controls `set_init_meta` and `upgrade`, and nothing else. `FactoryInitMeta` has three fields:

| Field | Type | Description |
|---|---|---|
| `market_hash` | `BytesN<32>` | WASM hash for market contracts |
| `vault_hash` | `BytesN<32>` | WASM hash for vault contracts |
| `treasury` | `Address` | Protocol-wide treasury address |

These values are **owner-replaceable** through `set_init_meta(init_meta)`, which swaps the WASM hashes and treasury that future deploys install. The hashes live in instance storage, not in code, so upgrading the factory's own WASM does not refresh them: after a market or vault upgrade, `set_init_meta` is what stops new markets deploying superseded code. Already-deployed pairs are untouched either way — each market owns its own upgrade authority from birth (see [Access Control](#access-control)). `get_init_meta` reads the current values permissionlessly.

Deploying through the factory therefore trusts the factory owner for the code you get at deploy time, and nothing after that.

## Deployment Flow

```rust
deploy(
    admin,
    salt,
    token,
    oracle,
    feed_id,
    config,
    vault_name,
    vault_symbol,
    vault_decimals_offset,
) -> (Address, Address)
```

`deploy` first requires `admin` to authorize the call. Any address can be the admin of a new pair, but it must explicitly authorize both deployments and becomes the owner of the new market contract.

Because one contract is one market, the market is fully described by the deploy arguments, and deployment itself is the registration step: `token` is the settlement collateral, `oracle` and `feed_id` are the immutable price anchors, `config` is the complete market configuration, and `vault_decimals_offset` sets the vault's extra share decimals, an inflation-attack mitigation. The factory declares its own `Config` type mirroring the market contract's, with identical fields and XDR encoding, so the deploy argument matches what the market constructor decodes.

The vault salt is `sha256(salt || "vault")`, domain-separated from the market salt so no deployer-chosen salt can alias a derived one. Both addresses are precomputed from the **admin** (not the factory) via `deployer().with_address(admin, salt).deployed_address()`, so each contract can receive the other's address during its own construction, and a salt alone cannot be front-run: the host requires `admin` to authorize each deployment.

The ordering resolves the circular dependency between the two contracts without a post-deployment linking step:

1. The **vault** is deployed first, receiving the precomputed market address as its immutable `strategy`. Its constructor does not call the market.
2. The **market** contract is deployed second, receiving the live vault address plus the treasury from `FactoryInitMeta`, and the `(oracle, feed_id, config)` market parameters.

The vault is thus registered as the market contract's collateral vault, and the market contract as the vault's immutable strategy. After both are live, the factory records the market address in persistent storage and emits `Deploy` with `trading` and `vault` both as topics and no data payload. (The `trading` topic keeps its pre-rename name on purpose: topic names are part of the emitted event, and indexers decode historical `Deploy` events by them.)

`deploy` returns the `(market, vault)` address pair. Only the market address is recorded in factory storage, so the vault address is otherwise recovered from the `Deploy` event, by re-deriving the vault salt under the admin's deployer address, or by calling `get_vault` on the market contract.

## Errors

The factory defines no error enum of its own. `deploy` propagates the market constructor's validation: `InvalidConfig` if `feed_id` is not a V3 stream id (its first two bytes must be `0x00 0x03`) or `config` fails its bounds checks, and `NegativeValueNotAllowed` if a rate, fee, or margin is negative. Reusing an `(admin, salt)` pair fails at the host level because the contract address already exists.

## Registry

`is_deployed(market) -> bool` is a permissionless existence check, and only market addresses are registered this way (the paired vault address is looked up through the market contract, not the factory). Discovering the full set of deployed pairs means indexing the `Deploy` event log rather than querying the factory itself.

The factory holds two kinds of storage:

| Key | Kind | Value | TTL policy |
|---|---|---|---|
| `Symbol "InitMeta"` | instance | `FactoryInitMeta` | threshold 518,400 ledgers (about 30 days at 5s per ledger), bump to 535,680 (about 31 days) |
| `FactoryDataKey::Pools(Address)` | persistent | `bool` | threshold 1,728,000 ledgers (about 100 days), bump to 2,073,600 (about 120 days) |

A registry entry's TTL is extended when it is written and on every successful `is_deployed` hit. Both `deploy` and `is_deployed` also extend the factory instance TTL on every call, so the otherwise read-only `is_deployed` has TTL-extension side effects.

## Access Control

The factory has an **owner**, set in the constructor, whose surface is exactly two entry points: `set_init_meta`, which changes what future deploys install, and `upgrade`, which replaces the factory's own WASM (both `#[only_owner]`, with the OpenZeppelin Ownable transfer surface alongside). `deploy` itself stays permissionless.

- `deploy` requires the `admin` parameter to authenticate. Any address can be the admin of a new pair, and it becomes the owner of the new market contract.
- `is_deployed` and `get_init_meta` are fully permissionless.

The owner never touches deployed pairs: a market's own owner (the `admin` passed to `deploy`) holds that market's configuration and upgrade authority from birth. A wrong `operator` on `upgrade` raises `UpgradeNotOwner` (600), the error code shared by every upgradeable Zenex contract.
