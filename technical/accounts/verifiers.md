---
sidebar_position: 2
title: Verifier Contracts
---

# Verifier Contracts

Zenex deploys two verifier contracts that the `ZenexAccount` references as signer types. Both are built on the [OpenZeppelin `stellar-accounts::verifiers`](https://github.com/OpenZeppelin/stellar-contracts/tree/main/contracts/accounts) framework and share an identical design philosophy: stateless, externally deployed, with no storage, no owner, and no upgradeability.

## Ed25519 Verifier

The Ed25519 verifier validates standard Ed25519 signatures against a public key. It is deployed as a standalone contract and referenced by account context rules via its contract address.

Because the verifier is stateless, it holds no keys and stores no data. The public key is provided by the account's signer configuration, and the signature is provided at authentication time. The verifier simply performs `env.crypto().ed25519_verify(pubkey, payload, signature)` and returns the result.

A single deployed Ed25519 verifier instance can serve every `ZenexAccount` on the network. There is no per-user state to isolate.

## WebAuthn Verifier

The WebAuthn verifier enables browser-based authentication using passkeys and biometric credentials (Touch ID, Face ID, Windows Hello, hardware security keys). It validates WebAuthn assertion signatures following the same stateless pattern as the Ed25519 verifier.

The verifier parses the WebAuthn authenticator response, extracts the signed challenge, and verifies the signature against the credential public key provided by the account's signer configuration. This allows users to authorize Soroban transactions directly from a browser without managing private keys.

Like the Ed25519 verifier, a single WebAuthn verifier instance is sufficient for all accounts on the network.

## Design Properties

Both verifiers share the following properties:

| Property | Value |
|---|---|
| On-chain storage | None |
| Owner / admin | None |
| Upgradeability | None |
| State dependency | Stateless, pure verification |
| Instance sharing | One deployment serves all accounts |

The stateless design eliminates an entire class of storage-related attack vectors. There are no initialization functions to front-run, no admin keys to compromise, and no upgrade paths to hijack. The verifier contracts are effectively immutable once deployed.

## Integration with ZenexAccount

The account contract references a verifier by its contract address when adding a signer to a context rule. During authentication, the account calls the verifier's `verify` function, passing the credential public key from its signer configuration and the signature from the transaction. The verifier returns success or failure. The account never interacts with the verifier outside of this authentication path.

For implementation details on the verifier interface and signer registration, refer to the [OpenZeppelin Stellar Accounts documentation](https://github.com/OpenZeppelin/stellar-contracts/tree/main/contracts/accounts).
