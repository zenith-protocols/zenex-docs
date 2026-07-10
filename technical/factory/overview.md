---
sidebar_position: 1
title: Factory Overview
---

# Factory Contract

The factory deploys a trading contract and its strategy vault as an atomic pair, with deterministic addresses. It stores the two WASM hashes and the protocol treasury address at construction. Once deployed, these values cannot be changed.

## Constructor

```rust
__constructor(init_meta: FactoryInitMeta)
```

`FactoryInitMeta` has three fields:

| Field | Type | Description |
|---|---|---|
| `trading_hash` | `BytesN<32>` | WASM hash for trading contracts |
| `vault_hash` | `BytesN<32>` | WASM hash for vault contracts |
| `treasury` | `Address` | Protocol-wide treasury address |

These values are **immutable**. There are no setters. Applying a security fix or a logic change to the trading or vault WASM means deploying a new factory with updated hashes. Pairs from the old factory keep running the original code.

## Deployment Flow

```rust
deploy(
    admin,
    salt,
    token,
    price_verifier,
    feed_id,
    exponent,
    config,
    vault_name,
    vault_symbol,
    vault_decimals_offset,
) -> Address
```

`deploy` first requires `admin` to authorize the call. Any address can be the admin of a new pair, but it must explicitly authorize both deployments and becomes the owner of the new trading contract.

Because one contract is one market, the market is fully described by the deploy arguments, and deployment itself is the registration step: `token` is the settlement collateral, `(feed_id, exponent)` are the immutable oracle anchors, `config` is the complete trading configuration, and `vault_decimals_offset` sets the vault's extra share decimals, an inflation-attack mitigation. The factory declares its own `Config` type mirroring the trading contract's, with identical fields and XDR encoding, so the deploy argument matches what the trading constructor decodes.

The vault salt is derived from the trading salt by flipping the low bit of the last byte (`salt[31] ^= 1`), producing a distinct but deterministic vault salt. Both addresses are precomputed from the **admin** (not the factory) via `deployer().with_address(admin, salt).deployed_address()`, so each contract can receive the other's address during its own construction, and a salt alone cannot be front-run: the host requires `admin` to authorize each deployment.

The ordering resolves the circular dependency between the two contracts without a post-deployment linking step:

1. The **vault** is deployed first, receiving the precomputed trading address as its immutable `strategy`. Its constructor does not call trading.
2. The **trading** contract is deployed second, receiving the live vault address plus the treasury from `FactoryInitMeta`, and the `(feed_id, exponent, config)` market parameters.

The vault is thus registered as the trading contract's collateral vault, and the trading contract as the vault's immutable strategy. After both are live, the factory records the trading address in persistent storage and emits `Deploy` with `trading` and `vault` both as topics and no data payload.

`deploy` returns the new trading contract address. The vault address is not returned. Recover it from the `Deploy` event, by re-deriving the vault salt under the admin's deployer address, or by calling `get_vault` on the trading contract.

## Errors

The factory defines no error enum of its own. `deploy` propagates the trading constructor's validation: `InvalidConfig` if `exponent` is outside `-18..=0` or `config` fails its bounds checks, and `NegativeValueNotAllowed` if a rate, fee, or margin is negative. Reusing an `(admin, salt)` pair fails at the host level because the contract address already exists.

## Registry

`is_deployed(trading) -> bool` is a permissionless existence check, and only trading addresses are registered this way (the paired vault address is looked up through the trading contract, not the factory). Discovering the full set of deployed pairs means indexing the `Deploy` event log rather than querying the factory itself.

The factory holds two kinds of storage:

| Key | Kind | Value | TTL policy |
|---|---|---|---|
| `Symbol "InitMeta"` | instance | `FactoryInitMeta` | threshold 518,400 ledgers (about 30 days at 5s per ledger), bump to 535,680 (about 31 days) |
| `FactoryDataKey::Pools(Address)` | persistent | `bool` | threshold 1,728,000 ledgers (about 100 days), bump to 2,073,600 (about 120 days) |

A registry entry's TTL is extended when it is written and on every successful `is_deployed` hit. Both `deploy` and `is_deployed` also extend the factory instance TTL on every call, so the otherwise read-only `is_deployed` has TTL-extension side effects.

## Access Control

The factory has **no owner**. The constructor runs once, and no administrative functions exist after that.

- `deploy` requires the `admin` parameter to authenticate. Any address can be the admin of a new pair.
- `is_deployed` is fully permissionless.

Because the WASM hashes have no setters, every pair a given factory deploys runs the same trading and vault code.
