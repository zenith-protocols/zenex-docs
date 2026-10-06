---
title: Wallet factory
description: Deterministic smart-account deployment, constructor bindings, address prediction, authorization, and storage.
---

# Wallet factory

`WalletFactoryContract` deploys a smart account from a fixed WebAssembly (WASM) hash. The account's constructor arguments determine its address within the factory's namespace.

## Entry points

```rust
fn __constructor(e: Env, account_wasm_hash: BytesN<32>)

fn deploy(
    e: Env,
    signers: Vec<Signer>,
    policies: Map<Address, Val>,
) -> Address

fn predict_address(
    e: Env,
    signers: Vec<Signer>,
    policies: Map<Address, Val>,
) -> Address
```

| Argument | Meaning |
| --- | --- |
| `account_wasm_hash` | Code hash stored by the constructor and used for every account deployment. |
| `signers` | Smart-account signers, passed unchanged to the account constructor. |
| `policies` | Policy contracts and their installation values, passed unchanged to the account constructor. |
| `e` | Soroban environment, omitted from serialized invocation arguments. |

The factory stores `account_wasm_hash` without checking the ledger. `deploy` needs that code to be uploaded and compatible with the constructor arguments.

## Address derivation

`deploy` and `predict_address` compute the same salt. The input is the XDR encoding of the positional constructor arguments:

```text
constructor_args = Vec<Val>(signers, policies)
salt = sha256(XDR(constructor_args))
```

`constructor_args` holds the two arguments. `XDR` denotes their Stellar External Data Representation encoding. `salt` is the 32-byte SHA-256 result. The host derives the address with `with_current_contract(salt).deployed_address`. The network, factory address, and salt therefore scope the account address. A different signer vector or policy map can produce a different salt. Two factories produce separate namespaces even when they use the same account code.

:::info Prediction does not deploy the account
`predict_address` computes an address without reading the stored code hash. Its result does not establish that an account exists there.
:::

## Authorization and deployment

Any caller can invoke either public entry. The factory performs no `require_auth` check. `deploy` uses the factory as the contract deployer. Its address binds the account constructor arguments through the derived salt. Someone who submits the same arguments first deploys the same configured account. Changing the signer or policy arguments changes the predicted address.

The smart-account constructor owns signer and policy validation. The factory forwards its inputs unchanged and returns the deployed address. A repeat deployment of the same arguments encounters an existing contract and fails. `predict_address` still returns that account's address.

## Errors and events

The factory declares no contract error enum and publishes no events. Host deployment failures and smart-account constructor failures propagate. These include an existing contract at the derived address, missing WASM code, a constructor mismatch, or rejected signer and policy inputs. A failed deployment reverts the account creation and the factory's TTL extension. It does not leave a partially initialized account.

## Storage

| Key | Class | Value | Written by |
| --- | --- | --- | --- |
| `wasm` | Instance | `BytesN<32>` | Constructor |

The constructor leaves the instance TTL unchanged. `deploy` extends it with `TTL_THRESHOLD` of 501120 ledgers and `EXTEND_AMOUNT` of 518400 ledgers. At 17280 ledgers per day, the extension target is approximately 30 days. `predict_address` neither accesses nor extends this storage.

The factory exports no owner, configuration setter, or upgrade entry. The [session-policy reference](./session-policy.md) covers the trading permissions used after account creation.
