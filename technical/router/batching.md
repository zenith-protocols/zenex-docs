---
title: Batches and fills
sidebar_position: 2
---

# Batches and fills

The router runs a list of contract calls in one invocation and returns the raw values they produce. Two entry points run a plain batch. Two more run a batch and then fill the order that the first call creates. None of the four takes authorization in the router, so every call in a batch carries the authorization its target needs. The [fee abstraction page](./fee-abstraction.md) covers the three entry points that prepend a relayer fee. Each of those takes one authorization from `user` over `calls`, `fee_token`, `max_fee_amount` and `fee_expiration`.

## The call descriptor

`Call` is a `#[contracttype]` struct and the batch element of every entry point.

| Field | Type | Meaning |
|---|---|---|
| `contract` | `Address` | The target contract. |
| `func` | `Symbol` | The entry-point name. |
| `args` | `Vec<Val>` | The positional arguments, host-encoded. |

The router passes `func` and `args` to the host unchanged. The host applies limits of its own. A `Call` whose `contract` is already on the current call stack fails, because the host prohibits re-entry. The router is on that stack, so a `Call` back into the router fails. A `Call` into any contract that reached the router fails as well. A `func` that starts with the reserved `__` prefix also fails. A batch runs front to back, index `0` first.

## Strict and isolated calls

A strict call goes through `invoke_contract`. If it fails, the whole router invocation traps, and the host unwinds every effect that landed earlier in that invocation. An isolated call goes through `try_invoke_contract`. If it fails with a recoverable error, the host rolls back that call alone, and the batch continues with the next call. The host also unwinds the events of the rolled-back call. The effects of the calls around it stand.

The host recovers most failures and re-raises the rest. An internal host error is not recoverable, and neither is a storage or budget limit that the invocation exceeds. The host re-raises those out of the isolated call, so the whole router invocation traps.

## The outcome encoding

An isolated call yields one `Val`. It is the target's raw return value when the call lands. It is the failure as a host `Error` value when the call does not land. The two cannot collide, because the host turns an error-tagged return value into a failure. A caller reads "landed" as "the value is not an `Error`", and decodes each landed value against the target entry's own return type.

An `Error` from a contract carries `ScErrorType::Contract` and that contract's `u32` error code. The host narrows every other recoverable failure to one value, built from `ScErrorType::Context` and `ScErrorCode::InvalidAction`. A call to an entry point that does not exist, and an authorization the host refuses, both reach the caller as that one value. An outcome vector therefore keeps a contract error's own code, and reports every host failure as that one value. The narrowing is the host's own, and the router adds no second encoding, so one value covers every host failure a caller can see.

## Batches

```rust
fn multicall(e: Env, calls: Vec<Call>) -> Vec<Val>
fn multicall_try(e: Env, calls: Vec<Call>) -> Vec<Val>
```

Neither entry reads or writes storage. `multicall` makes every call strict, so either every call lands or none does. `multicall_try` makes every call isolated and encodes each outcome as above. Both return one element per call, in call order, and an empty `calls` returns an empty vector. A target that returns nothing yields a void `Val`.

## Create-and-fill flows

```rust
fn create_and_fill(e: Env, calls: Vec<Call>, user: Address, keeper: Address, price: Bytes) -> Vec<Val>
fn create_and_try_fill(e: Env, calls: Vec<Call>, user: Address, keeper: Address, price: Bytes) -> Vec<Val>
```

Both entries run `calls` as a strict batch, then fill one order through the market's `execute_order`. The market's `create_order` needs the authorization of `user`. The router calls no `require_auth`, so `user` signs against the market call itself and not against the router entry point. `execute_order` is permissionless.

`create_and_fill` fills strictly. It is fill-or-kill. A failing fill traps and unwinds every create in the batch, so nothing rests. `create_and_try_fill` fills in isolation, through `try_execute_order`, the fallible variant that the router's market client generates from `execute_order`. A failing fill leaves every created order resting, including the order the fill targeted. That order keeps its id and stays available for a later fill.

### The first-call convention

`calls[0]` is the call that creates the order to fill. `calls[0].contract` is the market address the fill is sent to, and the router decodes the value `calls[0]` returns as a `u32` order id. The router does not inspect `calls[0].func` or `calls[0].args`. `user` is an explicit argument, never decoded from `calls[0]`, and the router passes it to `execute_order` as the order owner. Every call after index `0` is a plain batch member and is never filled. A take-profit or a stop-loss created in the same batch rests while the position stays open. A fill that closes the position in full cancels every pending decrease order on that side, the ones the batch created included. A decrease order on the other side, and an increase order, are left resting. The market counts order ids per account. Under one account, each later `create_order` call in the batch gets a higher id.

`keeper` is the fill-reward recipient the router forwards to `execute_order`. The router calls no `require_auth` on it, and the market does not authenticate it. A `keeper` equal to `user` sends the fill reward back to `user`. `price` is the serialized oracle report, forwarded unchanged. The router does not parse it. The [orders page](../market/orders.md) gives the gates `execute_order` runs and the errors it raises.

### The result vector

A create flow returns one element per call, plus one. `results[0]` is the `u32` order id the fill targeted. The elements from index `1` to the element before the last are the raw return values of the remaining calls, in call order. The last element is the fill result. From `create_and_fill` it is the keeper payout, an `i128` in token-dec of the market's settlement token. From `create_and_try_fill` it is that payout when the fill lands, or the failure as a host `Error` value when the order rests.

### Traps

Two host traps guard the convention, and neither carries a contract error code. An empty `calls` traps, because there is no first call to read. A `calls[0]` whose return value is not a `u32` traps on the id conversion. A first call to `get_position` traps this way.

The router declares no error enum. In these four entry points, every other failure comes from a target contract, from the market, or from the host.

## The atomicity ladder

| Entry point | Batch | Fill |
|---|---|---|
| `multicall` | strict | none |
| `multicall_try` | isolated per call | none |
| `create_and_fill` | strict | strict |
| `create_and_try_fill` | strict | isolated |

A failure in a strict leg unwinds every leg that ran before it in the same invocation. An isolated leg never unwinds the legs around it. `create_and_try_fill` therefore commits the batch and reports the fill outcome in the last element. A non-recoverable failure in the isolated fill is the exception. The host re-raises it, and the whole invocation traps.
