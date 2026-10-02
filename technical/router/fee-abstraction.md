---
title: Fee abstraction
sidebar_position: 3
---

# Fee abstraction

Three router entry points collect a relayer fee from `user` before the batch runs. They are `multicall_with_fee`, `create_and_fill_with_fee`, and `create_and_try_fill_with_fee`. All three share one fee leg, one authorization shape, and one event. The user signs the batch, the fee token, a fee ceiling, and the live-until ledger of the fee allowance. The submitter then sets the fee amount and the payee inside that ceiling.

## Entry points

```rust
fn multicall_with_fee(
    e: Env, calls: Vec<Call>, user: Address, fee_token: Address,
    max_fee_amount: i128, fee_expiration: u32, fee_amount: i128,
    fee_recipient: Address,
) -> Vec<Val>

fn create_and_fill_with_fee(
    e: Env, calls: Vec<Call>, user: Address, fee_token: Address,
    max_fee_amount: i128, fee_expiration: u32, fee_amount: i128,
    fee_recipient: Address, keeper: Address, price: Bytes,
) -> Vec<Val>

fn create_and_try_fill_with_fee(
    e: Env, calls: Vec<Call>, user: Address, fee_token: Address,
    max_fee_amount: i128, fee_expiration: u32, fee_amount: i128,
    fee_recipient: Address, keeper: Address, price: Bytes,
) -> Vec<Val>
```

| Argument | Type | Unit or scale | Meaning |
| --- | --- | --- | --- |
| `calls` | `Vec<Call>` | none | The batch, executed front to back. |
| `user` | `Address` | none | The fee payer, and the order owner in the two create flows. |
| `fee_token` | `Address` | none | The token contract the fee moves in. |
| `max_fee_amount` | `i128` | token-dec of `fee_token` | The fee ceiling the user signs. |
| `fee_expiration` | `u32` | ledger sequence | The live-until ledger of the fee allowance, which is the last ledger at which the allowance is valid. |
| `fee_amount` | `i128` | token-dec of `fee_token` | The fee collected. A `0` collects nothing. |
| `fee_recipient` | `Address` | none | The fee payee. |
| `keeper` | `Address` | none | In the two create flows, the fill-reward recipient that the router passes to the market's `execute_order`. It is a payee and never an authorizer. |
| `price` | `Bytes` | none | In the two create flows, the serialized oracle report that the router passes to `execute_order` unchanged. |

Each function returns one raw `Val` per call. The two create flows append the fill outcome, so their result holds one element more than `calls`. The first-call convention and the outcome encoding are on [Batches and fills](./batching.md). Units are defined on [Units and scales](../units.md).

## The signed prefix

Every with-fee function calls `require_auth_for_args` on `user` over four values, in this order: `calls`, `fee_token`, `max_fee_amount`, and `fee_expiration`. The recorded root authorization names the entry point and carries exactly those four values. The whole `calls` vector signs as one value. A change to any element, or to any argument inside an element, needs a new signature.

The remaining arguments form the unsigned tail. For `multicall_with_fee` the tail is `fee_amount` and `fee_recipient`. For the two create flows the tail is `fee_amount`, `fee_recipient`, `keeper`, and `price`. The submitter sets the tail after the user signs.

The signed `max_fee_amount` caps the fee, so the most the user can lose to the fee is that ceiling. The recipient is unsigned, so the ceiling bounds the amount and not the destination. `price` sits in the tail because a signed report ages out. The oracle rejects an observation older than its staleness window with `PriceStale`, and it rejects a report past its expiry with `ReportExpired`. The submitter attaches a fresh report at submit time, and the signature stays valid. The [price verification page](../oracle/verify-price.md) gives both gates.

Inner calls carry their own authorization needs as sub-invocation entries under that root. The market's `create_order` and `cancel_order`, and the token `transfer` that moves the order escrow, all ride the signed tree.

## The fee leg

`authorize_and_collect_fee` runs first in all three flows, and it is a strict leg. A failure in a later strict leg unwinds it. [Batches and fills](./batching.md) defines a strict leg and an isolated leg. Its steps, in order:

1. `require_auth_for_args` on `user` over the signed prefix.
2. If `fee_amount` is `0`, return. No token call happens, no event is published, and `fee_token`, `max_fee_amount`, and `fee_expiration` are read no further.
3. `collect_fee` with `FeeAbstractionApproval::Eager`. It checks `fee_token` against the allowlist, rejects a `user` equal to the router, then runs `validate_fee_bounds`. Only after those three guards does it approve `max_fee_amount` from `user` to the router. `Eager` writes that allowance without reading the current one, so it replaces any allowance `user` already granted to the router. It then moves `fee_amount` from `user` to `fee_recipient` through `transfer_from` and publishes `fee_collected`.
4. `approve` on `fee_token` from `user` to the router for amount `0`, with live-until ledger `fee_expiration`. This wipes the residual allowance, whatever its size. After a successful call the allowance is `0` even when `user` held one before, and after a trap it is the allowance `user` held before the call.

