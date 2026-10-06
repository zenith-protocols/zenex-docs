---
title: Session policy
description: Smart-account session permissions, constructor bindings, expiry ownership, errors, and storage.
---

# Session policy

`SessionPolicyContract` restricts the authorization contexts accepted by a smart-account session rule. Its constructor fixes the forwarder, markets, token, and fee recipient. The smart account authenticates the signers and chooses a context rule. The policy then checks each context passed to `enforce`.

## Constructor

```rust
fn __constructor(
    e: Env,
    forwarder: Address,
    markets: Vec<Address>,
    token: Address,
    fee_recipient: Address,
)
```

| Argument | Meaning |
| --- | --- |
| `forwarder` | Contract allowed to collect the relay fee. |
| `markets` | Contracts accepted as market contexts and token-transfer destinations. |
| `token` | Token accepted for transfers and approvals. |
| `fee_recipient` | Required signed recipient on a forwarder context. |

The constructor writes four instance values. It performs no address, uniqueness, or nonempty-list validation. The contract exports no configuration setter.

## Policy interface

`Policy::AccountParams` is `()`. The installation value carries no account-specific configuration.

```rust
fn enforce(
    e: &Env,
    context: Context,
    authenticated_signers: Vec<Signer>,
    _context_rule: ContextRule,
    smart_account: Address,
)

fn install(
    _e: &Env,
    _params: Self::AccountParams,
    _context_rule: ContextRule,
    smart_account: Address,
)

fn uninstall(
    _e: &Env,
    _context_rule: ContextRule,
    smart_account: Address,
)
```

All three entries call `smart_account.require_auth`. They return void. `install` and `uninstall` make no policy storage writes.

| `enforce` argument | Meaning |
| --- | --- |
| `context` | One authorization context from the smart account. |
| `authenticated_signers` | Signers already authenticated by the smart account. The policy needs at least one. |
| `_context_rule` | The enclosing rule. The policy accepts it but reads no fields. |
| `smart_account` | Account that must authorize the policy call. |

The policy checks a nonempty signer vector. It does not compare signer identities itself. The smart account's rule defines which signers qualify.

## Accepted contexts

`enforce` accepts only `Context::Contract`. Branches run in this order:

| Context | Check |
| --- | --- |
| Configured forwarder | Argument 3 decodes as the configured `fee_recipient`. |
| Configured token, `transfer` | Argument 1 decodes as an address in `markets`. |
| Configured token, `approve` | Argument 1 decodes as `forwarder`. |
| Address in `markets` | Accepted for any function and arguments. |
| Any remaining context | Rejected. |

The forwarder context contains its signed arguments. Position 3 is the fee recipient for both `forward` and `forward_dynamic`. The forwarder branch checks that recipient. It does not check its function name, fee amount, fee token, or target fields.

Each nested action that authenticates the smart account becomes another context. A token approval is therefore checked separately from the forwarder root.

The token branch checks the function and destination. It leaves the amount and approval deadline to the token and the surrounding authorization. A transfer destination that fails address decoding raises `TransferNotAllowed`. This includes a muxed destination. An undecodable approval spender raises `ApproveNotAllowed`.

For the forwarder's signed argument layout, read the [fee-forwarder reference](./router/fee-abstraction.md#signed-arguments).

:::warning Contract scope is not a spending limit
The policy accepts any amount in an allowed market transfer or forwarder approval. It accepts any authorized function on an allowed market. The constructor's bindings restrict destinations. They do not impose a balance cap, an order-size cap, or a per-session spending budget.
:::

## Rule expiration and removal

The policy ignores `_context_rule`, including `valid_until`. The smart account enforces the rule's ledger expiration before policy execution. Removing that rule from the smart account removes the delegation. A browser's local session state does not change the on-chain rule. The [one-click trading guide](/account/one-click-trading) explains the user controls and revocation flow.

## Errors

| Code | Variant | Condition |
| --- | --- | --- |
| 4002 | `ContractNotAllowed` | A non-contract context or an unrecognized contract. |
| 4003 | `FunctionNotAllowed` | The token function is neither `transfer` nor `approve`. |
| 4004 | `TransferNotAllowed` | The token transfer destination is not a configured market. |
| 4005 | `ApproveNotAllowed` | The token approval spender is not the configured forwarder. |
| 4006 | `ForwardNotAllowed` | The signed forwarder recipient does not decode as the configured recipient. |
| 4007 | `SignerNotAuthenticated` | `authenticated_signers` is empty. |

The smart-account authorization check runs first. Host authorization errors therefore precede these policy checks. Within `enforce`, the empty-signer check runs before context validation. Constructor and lifecycle calls declare no additional contract errors.

## Storage and events

| Instance key | Type | Written by |
| --- | --- | --- |
| `forwarder` | `Address` | Constructor |
| `markets` | `Vec<Address>` | Constructor |
| `token` | `Address` | Constructor |
| `recipient` | `Address` | Constructor |

After the signer check, `enforce` calls `extend_ttl` with `TTL_THRESHOLD` and `EXTEND_AMOUNT`. Their values are 501120 and 518400 ledgers. At 17280 ledgers per day, the extension target is approximately 30 days. A failed invocation rolls back the extension.

The policy emits no events. The smart account owns the rule lifecycle and its receipts. Current bindings appear in [Deployments](/deployments).
