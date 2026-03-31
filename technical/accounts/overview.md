---
sidebar_position: 1
title: Account Contract
---

# Account Contract (ZenexAccount)

The `ZenexAccount` is a multi-signer smart account built on [OpenZeppelin Stellar Accounts](https://github.com/OpenZeppelin/stellar-contracts/tree/main/contracts/accounts). It replaces Stellar's default single-key authorization model with configurable context rules, multiple signers, and policy-based access control.

For standard account framework behavior (signer management, authentication flow, session handling), refer to the [OpenZeppelin Stellar Accounts documentation](https://github.com/OpenZeppelin/stellar-contracts/tree/main/contracts/accounts).

This page documents the Zenex account configuration and the context rule system.

## Context Rules

A context rule defines who can authorize a transaction and under what conditions. Each rule specifies a context type, a set of signers, an optional expiration, and optional policy contracts.

### Context Types

| Type | Scope | Use Case |
|---|---|---|
| `Default` | All transactions | General-purpose account authorization |
| `CallContract(Address)` | Transactions calling a specific contract | Scoped access to a single protocol contract |
| `CreateContract(BytesN<32>)` | Transactions deploying a specific WASM hash | Scoped deployment authorization |

When the account receives an authentication request, it matches the transaction context against registered rules. A `CallContract` rule only activates for calls to the specified address. A `CreateContract` rule only activates for deployments of the specified WASM. If no specific rule matches, the `Default` rule applies.

### Signers

Each context rule supports up to **15 signers**. A signer is a reference to an external verifier contract (see [Verifiers](./verifiers.md)) paired with a public key or credential identifier. During authentication, the account iterates the rule's signer list and attempts verification against the provided signature. Any single valid signer satisfies the requirement.

### Rule Expiration

Every context rule carries a `valid_until` field representing a ledger sequence number. Once the current ledger sequence exceeds `valid_until`, the rule is considered expired and will not authorize transactions. Setting `valid_until` to a sufficiently large value effectively makes the rule permanent.

This mechanism enables time-bounded delegation. An operator can be granted `CallContract` access to the trading contract that automatically expires after a known ledger range, with no revocation transaction required.

### Policy Contracts

Each context rule can reference up to **5 policy contracts**. Policy contracts provide additional authorization logic that runs after signer verification succeeds. All attached policies must approve the transaction for authorization to complete.

Policies enable constraints such as spending limits, rate limiting, or allowlisted function selectors without modifying the core account contract.

## Execute Forwarding

The account exposes an `execute` function for making contract calls through the account:

```rust
fn execute(env: Env, target: Address, target_fn: Symbol, target_args: Vec<Val>);
```

This is the standard entry point for all contract interactions initiated by the account. The account authenticates the caller against its context rules, then forwards the call to the target contract. The target sees the account address as the caller, enabling the account to hold positions, deposit into vaults, and interact with any Soroban contract.

## Limits

| Parameter | Maximum |
|---|---|
| Signers per context rule | 15 |
| Policy contracts per rule | 5 |