### The signed expiration ledger

`fee_expiration` is a signed argument that the router passes to both `approve` calls unchanged. The router does not read the ledger sequence for it, because a ledger-derived value differs between the auth-discovery simulation and the on-chain execution. The signed `approve` sub-invocation would then stop matching the signature. A signed argument gives the same authorization tree in both. The allowance is created and wiped inside one invocation, so a `fee_expiration` equal to the execution ledger holds for both `approve` calls.

The Stellar Asset Contract rejects an `approve` of a positive amount when `fee_expiration` is below the current ledger sequence. It rejects an `approve` of any amount when `fee_expiration` is above the furthest live-until ledger the network allows. That ledger is the execution ledger plus the maximum entry time to live (TTL) of the network, minus one.

### Expected auth sub-invocations

A non-zero fee leg adds two token entries under the root authorization of `user`. The entries of the batch follow them, in call order.

| Position | Contract | Function | Arguments |
| --- | --- | --- | --- |
| 1 | `fee_token` | `approve` | `user`, the router address, `max_fee_amount`, `fee_expiration` |
| 2 | `fee_token` | `approve` | `user`, the router address, `0`, `fee_expiration` |
| 3 and later | each batch target that authorizes `user` | the function that runs `require_auth` on `user` | the arguments that the call pins |

A batch call adds an entry only when its target runs `require_auth` or `require_auth_for_args` on `user`. A target that runs `require_auth` pins the arguments of the call. A target that runs `require_auth_for_args` pins the values it passes to that function. The fill leg of the two create flows adds no entry, because `execute_order` runs no `require_auth`.

Every batch entry holds its own sub-invocations one level below itself. A `create_order` entry holds the token `transfer` that moves the escrow as its child. `Order::escrow_amount` is `Order::margin` plus `Order::exec_fee` for an increase order, and `Order::exec_fee` alone for a decrease order. The three values are `i128` in the token-dec of the market's settlement token. An order whose escrow is `0` makes no transfer, so its `create_order` entry carries no child.

The `transfer_from` inside `collect_fee` adds no entry. The router invokes the token contract and is also the spender, so the host authorizes the call from the router's own frame. A signed entry from `user` is never consulted for it.

## Order of the legs

| Function | Legs in order | Result of a failure in the last leg |
| --- | --- | --- |
| `multicall_with_fee` | fee, then the strict batch | The invocation traps. The fee transfer, both writes to the fee allowance, and every earlier call unwind. |
| `create_and_fill_with_fee` | fee, strict batch, strict fill | The invocation traps. Nothing rests and nothing is charged. |
| `create_and_try_fill_with_fee` | fee, strict batch, isolated fill | The failure is returned in the last result element. Every created order rests and the fee stays collected. |

A failure in a strict leg unwinds every leg before it, and an isolated leg never unwinds the legs around it. [Batches and fills](./batching.md) gives both rules and names the failures the host cannot recover. The host re-raises one of those out of the isolated fill, so the whole invocation traps and the fee unwinds with it.

An empty `calls` in `multicall_with_fee` still runs the fee leg and returns an empty vector. An empty `calls` in either create flow traps after the fee leg, because there is no first call to fill, and the fee unwinds with it.

## The effective fee rule

`validate_fee_bounds` inside `collect_fee` accepts the fee when `fee_amount > 0` and `fee_amount <= max_fee_amount`. `authorize_and_collect_fee` returns before that check when `fee_amount == 0`. Both amounts are `i128` in the token-dec of `fee_token`, and both comparisons are integer comparisons with no rounding. The rule the router applies is:

- `fee_amount == 0`: nothing moves, and no event is published.
- `0 < fee_amount <= max_fee_amount`: `fee_amount` moves from `user` to `fee_recipient`.
- Any other `fee_amount`: the call raises `InvalidFeeBounds`.

The fee is either zero, or positive and within the signed ceiling. The rows below take `max_fee_amount` as `1_0000000`, which is 1.0 of a fee token with 7 decimals.

| `fee_amount` (token-dec) | Outcome |
| --- | --- |
| `0` | Nothing moves and no event is published. |
| `2500000` | 0.25 moves to `fee_recipient` and the allowance ends at `0`. |
| `1_0000000` | 1.0 moves. A fee equal to the ceiling is accepted. |
| `1_0000001` | The call raises `InvalidFeeBounds`. |
| `-1` | The call raises `InvalidFeeBounds`. |

