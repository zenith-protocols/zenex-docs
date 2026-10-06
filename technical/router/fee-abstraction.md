---
title: Fee forwarder
sidebar_position: 3
description: Fee-forwarder signatures, signed fee terms, dynamic arguments, atomicity, errors, and events.
---

# Fee forwarder

`FeeForwarderContract` collects a fee in `fee_token`, invokes a target, and returns the target's raw `Val`. Collection and invocation share one transaction.

## Entry points

```rust
fn forward(
    e: Env,
    fee_token: Address,
    fee_amount: i128,
    max_fee_amount: i128,
    expiration_ledger: u32,
    target_contract: Address,
    target_fn: Symbol,
    target_args: Vec<Val>,
    user: Address,
    fee_recipient: Address,
) -> Val

fn forward_dynamic(
    e: Env,
    fee_token: Address,
    fee_amount: i128,
    max_fee_amount: i128,
    expiration_ledger: u32,
    target_contract: Address,
    target_fn: Symbol,
    target_args: Vec<Val>,
    user: Address,
    fee_recipient: Address,
) -> Val
```

`e` is the Soroban environment. It is not a serialized invocation argument.

| Argument | Unit or type | Meaning |
| --- | --- | --- |
| `fee_token` | `Address` | Token contract used for the relay fee. |
| `fee_amount` | `i128`, fee-token atomic units | Actual charge. It must be positive and at most `max_fee_amount`. |
| `max_fee_amount` | `i128`, fee-token atomic units | Signed fee cap. |
| `expiration_ledger` | `u32`, ledger sequence | Signed live-until ledger for the fee allowance. |
| `target_contract` | `Address` | Contract to invoke after collection. |
| `target_fn` | `Symbol` | Target entry point. |
| `target_args` | `Vec<Val>` | Positional target arguments. |
| `user` | `Address` | Fee payer that must authorize. |
| `fee_recipient` | `Address` | Signed destination of the actual fee. |

Fee-token atomic units use that token's decimals. They match market token-dec only when both flows use the same token.

## Signed arguments

Both functions call `user.require_auth_for_args`. The authorization root names the invoked forwarder function and contains these arguments in order:

| Position | `forward` | `forward_dynamic` |
| --- | --- | --- |
| 0 | `fee_token` | `fee_token` |
| 1 | `max_fee_amount` | `max_fee_amount` |
| 2 | `expiration_ledger` | `expiration_ledger` |
| 3 | `fee_recipient` | `fee_recipient` |
| 4 | `target_contract` | `target_contract` |
| 5 | `target_fn` | `target_fn` |
| 6 | `target_args` | Omitted |

`fee_amount` is unsigned in both variants. The submitter chooses the actual charge within the signed cap. The payer is the authorization entry's address. With `forward`, changing any target argument needs fresh authorization. With `forward_dynamic`, the submitter can change every target argument under the same root authorization.

A market `create_order` sub-invocation binds its order arguments. Its escrow transfer appears beneath that market authorization. Permissionless fills need no user authorization. The nested authorization tree therefore has its own scope. It does not turn `forward_dynamic` into a signature over the complete target invocation.

:::warning Dynamic arguments remain mutable
The dynamic root does not bind the router's batch, report, or keeper argument. Nested target authorizations bind the user actions that need authorization. A target can accept different unsigned arguments and still succeed. The forwarder can then collect the fee without producing the action a caller expected.
:::

## Collection and the fee allowance

`collect_and_invoke` first rejects a `target_fn` of `transfer_from` or `burn_from`. It also rejects the forwarder itself as `fee_recipient`. It then calls `collect_fee` with `FeeAbstractionApproval::Eager`. Collection runs before the target:

1. Approve `max_fee_amount` from `user` to the forwarder, with the signed `expiration_ledger`.
2. Pull the full `max_fee_amount` from `user` into the forwarder through `transfer_from`.
3. Transfer `fee_amount` from the forwarder to `fee_recipient`.
4. Return `max_fee_amount - fee_amount` to `user` when the remainder is positive.
5. Emit `fee_collected`, then invoke the target.

The approval overwrites an existing allowance to the forwarder. Successful collection consumes the full approval, so the resulting allowance is zero. The user's fee authorization includes one token `approve` sub-invocation:

```text
approve(user, forwarder, max_fee_amount, expiration_ledger)
```

