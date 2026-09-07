---
sidebar_position: 1
title: Market Router
---

# Market Router

The market router batches several contract calls into one transaction. It is stateless: no constructor, no storage, no owner, no error enum of its own, and it holds no funds. It has no privileges either, so a batch can only do what the caller's own authorization already permits. One instance serves every market.

## The Call Descriptor

```rust
#[contracttype]
pub struct Call {
    pub contract: Address, // target contract
    pub func: Symbol,      // entry-point name
    pub args: Vec<Val>,    // positional arguments, host-encoded
}
```

The only typed contract interface the router binds is the market contract's `execute_order`. Every other call, order creations and cancels included, rides the generic `Call` batch.

## Entry Points

```rust
fn multicall(calls: Vec<Call>) -> Vec<Val>
fn multicall_try(calls: Vec<Call>) -> Vec<Val>
fn create_and_fill(calls: Vec<Call>, user: Address, keeper: Address, price: Bytes) -> Vec<Val>
fn create_and_try_fill(calls: Vec<Call>, user: Address, keeper: Address, price: Bytes) -> Vec<Val>

fn multicall_with_fee(
    calls: Vec<Call>, user: Address, fee_token: Address, max_fee_amount: i128,
    fee_expiration: u32, fee_amount: i128, fee_recipient: Address,
) -> Vec<Val>

fn create_and_fill_with_fee(
    calls: Vec<Call>, user: Address, fee_token: Address, max_fee_amount: i128,
    fee_expiration: u32, fee_amount: i128, fee_recipient: Address,
    keeper: Address, price: Bytes,
) -> Vec<Val>

fn create_and_try_fill_with_fee(
    calls: Vec<Call>, user: Address, fee_token: Address, max_fee_amount: i128,
    fee_expiration: u32, fee_amount: i128, fee_recipient: Address,
    keeper: Address, price: Bytes,
) -> Vec<Val>
```

`multicall` runs the batch front to back and returns each call's raw return value. Any failure traps the whole invocation, so either every call lands or none do. `multicall_try` isolates each failure instead, returning one raw `Val` per call: the return value on success, or the failure as a host `Error` value. There is no wrapper struct, so a caller splits on the error tag and decodes successes against the target's own signature.

The three `_with_fee` variants prepend a fee-abstraction leg that collects a submitter-set fee in a token the user signed for, then run exactly the flow their name shares. `multicall_with_fee` has no fill convention at all, so it covers batches with no order to fill, and an empty `calls` collects the fee and returns an empty result. The signed-prefix mechanics of that leg are documented on [SDK](../../integrations/sdk).

## The First-Call Convention

The four create flows read the fill target off the batch: `calls[0].contract` is the market contract, and `calls[0]` must return a `u32`, the id of the order the fill will settle. `user` is an explicit argument, never decoded from `calls[0]`. Every later call is a plain batch member and is never filled, so a resting take-profit or stop-loss created in the same batch simply rests.

The batch itself always runs strictly. `create_and_fill` then fills through `execute_order` and appends the payout, so the result is `N + 1` values with the order id first and the `i128` payout last. It is fill-or-kill: a failing fill unwinds the whole batch, so nothing rests. With `keeper = user` the fill reward round-trips to the trader. `create_and_try_fill` attempts the same fill in isolation and appends the payout or the failure as a host `Error` value, leaving every created order resting when the fill fails.

Two host-level traps guard the convention: an empty `calls` has no first call to fill, and a `calls[0]` that returns anything but a `u32` fails the id conversion.

## Error Codes

The router declares none of its own. It propagates whatever the batch's targets and `execute_order` raise, except in the `try` variants where the fill's error comes back as a value. The fee leg surfaces the OpenZeppelin `stellar-fee-abstraction` library's codes.

| Code | Name | Meaning |
|---|---|---|
| 5000 | `FeeTokenNotAllowed` | Unreachable through this contract: it has no entry point to populate the allow list, so the list stays disabled and every fee token passes |
| 5003 | `InvalidFeeBounds` | `fee_amount` is negative or above `max_fee_amount` |
| 5005 | `InvalidUser` | `user` is the router itself |
| 5006 | `InvalidExpirationLedger` | `fee_expiration` is behind the current ledger sequence |

## Events

The router publishes nothing of its own. The three `_with_fee` entries emit the fee-abstraction library's `fee_collected` (`user` and `recipient` as topics, `token` and `amount` as data) when a fee is actually collected. A `fee_amount` of `0` skips collection entirely.
