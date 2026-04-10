---
sidebar_position: 2
title: Deployment Parameters
---

# Deployment Parameters

Every Zenex deployment is configured through a set of constructor parameters that define the protocol's fee structure, risk limits, oracle settings, and vault behavior. These parameters are typically defined in `zenex-utils/deploy.json`, which serves as the single source of truth for deployment configuration. Before executing any deployment, operators must review the contents of this file and confirm that all values are correct. Fee rates, leverage limits, and market parameters are critical to protocol safety and should be verified every time.

## Factory

The factory is the entry point for deploying new trading and vault pairs. Its constructor accepts a single `FactoryInitMeta` struct.

| Parameter | Type | Description |
|---|---|---|
| `trading_hash` | `BytesN<32>` | Compiled WASM hash for trading contracts |
| `vault_hash` | `BytesN<32>` | Compiled WASM hash for vault contracts |
| `treasury` | `Address` | Protocol-wide treasury contract address |

These values are immutable after construction. The WASM hashes determine which contract code every pool will run. The treasury address determines where protocol fees are routed. Changing any of these requires deploying a new factory entirely.

## Trading Contract

The trading contract is deployed through the factory's `deploy` function, which passes the following parameters to the trading constructor.

| Parameter | Type | Description |
|---|---|---|
| `owner` | `Address` | Admin address with permission to configure markets and parameters |
| `token` | `Address` | SEP-41 collateral token (e.g., USDC) |
| `vault` | `Address` | Paired strategy vault (precomputed by factory) |
| `price_verifier` | `Address` | Pyth Lazer price verification contract |
| `treasury` | `Address` | Protocol treasury (inherited from factory) |
| `config` | `TradingConfig` | Global trading configuration (see below) |

The `TradingConfig` struct contains the global fee, rate, and limit parameters that apply across all markets.

| Field | Scale | Description |
|---|---|---|
| `caller_rate` | SCALAR_7 | Keeper's share of trading fees, 0 to 50% |
| `min_notional` | token decimals | Minimum notional size per position |
| `max_notional` | token decimals | Maximum notional size per position |
| `fee_dom` | SCALAR_7 | Trading fee rate for the dominant side |
| `fee_non_dom` | SCALAR_7 | Trading fee rate for the minority side |
| `max_util` | SCALAR_7 | Global utilization cap (total_notional / vault_balance) |
| `r_funding` | SCALAR_18 | Base hourly funding rate |
| `r_base` | SCALAR_18 | Base hourly borrowing rate |
| `r_var` | SCALAR_18 | Vault-level variable borrowing rate at full utilization |

All rate parameters have upper bounds enforced by the constructor validation. Misconfigured values (such as `fee_dom < fee_non_dom` or `min_notional > max_notional`) will cause the deployment to fail.

## Strategy Vault

The vault is also deployed through the factory, receiving its parameters from the same `deploy` call.

| Parameter | Type | Description |
|---|---|---|
| `name` | `String` | Vault share token name (e.g., "Zenex USDC Vault") |
| `symbol` | `String` | Vault share token symbol (e.g., "zUSDC") |
| `asset` | `Address` | Underlying collateral token (same as trading's `token`) |
| `decimals_offset` | `u32` | Offset added to token decimals for share token precision |
| `strategy` | `Address` | Authorized trading contract (precomputed by factory) |
| `lock_time` | `u64` | Minimum seconds between deposit and withdrawal |

The `strategy` parameter is the only address authorized to call `strategy_withdraw` on the vault. This is set to the precomputed trading contract address, which the factory calculates before either contract exists. The `lock_time` prevents depositors from front-running profitable trades by depositing just before a large trader loss and withdrawing immediately after.

## Price Verifier

The price verifier is deployed independently (not through the factory) and shared across multiple trading contracts if desired.

| Parameter | Type | Description |
|---|---|---|
| `owner` | `Address` | Admin address for configuration updates |
| `trusted_signer` | `BytesN<32>` | Ed25519 public key of the Pyth Lazer signer |
| `max_confidence_bps` | `u32` | Maximum allowed confidence interval in basis points |
| `max_staleness` | `u64` | Maximum age of a price update in seconds |

The `trusted_signer` is the public key used to verify Ed25519 signatures on Pyth Lazer price payloads. The `max_confidence_bps` parameter rejects prices whose confidence interval exceeds the threshold, preventing the protocol from accepting highly uncertain oracle data. The `max_staleness` parameter rejects prices that are too old, ensuring the protocol operates on recent market data.

## Treasury

The treasury is also deployed independently and referenced by the factory.

| Parameter | Type | Description |
|---|---|---|
| `owner` | `Address` | Admin with permission to adjust rate and withdraw funds |
| `rate` | `i128` (SCALAR_7) | Fraction of protocol fees directed to treasury |

The treasury rate determines what percentage of protocol revenue (base fees, impact fees, and borrowing fees) is retained by the protocol versus flowing to vault depositors. A rate of `1_000_000` (10% in SCALAR_7) means the treasury keeps 10% of all protocol fees. This rate can be adjusted after deployment by the treasury owner via `set_rate`.

## Governance

The governance contract is an optional timelock proxy deployed independently and assigned as the owner of a trading contract.

| Parameter | Type | Description |
|---|---|---|
| `owner` | `Address` | Admin who can queue parameter changes |
| `delay` | `u64` | Minimum seconds between queuing and executing a change |

The `delay` must be non-zero and at most 60 days (`60 * 24 * 3600` seconds). Values outside this range cause the constructor to panic with `InvalidDelay`.

The delay parameter enforces a timelock on all configuration updates. When the owner queues a parameter change (such as updating `TradingConfig` or a `MarketConfig`), it specifies the `target` contract address at call time. The change cannot be executed until `delay` seconds have passed. This gives traders and LPs time to react to upcoming parameter changes. The `set_status` function is exempt from the timelock, allowing immediate emergency pauses.

## Circular Dependency Resolution

The factory resolves a fundamental circular dependency between the trading contract and the vault. The trading contract needs the vault address at construction (to call `total_assets` and `strategy_withdraw`), while the vault needs the trading address at construction (to authorize `strategy_withdraw` calls from the trading contract).

The factory solves this by precomputing both addresses using deterministic salt derivation before deploying either contract. The vault is deployed first with the precomputed trading address as its `strategy`. The trading contract is deployed second with the precomputed vault address. No post-deployment linking or initialization step is required. Both contracts are fully configured from the moment they are instantiated.
