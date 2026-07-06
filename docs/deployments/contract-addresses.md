---
sidebar_position: 1
title: Contract Addresses
---

# Contract Addresses

Zenex contracts are deployed through the factory contract, which deterministically computes addresses for each trading and vault pair. This means that given the same deployment parameters (salt, admin address, and factory address), the resulting contract addresses are predictable before the deployment transaction is submitted. Integrators can verify any trading contract's legitimacy by calling `is_deployed(address)` on the factory, which returns `true` for every address the factory has deployed.

## Address Derivation

The factory uses Soroban's `deployer().with_current_contract(salt).deployed_address()` to precompute both the trading and vault addresses before either contract is instantiated. The user provides a `salt: BytesN<32>` which is used directly for the trading contract. The vault salt is derived by XORing the last byte: `salt[31] ^= 1`. No hashing or admin address is mixed into the salt. The two salts differ by exactly one bit, producing two distinct but deterministic addresses from the same user input.

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

These addresses will be populated after the current testnet deployment cycle is finalized. Check the project's `.dev-env.toml` or deployment scripts for the latest values.

## Mainnet

Mainnet deployment details will be added after launch. The same factory-based deployment model will be used, and addresses will be deterministic given the mainnet factory address and deployment parameters.

## Verifying Deployed Contracts

The factory serves as the canonical registry for all legitimately deployed trading contracts. To verify that a given address is an authentic Zenex trading contract, call the factory's `is_deployed(trading)` function. It returns `true` if the address was deployed through that factory instance and `false` otherwise. Only trading contract addresses are registered in the factory. Vault addresses are not tracked directly, but each trading contract stores its paired vault address, which can be retrieved through the trading contract's configuration.

Discovery of deployed pools relies on indexing the `Deploy` events emitted by the factory at deployment time, since the factory contract itself exposes no enumeration function to list them.

## WASM Hash Immutability

The WASM hashes stored in the factory at construction time cannot be changed. This is an intentional security property: it guarantees that every pool deployed by a given factory runs the same audited code. If a security fix or feature upgrade is needed, a new factory must be deployed with the updated WASM hashes. Existing pools deployed by the old factory continue running their original code. Only trading and governance contracts are upgradeable (via their owner-only `upgrade` function). Vault, factory, treasury, and price-verifier contracts are not upgradeable.
