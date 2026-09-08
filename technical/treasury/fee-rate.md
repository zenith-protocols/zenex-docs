---
title: Fee rate and withdrawal
sidebar_position: 2
---

# Fee rate and withdrawal

The treasury holds one number and a balance in every token that reaches its address. The number is the protocol fee rate, and the market reads it at each settlement. `TreasuryContract` implements the `Treasury` trait, and the treasury generates a `TreasuryClient` from it. The market declares its own `TreasuryInterface` trait and generates a client from it, also named `TreasuryClient`. This page gives the three trait entries that read and write the rate and the balance, `get_rate`, `set_rate`, and `withdraw`, and the constructor. `__constructor` sits outside the `Treasury` trait, so neither client carries a method for it.

Units on this page follow [Units and scales](../units.md). A rate is an `i128` ratio in the `SCALAR_18` scale, where `SCALAR_18` is `1_000_000_000_000_000_000` and stands for 100%. A rate of `1e17` is 10%. A withdrawal `amount` is token-dec, the decimals of the token named in the same call.

## Constructor

```rust
pub fn __constructor(e: Env, owner: Address, rate: i128)
```

`owner` is the address that every `#[only_owner]` entry checks from then on. `rate` is the initial protocol fee rate, a `SCALAR_18` fraction.

The constructor runs three steps in order. If `rate` is outside the range below, the constructor traps with `InvalidRate` (900). It then writes `owner` through `set_owner`. It then writes `rate` under the instance key `Rate`. It carries no authorization of its own and runs once, at deploy. The instance holds no owner at that point, so the `OwnerAlreadySet` (2102) path inside `set_owner` is unreachable. `InvalidRate` is the error the constructor raises.

## Rate validity

`__constructor` and `set_rate` each inline the same range check before either writes the `Rate` key. `rate` is an `i128` in the `SCALAR_18` scale, where `SCALAR_18` is `1_000_000_000_000_000_000` and stands for 100%.

```rust
(0..=SCALAR_18 / 2).contains(&rate)
```

`SCALAR_18 / 2` is `500_000_000_000_000_000`, which is 50%. Both ends are inclusive. A value outside the range traps with `InvalidRate` (900).

## `get_rate`

```rust
fn get_rate(e: Env) -> i128
```

Permissionless. Any account or contract may call it. It returns the stored rate as a `SCALAR_18` fraction, inside `[0, SCALAR_18 / 2]` on a deployed treasury. It raises no error, because an unset `Rate` key reads as `0`. It extends the instance time to live (TTL) before it reads.

The market calls `get_rate` once per settlement. [Fees and settlement](../market/fee-system.md) gives the legs the rate splits, and [Constructor and dependencies](../market/dependencies.md) gives the client the market calls it through.

## `set_rate`

```rust
fn set_rate(e: Env, rate: i128)
```

Owner only. The `#[only_owner]` guard runs before the body. A call that the owner did not sign fails host authorization. A call after a renounce traps with `OwnerNotSet` (2100). The body then extends the instance TTL, runs the range check, and writes the `Rate` key.

The write lands in the same transaction, and the next `get_rate` returns the new value. The owner may call `set_rate` again at once, in the same transaction. The `Rate` key holds the current value alone, so an observer reconstructs a change from the transaction that called `set_rate`.

## `withdraw`

```rust
fn withdraw(e: Env, token: Address, to: Address, amount: i128)
```

Owner only, behind the same `#[only_owner]` guard, and it extends the instance TTL the same way. `token` is any token contract address. `to` is any recipient address. `amount` is token-dec, in the decimals of `token`.

The body calls `transfer` on `token` with the treasury contract address as the sender. `amount` reaches that `transfer` as given. The token contract holds the balance, and its `transfer` is the only check on the sign of `amount` and on the balance. A failure there reverts the whole call. The TTL extension is the only storage the treasury writes on this path. The token contract's balances hold the record of the withdrawal.

## Storage and TTL