The router never computes the leftover allowance as a number. Step 4 of the fee leg sets the allowance to `0`, which removes the leftover whatever its size.

## Errors

The fee leg surfaces the codes of the `stellar-fee-abstraction` library, and the router declares no error enum of its own. A tampered signed prefix fails the host authorization check and raises no contract error.

| Code | Variant | Through the router | Condition |
| --- | --- | --- | --- |
| 5003 | `InvalidFeeBounds` | Reachable | `fee_amount` is negative, or above `max_fee_amount`. Raised by `validate_fee_bounds`. A `fee_amount` of `0` returns before the check. |
| 5005 | `InvalidUser` | **Not reachable** | Raised inside `collect_fee` before the bounds check, when `user` is the router address. The fee leg authorizes `user` first, and the router declares no `__check_auth`. Only the router's own frame could authorize the router address, and the host prohibits re-entry, so the fee leg fails on the authorization check first. |
| 5000 | `FeeTokenNotAllowed` | **Not reachable** | Raised when the allowlist is on and `fee_token` has no allowlist entry. The allowlist stays off on the router. |
| 5006 | `InvalidExpirationLedger` | **Not reachable** | Raised by `validate_expiration_ledger` on the `Lazy` approval path. The router passes `Eager`. |
| 5001 | `FeeTokenAlreadyAllowed` | **Not reachable** | Raised by `set_allowed_fee_token`, which the router never calls. |
| 5002 | `TokenCountOverflow` | **Not reachable** | Raised by `set_allowed_fee_token`, which the router never calls. |
| 5004 | `NoTokensToSweep` | **Not reachable** | Raised by `sweep_token`, which the router never calls. |

The `fee_token` contract raises its own errors, and their conditions are the token's. The Stellar Asset Contract fails an `approve` on the two `fee_expiration` bounds above, and it fails a `transfer_from` when the balance is too low. A custom token sets its own rules. The batch and the fill raise the errors of their targets. The [market errors page](../market/errors.md) lists the codes of `execute_order`.

## Events

| Event | Contract | Topics | Data map |
| --- | --- | --- | --- |
| `fee_collected` | the router | `user: Address`, `recipient: Address` | `amount: i128` (token-dec), `token: Address` |

`emit_fee_collected` inside `collect_fee` publishes the `FeeCollected` struct. The first topic is the snake_case form of the struct name, so it is the symbol `fee_collected`. The two `#[topic]` fields follow in declaration order. The other fields sit in the data map under their own names, and the host orders a map by key, so `amount` precedes `token`. `token` is the `fee_token` and `amount` is the `fee_amount`. The event reaches the chain under the router's contract address, because `collect_fee` runs in the router's frame.

At most one `fee_collected` event exists per invocation. A `fee_amount` of `0` publishes none, and a trap unwinds the one that was published. The `fee_token` publishes its own events for the two `approve` calls and the `transfer_from`, the market publishes its order and fill events, and every batch target publishes its own.

## Storage

The router's only storage access is one instance read inside `collect_fee`. A fee leg with a `fee_amount` of `0` returns before `collect_fee` and reads nothing. The router declares no storage key of its own, and it writes none. The key it reads belongs to the `stellar-fee-abstraction` library.

| Key | Type | Class | Access |
| --- | --- | --- | --- |
| `FeeAbstractionStorageKey::Count` | `u32` | instance | Read by `is_fee_token_allowlist_enabled`, which `collect_fee` reaches through `is_allowed_fee_token`. An absent entry reads as `0`. |

`Count` is the number of allowlisted fee tokens, and the allowlist is on when `Count` is above `0`. Only `set_allowed_fee_token` writes `Count`, and the router never calls it. `is_allowed_fee_token` therefore returns true for every token, and the router accepts every fee token.

The persistent keys `FeeAbstractionStorageKey::Token` and `FeeAbstractionStorageKey::TokenIndex` hold the allowlist entries. `is_allowed_fee_token` reaches them only while the allowlist is on, and `set_allowed_fee_token` reads `TokenIndex` on every call. The library extends their TTL with `FEE_ABSTRACTION_TTL_THRESHOLD` (501120 ledgers) and `FEE_ABSTRACTION_EXTEND_AMOUNT` (518400 ledgers). The extend amount is 30 days of 17280 ledgers, and the threshold is one such day less. The router extends no TTL and uses neither constant.

## The router never holds the fee

`transfer_from` moves `fee_amount` straight from `user` to `fee_recipient`, with the router as the spender. The router therefore holds no `fee_token` balance from the fee leg at any point, and a charged fee sits in the balance of `fee_recipient` only.
