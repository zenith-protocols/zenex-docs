---
title: Market router
sidebar_position: 2
description: Router signatures, batch atomicity, authorization, first-call conventions, and fill outcomes.
---

# Market router

`RouterContract` runs contract calls in order. Two entries execute a batch. Two entries also fill the trade order created by its first call. The router calls no `require_auth`. Each target enforces its own authorization. It declares no storage keys, constructor, owner, upgrade entry, errors, or events. The [fee forwarder](./fee-abstraction.md) can wrap a router invocation and collect a relay fee.

## Call

`Call` is the `#[contracttype]` element of each batch.

| Field | Type | Meaning |
| --- | --- | --- |
| `contract` | `Address` | Target contract. |
| `func` | `Symbol` | Target entry point. |
| `args` | `Vec<Val>` | Positional arguments encoded as host values. |

The router passes each function and argument vector unchanged. Index 0 runs first.

The host rejects calls into a contract already on the stack. This includes the router and any contract that invoked it. The host also rejects reserved functions whose names start with `__`.

## Entry points

```rust
fn multicall(e: Env, calls: Vec<Call>) -> Vec<Val>
fn multicall_try(e: Env, calls: Vec<Call>) -> Vec<Val>

fn create_and_fill(
    e: Env,
    calls: Vec<Call>,
    user: Address,
    keeper: Address,
    price: Bytes,
) -> Vec<Val>

fn create_and_try_fill(
    e: Env,
    calls: Vec<Call>,
    user: Address,
    keeper: Address,
    price: Bytes,
) -> Vec<Val>
```

| Argument | Meaning |
| --- | --- |
| `calls` | Batch executed in order. In create flows, the first call supplies the order id and market. |
| `user` | Owner passed to the market's `execute_order`. |
| `keeper` | Reward recipient passed to `execute_order`. It is not an authorizer. |
| `price` | Serialized oracle report, forwarded unchanged. |
| `e` | Soroban environment, omitted from serialized arguments. |

## Atomicity

| Entry point | Batch | Fill |
| --- | --- | --- |
| `multicall` | Strict | None |
| `multicall_try` | Isolated per call | None |
| `create_and_fill` | Strict | Strict |
| `create_and_try_fill` | Strict | Isolated |

A strict call uses `invoke_contract`. A failure traps and reverts every effect in the invocation.

An isolated call uses `try_invoke_contract`. A recoverable failure reverts that call's effects and returns its error. Other calls can commit.

Resource limits and internal host failures can abort the whole transaction. They do not become isolated outcomes.

:::warning A successful transaction can contain failed calls
`multicall_try` and `create_and_try_fill` return recoverable failures as values. Transaction success alone does not establish that every action executed.
:::

## Outcome encoding

A plain batch returns one `Val` per call. An empty batch returns an empty vector. A void target return becomes a void `Val`.

For isolated execution, a successful value is the raw target return. A recoverable failure is a host `Error` value. The host treats an error-tagged target return as a failure. A successful value therefore carries a different tag.

A contract error carries `ScErrorType::Contract` and the target's `u32` code. Other recoverable failures become `ScErrorType::Context` with `ScErrorCode::InvalidAction`. Those context failures include rejected authorization, nonexistent entry points, reserved functions, and prohibited re-entry. A recovered failure emits no committed event for that call. Its error appears in the returned vector.

## Create and fill

Both create flows execute the entire batch strictly. They then call `execute_order` on the contract named by `calls[0].contract`. The fill receives `keeper`, `user`, the first result decoded as a `u32`, and `price`.

`create_and_fill` reverts creation when the fill fails. `create_and_try_fill` commits creation when the fill returns a recoverable error.

Every call after index 0 is a batch member. The router attempts to fill only the first result.

### First-call convention

The first call must return the trade-order id to fill. The router does not validate its function name or argument shape. An empty create batch traps. A first result that cannot decode as `u32` also traps. Neither failure has a router contract error code.

A first call to `create_vault_order` can return a `u32`. The router still invokes `execute_order`, which reads trade orders. If that trade order is absent, the market raises `OrderNotFound` (730), unless an earlier gate fails.

### Result vector

Create flows return one element per batch call, then append one fill outcome.

| Element | Meaning |
| --- | --- |
| 0 | First call's `u32` order id. |
| 1 through the final batch index | Remaining target returns, in call order. |
| Last | Keeper payout or isolated fill error. |

The payout is `i128` in settlement-token atomic units. In `create_and_try_fill`, a recoverable fill failure produces an `Error` instead. That failure keeps the created orders resting. It produces no fill receipt. Later keepers can execute the stored orders.

### Authorization

The market's `create_order` authenticates `user`. Its escrow transfer is a nested authorized invocation. The router itself adds no authorization root. The fill is permissionless. Its report and `keeper` argument need no user authorization.

The [order reference](../market/orders.md) defines creation, escrow, execution gates, and order expiration. The [position reference](../market/position-lifecycle.md) defines the sweep after a full close.

## Errors and events

All failures come from the target, the market fill, or the host. The router publishes no events and holds no funds. When a strict leg traps, its earlier target events revert. An isolated failure reverts only that failed call's events, unless the host aborts the transaction.
