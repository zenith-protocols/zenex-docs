---
title: Batches and fills
sidebar_position: 2
---

# Batches and fills

The router runs a list of contract calls in one invocation and returns the raw values they produce. `multicall` and `multicall_try` run a plain batch. `create_and_fill` and `create_and_try_fill` run a batch and then fill the order that the first call creates. The router takes no authorization in these four entry points, so every call in a batch carries the authorization its target needs. The router holds no state here, and every event in a batch comes from a target contract. The [fee abstraction page](./fee-abstraction.md) covers the three entry points that first collect a relayer fee. Each of those takes one authorization from `user` over `calls`, `fee_token`, `max_fee_amount` and `fee_expiration`.

## Each batch element is a Call

`Call` is a `#[contracttype]` struct and the batch element of every entry point.

| Field | Type | Meaning |
|---|---|---|
| `contract` | `Address` | The target contract. |
| `func` | `Symbol` | The entry-point name. |
| `args` | `Vec<Val>` | The positional arguments, host-encoded. |

The router passes `func` and `args` to the host unchanged, and the host applies limits of its own. The host prohibits re-entry into any contract that is already on the call stack. The router is on that stack, so a `Call` back into the router fails. A `Call` into any contract that reached the router fails as well. A `func` that starts with the reserved `__` prefix also fails. A batch runs front to back, index `0` first.

## A strict call traps the invocation and an isolated call rolls back alone

A strict call goes through `invoke_contract`. If it fails, the whole router invocation traps, and the host unwinds every effect that landed earlier in that invocation. An isolated call goes through `try_invoke_contract`. If it fails with a recoverable error, the host rolls back the storage writes and the events of that call alone, and the batch continues with the next call. The effects of the calls around it stand.

The host recovers most failures and re-raises the rest. An internal host error is not recoverable. A storage or budget limit that the invocation exceeds is not recoverable either. The host treats both as a broken execution precondition and not as the failure of one call. It re-raises them out of the isolated call, so the whole router invocation traps.

## An isolated call yields one Val

An isolated call yields one `Val`. It is the target's raw return value when the call lands. It is the failure as a host `Error` value when the call does not land. The host turns any error-tagged return value into a failure, so a landed value is never an `Error`. A caller therefore reads "landed" as "the value is not an `Error`", and decodes each landed value against the target entry's own return type.

An `Error` from a contract carries `ScErrorType::Contract` and that contract's `u32` error code. The host narrows every other recoverable failure to one value, built from `ScErrorType::Context` and `ScErrorCode::InvalidAction`. A call to an entry point that does not exist, an authorization the host refuses, a reserved `func` and a re-entry all reach the caller as that one value. The host produces the value, and the router returns it unchanged.

A recovered failure leaves the transaction successful. The rolled-back call emits no event, and the failure is visible only as an `Error` value in the vector that the router returns. The same holds for a failed fill in `create_and_try_fill`.

## Two entry points run a plain batch

```rust
fn multicall(e: Env, calls: Vec<Call>) -> Vec<Val>
fn multicall_try(e: Env, calls: Vec<Call>) -> Vec<Val>
```

`multicall` makes every call strict, so either every call lands or none does. `multicall_try` makes every call isolated and encodes each outcome as above. Both return one element per call, in call order, and an empty `calls` returns an empty vector. A target that returns nothing yields a void `Val`. Every contract error code that surfaces here is the code of the target that raised it.

## Two entry points create and fill one order

```rust
fn create_and_fill(e: Env, calls: Vec<Call>, user: Address, keeper: Address, price: Bytes) -> Vec<Val>
fn create_and_try_fill(e: Env, calls: Vec<Call>, user: Address, keeper: Address, price: Bytes) -> Vec<Val>
```

Both entries run `calls` as a strict batch, then fill one order through the market's `execute_order`. The market's `create_order` needs the authorization of `user`. The router calls no `require_auth`, so `user` signs against the market call itself and not against the router entry point. `execute_order` is permissionless, so the fill leg needs no authorization.

`create_and_fill` fills strictly, which makes it fill-or-kill. A failing fill traps and unwinds every create in the batch, so nothing rests. `create_and_try_fill` fills in isolation, through `try_execute_order`, the fallible variant that the router's market client generates from `execute_order`. A fill that fails with a recoverable error leaves every created order resting, including the order the fill targeted. That order keeps its id and stays available for a later fill.

### The first call names the order and the market

`calls[0]` is the call that creates the order to fill. `calls[0].contract` is the market address the fill is sent to, and the router decodes the value that `calls[0]` returns as a `u32` order id. The router does not inspect `calls[0].func` or `calls[0].args`. It does not check that the target is a market, or that `calls[0]` creates a trade order.

`user` is an explicit argument, decoded from no call. The router passes it to `execute_order` as the order owner, so the fill names the order `(user, id)`. Every call after index `0` is a plain batch member and is never filled. A decrease order created after index `0`, such as a take-profit or a stop-loss, rests like any stored order. The [orders page](../market/orders.md) gives the id each create takes and the gates that `execute_order` runs. The [position lifecycle page](../market/position-lifecycle.md) gives the sweep that cancels pending decrease orders when a fill closes a position in full.

`keeper` is the fill-reward recipient that the router forwards to `execute_order`. The router calls no `require_auth` on it, and the market does not authenticate it. A `keeper` equal to `user` sends the fill reward back to `user`. `price` is the serialized oracle report, forwarded unchanged. The router does not parse it.

### The result vector holds one element more than the batch

A create flow returns one element per call, plus one. `results[0]` is the `u32` order id the fill targeted. The elements from index `1` to the element before the last are the raw return values of the remaining calls, in call order. The last element is the fill result.

From `create_and_fill`, the fill result is the keeper payout, an `i128` in token-dec of the market's settlement token. From `create_and_try_fill`, it is that payout when the fill lands. When the fill fails with a recoverable error, it is the failure as a host `Error` value, encoded as in the section on isolated calls, and the transaction still succeeds. The batch commits, the market emits no fill event, and the order rests.

### Two host traps guard the convention

Neither trap carries a contract error code. An empty `calls` traps, because there is no first call to read. A `calls[0]` whose return value is not a `u32` traps on the id conversion. A first call to `get_position` traps this way, because it returns a `Position` struct.

A first call that returns a `u32` passes the conversion whatever it is. A first call to `create_vault_order` returns a vault order id. The fill then names a trade order that does not exist, and it fails at the market with `OrderNotFound` (730) unless an earlier gate fails first.

Every other failure in these four entry points is the error of a target contract, of the market, or of the host.

## The atomicity ladder

| Entry point | Batch | Fill |
|---|---|---|
| `multicall` | strict | none |
| `multicall_try` | isolated per call | none |
| `create_and_fill` | strict | strict |
| `create_and_try_fill` | strict | isolated |

A failure in a strict leg unwinds every leg that ran before it in the same invocation. An isolated leg never unwinds the legs around it. `create_and_try_fill` therefore commits the batch and reports the fill outcome in the last element. A failure the host cannot recover is the exception, as the section on strict and isolated calls defines.