| Key | Class | Type | Written by | Read by |
| --- | --- | --- | --- | --- |
| `Rate` | instance | `i128`, `SCALAR_18` fraction | `__constructor`, `set_rate` | `get_rate` |

`Rate` is a bare `Symbol` key and not a variant of a key enum. It is the only key the treasury defines. The stellar-access keys `OwnableStorageKey::Owner` and `OwnableStorageKey::PendingOwner` also live on the contract. `Owner` is an instance entry and shares the TTL below. `PendingOwner` is a temporary entry and carries the TTL that `transfer_ownership` sets. [Ownership and upgrade](../ownership.md) covers both. The treasury's holdings are the token contracts' balances for the treasury address.

`extend_instance` calls `extend_ttl` on instance storage with `LEDGER_THRESHOLD_INSTANCE` and `LEDGER_BUMP_INSTANCE`. `ONE_DAY_LEDGERS` is the unit those two derive from and is not an argument to the call.

| Constant | Value | Unit | Meaning |
| --- | --- | --- | --- |
| `ONE_DAY_LEDGERS` | 17280 | ledgers | One day at about 5 seconds per ledger. |
| `LEDGER_THRESHOLD_INSTANCE` | 518400 | ledgers | About 30 days. The remaining TTL below which the entry extends. |
| `LEDGER_BUMP_INSTANCE` | 535680 | ledgers | About 31 days. The TTL after the extension. |

`get_rate`, `set_rate`, and `withdraw` are the three entries that call `extend_instance`. On `get_rate` it is the first step. On `set_rate` and `withdraw` the `#[only_owner]` guard runs first. A call that traps extends nothing, because a trap reverts every effect of the invocation it happens in. The market reads the rate at every settlement, so market activity alone keeps the instance and the `Rate` entry alive.

## Ownership

The treasury implements `Ownable` from stellar-access and exposes `get_owner`, `transfer_ownership`, `accept_ownership`, and `renounce_ownership`. [Ownership and upgrade](../ownership.md) gives their signatures, their arguments, their error codes, and their events. `set_rate` and `withdraw` are the two entries that carry `#[only_owner]`.

**`renounce_ownership` is final on this contract.** After it, `set_rate` and `withdraw` trap with `OwnerNotSet` (2100) for the life of the contract. The rate freezes at its last value and `get_rate` keeps serving it. Every token balance the contract holds stays on the contract.

## Errors

| Error | Code | Condition |
| --- | --- | --- |
| `InvalidRate` | 900 | `rate` is outside `[0, SCALAR_18 / 2]` in `__constructor` or `set_rate`. |
| `OwnerNotSet` | 2100 | `set_rate` or `withdraw` runs after `renounce_ownership`. |

`InvalidRate` is the error the treasury defines. `OwnerNotSet` comes from stellar-access, and [Ownership and upgrade](../ownership.md) gives the full code table for that module. A call that the owner did not sign fails host authorization and carries no contract error code. A `withdraw` that the token contract rejects carries that contract's error.

## Events

A rate change is visible through the transaction that called `set_rate`, and a withdrawal through the token contract's transfer event. The treasury publishes no event of its own. The contract does carry the three stellar-access events, `ownership_transfer`, `ownership_transfer_completed`, and `ownership_renounced`. [Ownership and upgrade](../ownership.md) gives their payloads.

## Invariants

- `Rate` exists on a deployed treasury and sits inside `[0, SCALAR_18 / 2]`. `__constructor` writes it at deploy, and `set_rate` is the only entry that changes it. Both run the same range check.
- The stored rate changes in the same transaction as `set_rate`, and the contract records nothing beyond the new value. The market reads the rate at settlement, so a change first reaches a position at the next settlement.
- The market applies the rate to each fee component on its own and rounds each cut down. One settlement of a fill takes one cut from the trade fee and one from the borrowing fee.
- The treasury's balance grows when another party transfers tokens to its address. The market transfers at settlement only when the cut it computed from `get_rate` is above zero.
- `withdraw` is the only path out of the contract. It moves any token, in any amount, to any recipient, under the owner's signature and the token contract's checks.
