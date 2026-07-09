---
sidebar_position: 1
title: Contract Addresses
---

# Contract Addresses

Zenex contracts are deployed through the factory contract, which deterministically computes addresses for each trading and vault pair. This means that given the same admin address and salt, the resulting contract addresses are predictable before the deployment transaction is submitted. Integrators can verify any trading contract's legitimacy by calling `is_deployed` on the factory, which returns `true` for every trading contract address the factory has deployed.

## Address Derivation

The factory uses Soroban's `with_address` deployer to precompute both the trading and vault addresses before either contract is instantiated. Each address is derived from the admin's address and a salt, not from the factory contract itself, so the same admin and salt always produce the same pair of addresses regardless of which factory instance is asked to deploy them. Soroban also requires the address passed to `with_address` to authorize the call, so the admin's own signature is what unlocks a deployment at a given address. A salt alone cannot be front-run by another caller. The caller provides a `salt: BytesN<32>`, used directly for the trading address. The vault salt is derived by XORing the last byte: `salt[31] ^= 1`. No hashing is applied to either salt. The two salts differ by exactly one bit, producing two distinct but deterministic addresses from the same admin and salt.

Because the WASM hashes are immutable within a factory instance (set at construction and never modifiable), every pool deployed by the same factory runs identical contract code. A new factory must be deployed to use updated WASM.

## Testnet

The following contracts are deployed on Stellar testnet (`https://soroban-testnet.stellar.org`).

| Contract | Address | Notes |
|---|---|---|
| Factory | _TBD_ | Canonical deployment registry |
| Trading | _TBD_ | Deployed via factory |
| Strategy Vault | _TBD_ | Deployed via factory (paired with trading) |
| Price Verifier | _TBD_ | Pyth Lazer oracle verification |
| Treasury | _TBD_ | Protocol fee accumulator |
| Governance | _TBD_ | Timelock proxy for parameter updates |
| Trading Router | _TBD_ | Stateless call router for batched and atomic flows |

These addresses will be populated after the current testnet deployment cycle is finalized.

## Mainnet

Mainnet deployment details will be added after launch. The same factory-based deployment model will be used, and addresses will be deterministic given the admin address and salt used for each deployment.

## Verifying Deployed Contracts

The factory serves as the canonical registry for all legitimately deployed trading contracts. To verify that a given address is an authentic Zenex trading contract, call the factory's `is_deployed` function with the trading address. It returns `true` if the address was deployed through that factory instance and `false` otherwise. Only trading contract addresses are registered in the factory. Vault addresses are not tracked directly, but each trading contract stores its paired vault address, readable through the trading contract's `get_vault` function.

Discovery of deployed pools relies on indexing the `Deploy` events emitted by the factory at deployment time, since the factory contract itself exposes no enumeration function to list them.

## WASM Hash Immutability

The WASM hashes stored in the factory at construction time cannot be changed. This is an intentional security property: it guarantees that every pool deployed by a given factory runs the same audited code. If a security fix or feature upgrade is needed, a new factory must be deployed with the updated WASM hashes. Existing pools deployed by the old factory continue running their original code.

No Zenex contract exposes an upgrade function. Trading, vault, factory, treasury, price-verifier, governance, and the trading router are all immutable once deployed. A logic change to any of them means deploying a fresh instance, and for a market, that means a fresh trading contract and vault pair through a new (or the existing) factory.
