---
sidebar_position: 1
title: Smart Account Overview
---

# Smart Account Overview

The Zenex smart account is an **optional** stack of contracts that lets traders use passkeys (WebAuthn), session keys, and gasless transactions. It is developed in a separate repo, [`soroban-smart-account`](https://github.com/zenith-protocols/soroban-smart-account), and is not deployed by the perp factory. Users who already have a Stellar wallet can interact with the perp engine directly. The smart account adds UX primitives on top.

This page is a directory of what lives in that repo and why each piece exists. It is not a full integration guide.

## The Five Contracts

| Contract | Role |
|---|---|
| **`account`** | The smart account itself. Multi-signer, context-rule based authorization. Upgradeable. |
| **`ed25519-verifier`** | Stateless Ed25519 signature verifier. Deploy once, share across many accounts. |
| **`webauthn-verifier`** | Stateless WebAuthn / passkey signature verifier. Deploy once, share across many accounts. |
| **`session-policy`** | Policy that restricts a session signer (typically a passkey) to a whitelisted set of target contracts and a single token-transfer destination. |
| **`fee-forwarder`** | Stateless gasless-transaction primitive. A backend pays gas, the user pays a fee in a token of the caller's choice (`fee_token`). |

## How They Fit Together

```mermaid
graph LR
  subgraph SA["Smart account auth"]
    Account["ZenexAccount<br/>multi-signer, context-rule auth"]
    Verifier["ed25519-verifier<br/>webauthn-verifier"]
    Policy["session-policy<br/>call & transfer allow-list"]
    Account -->|signature verification| Verifier
    Account -->|session rule enforces| Policy
  end

  subgraph GS["Gasless submission"]
    Backend["backend"]
    FF["fee-forwarder<br/>collects fee in fee_token"]
    Target["target contract<br/>(e.g. Trading)"]
    Backend --> FF --> Target
  end
```

### `account`

A smart account built on OpenZeppelin's `stellar-accounts`. Authorization is **context-rule based**: each rule binds a set of signers and policies to a specific context type (`Default`, `CallContract`, or `CreateContract`), and the caller specifies which rule to validate per auth context via `AuthPayload.context_rule_ids`. This separates "the owner can do anything" from "a session passkey can do narrow things" within a single account.

The account contract is **upgradeable** so the signer/policy logic can evolve without rotating keys.

### `ed25519-verifier` and `webauthn-verifier`

Both verifiers are **stateless and reusable**. They take a message hash, a public key, and a signature, and return a verdict. Deploy each once per network. Many smart accounts can point at the same verifier address.

`webauthn-verifier` exists because passkeys produce P-256 (secp256r1) signatures wrapped in WebAuthn-specific framing (`authenticatorData`, `clientDataJSON`) that must be parsed before the host's native secp256r1 check can run. The verifier parses the WebAuthn envelope and verifies the P-256 signature.

### `session-policy`

A policy contract that solves the DeFi composability problem where a trading action triggers a sub-auth on the token contract. A trader opens a position by calling `create_order` on the trading contract, which escrows the collateral and keeper execution fee at creation through a `token.transfer` sub-auth from the trader to the trading contract. Without a policy, allowing the session passkey to authorize the token contract would let it drain funds to any address. With this policy attached:

- Calls are restricted to a whitelist of target contracts (for example the trading contract and the trading router).
- Token transfers are locked to a single allowed destination (the trading contract). Token approvals are not destination-checked, so a session key can approve any spender on a whitelisted token.

Typical setup:

```text
Rule 0 (Default, "owner")    : owner keypair, no policies, full access
Rule 1 (Default, "session")  : passkey + SessionPolicy, restricted
```

The owner bypasses the policy. The passkey is locked into the session scope. This is what makes "log in with a passkey and trade for a week without re-authenticating" safe.

### `fee-forwarder`

A **stateless gasless-transaction primitive**. A backend submits the transaction and pays gas. The user pays a fee in a token of the caller's choice (`fee_token`, e.g. USDC). Both entry points pin the user's intent via `require_auth_for_args` before calling into the target contract, differing only in whether `target_args` is included in what gets pinned, as the table below details.

Two entry points:

| Function | What the user pins | When to use |
|---|---|---|
| `forward` | Fee token, fee cap (`max_fee_amount`), expiration ledger, target contract, target function, and `target_args` | **Default.** Safe with any target. The backend cannot substitute args. |
| `forward_unsafe` | The same set **except** `target_args` | Only when the target itself authenticates every argument it cares about, so leaving `target_args` unpinned is safe. |

Neither entry point pins `fee_amount` or `fee_recipient`. The actual fee is only bounded by the pinned `max_fee_amount`, and the recipient is substitutable by the relayer.

The safe `forward` path is what a gasless order uses. A trader's `create_order` and `create_vault_order` are **price-free** and fully authenticated by the user's own `require_auth` over every argument, so pinning `target_args` in full costs nothing: the keeper attaches the Pyth price later, on its own separate transaction, so gasless submission of the trader's intent never needs to defer an argument to the backend.

## Relationship to the Perp Engine

The perp engine treats the smart account address the same as any other caller: an address that produces a valid `require_auth` result on the methods that need it. The smart account stack is what makes the trader-facing experience possible (passkey login, session keys, gasless tx), layered entirely on top of the unmodified perp contracts.

If you are auditing the perp protocol, you can scope the smart account contracts out: nothing in `zenex-contracts` depends on a specific account implementation.