Target calls that authenticate `user` follow beneath the same root. Their nested transfers carry their own signed arguments. The forwarder authorizes its `transfer_from` as the spender. The fee and refund transfers authenticate the forwarder's own frame, so they add no user authorization entry.

A trap restores all state to its value before the invocation. That includes the previous allowance, token transfers, target writes, and events.

The forwarder holds the cap during collection. Successful collection distributes the entire cap before the target call. Unrelated token balances have no withdrawal entry.

:::warning The cap must be spendable
The fee leg temporarily pulls the full cap. A balance sufficient for the quoted fee can still fail this transfer. The remainder returns before the target runs. The user also needs the funds that the target action spends after collection.
:::

### Expiration

`expiration_ledger` belongs to the token allowance. Authorization entries also carry their own `signatureExpirationLedger`. Orders carry a separate order expiration. These deadlines are distinct. A valid allowance deadline does not extend an expired authorization or order.

The forwarder passes `expiration_ledger` unchanged to `approve`. The fee token enforces its deadline rules. The library's lazy-expiration check does not run. For the Stellar Asset Contract, a positive approval needs a deadline at or after execution. The deadline must also fit the network's maximum live-until ledger.

## Atomicity

The forwarder invokes its target strictly through `invoke_contract`. A target trap reverts the fee. A successful target return commits the collection.

| Router target | Target outcome | Fee outcome |
| --- | --- | --- |
| `multicall` | Any batch failure traps | Reverted |
| `multicall_try` | Recoverable errors appear in returned elements | Collected |
| `create_and_fill` | A batch or fill failure traps | Reverted |
| `create_and_try_fill` | A recoverable fill failure leaves the created orders resting | Collected |

An empty `multicall` can succeed and collect a fee. An empty create-and-fill batch traps and reverts the fee.

:::info Transaction success can include a failed fill
An isolated router failure is a returned value. It can leave the transaction successful and the relay fee collected. The [router reference](./batching.md) defines the result encoding and the failures that abort the whole transaction.
:::

## Errors

| Code | Variant | Condition |
| --- | --- | --- |
| 6001 | `TargetNotAllowed` | `target_fn` is `transfer_from` or `burn_from`. |
| 6002 | `InvalidRecipient` | `fee_recipient` is the forwarder. |
| 5003 | `InvalidFeeBounds` | `fee_amount <= 0` or `fee_amount > max_fee_amount`. |

The forwarder declares codes 6001 and 6002. Code 5003 comes from `FeeAbstractionError`. A zero-fee invocation raises 5003.

The library also declares these codes:

| Code | Variant | Reachability through these entry points |
| --- | --- | --- |
| 5000 | `FeeTokenNotAllowed` | The allowlist count stays zero, so every fee token passes. |
| 5001 | `FeeTokenAlreadyAllowed` | Only an allowlist mutation raises this. The forwarder exports none. |
| 5002 | `TokenCountOverflow` | Only an allowlist mutation raises this. |
| 5004 | `NoTokensToSweep` | Only a sweep raises this. The forwarder exports none. |
| 5005 | `InvalidUser` | Collection checks whether `user` is the forwarder. Root authorization fails first for that address. |
| 5006 | `InvalidExpirationLedger` | Only the lazy approval path raises this. The forwarder uses eager approval. |

Token and target errors propagate from those contracts. Missing authorization, malformed arguments, prohibited re-entry, and resource limits can produce host failures. The [market error catalog](../market/errors.md) defines errors from market targets.

## Events

| Emitting contract | Topics | Data map |
| --- | --- | --- |
| Fee forwarder | `fee_collected`, `user: Address`, `recipient: Address` | `amount: i128`, `token: Address` |

`amount` is the actual fee in fee-token atomic units. `token` is `fee_token`. Successful collection emits one event, including when the target returns an isolated failure. A trap reverts the event. The token emits its own transfer and approval events. The target emits its own events.

## Storage

The forwarder has no constructor, configuration setters, owner, or upgrade entry. It declares no storage keys and extends no storage time-to-live.

`collect_fee` reads the library's instance key `FeeAbstractionStorageKey::Count`. An absent count is zero, which disables the fee-token allowlist. The forwarder never writes that key. The library's persistent allowlist keys therefore remain unused by these entry points.
