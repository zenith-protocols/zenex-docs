---
title: Constructor and settings
description: Oracle constructor, freshness bounds, spread settings, ownership, storage, and receipts.
sidebar_position: 3
---

# Constructor and settings

The oracle holds four settings of its own. They are the Chainlink verifier address, two staleness windows, and the spread reduction factor. The constructor writes them together with the owner and the schema version, six values in all. The owner can change three of the four settings later through two calls. This page covers the constructor, the two owner calls, the bounds they enforce, the views, and the storage and events behind them. The gates that `verify_price` applies are on the [Price verification](./verify-price.md) page.

## The constructor stores six values or none

```rust
pub fn __constructor(
    env: Env,
    owner: Address,
    verifier: Address,
    trade_staleness: u64,
    close_staleness: u64,
    spread_reduction_factor: i128,
)
```

The constructor runs once, in the deploy transaction. It takes `owner` as data and writes it to `OwnableStorageKey::Owner`. The authorization of the deployer covers the deploy, so any address can be set as owner without signing. The owner-only calls authorize the address that key holds at call time.

| Argument | Type | Unit or scale | Meaning |
|---|---|---|---|
| `env` | `Env` | | The host environment. Soroban passes it to every contract call |
| `owner` | `Address` | | The initial owner |
| `verifier` | `Address` | | The verifier contract Chainlink deploys for Data Streams |
| `trade_staleness` | `u64` | seconds | The backward window for a strict call, and the forward allowance on every call |
| `close_staleness` | `u64` | seconds | The backward window for a protective call. The protective calls are `execute_liquidation`, `update_adl_state`, `execute_adl`, and `accrue` on the market. The [market pricing page](../market/pricing.md) lists them |
| `spread_reduction_factor` | `i128` | `SCALAR_18` | How far both sides of the quote move toward its midpoint |

The constructor validates the staleness pair first and the range of `spread_reduction_factor` second. Only then does it write. A deploy that fails either check stores nothing. A deploy that breaks both traps with `InvalidStaleness` (783), because that check runs first. A factor outside its range alone traps with `InvalidSpreadReduction` (785).

The constructor also extends the instance time-to-live (TTL). The [storage section](#storage) gives the values.

`__constructor` is the only writer of `DataKey::Verifier`. The address therefore stays at the value the deploy set. A different verifier needs a new oracle deployment, or an upgrade to code that writes the key. An upgrade keeps the oracle address that each market stores.

## Staleness bounds

A staleness window is the greatest age of a report observation that a call accepts, in whole seconds. A fill uses the narrow window. A protective call uses the wide window, because closing at an old price beats not closing at all.

`require_valid_staleness` guards the constructor and `update_staleness`. It accepts a pair when both of these hold:

- `MIN_STALENESS_SECONDS <= trade_staleness <= MAX_TRADE_STALENESS_SECONDS`
- `trade_staleness <= close_staleness <= MAX_CLOSE_STALENESS_SECONDS`

Every bound is inclusive, and `close_staleness == trade_staleness` is valid. With the constant values, the accepted pairs satisfy `3 <= trade_staleness <= 15` and `trade_staleness <= close_staleness <= 120`. Any other pair traps with `InvalidStaleness` (783).

| Constant | Type | Value | Meaning |
|---|---|---|---|
| `MIN_STALENESS_SECONDS` | `u64` | 3 | Floor on `trade_staleness`, and on `close_staleness` through the ordering rule |
| `MAX_TRADE_STALENESS_SECONDS` | `u64` | 15 | Ceiling on `trade_staleness`. The market sizes its `MIN_NOTIONAL_LOCK` (15 seconds) to this ceiling, so the two move together. The [market config page](../market/config.md) gives the lock rule |
| `MAX_CLOSE_STALENESS_SECONDS` | `u64` | 120 | Ceiling on `close_staleness` |

The same rule evaluated on sample pairs:

| `trade_staleness` | `close_staleness` | Result |
|---|---|---|
| 3 | 3 | Accepted. Both bounds are inclusive |
| 15 | 120 | Accepted. Both ceilings are reached |
| 2 | 10 | `InvalidStaleness`. The trade window is below the floor |
| 16 | 30 | `InvalidStaleness`. The trade window is above its ceiling |
| 10 | 9 | `InvalidStaleness`. The close window is below the trade window |
| 5 | 121 | `InvalidStaleness`. The close window is above its ceiling |

## Spread reduction bounds

`spread_reduction_factor` is an `i128` on the `SCALAR_18` scale, where `SCALAR_18` is `1_000_000_000_000_000_000`. The [units page](../units.md) defines the scale. The accepted range is `[0, SCALAR_18]`, both ends inclusive. A factor below `0` or above `SCALAR_18` traps with `InvalidSpreadReduction` (785). The constructor and `update_spread_reduction_factor` apply the same range check inline.

`reduce_spread` applies the stored factor to the quote. A factor of `0` returns the quote unchanged. A factor of `SCALAR_18` collapses both sides onto the midpoint. The [Price verification](./verify-price.md) page gives the formula and its rounding.

## `update_staleness` replaces both windows

```rust
#[only_owner]
pub fn update_staleness(env: Env, trade_staleness: u64, close_staleness: u64)
```

The owner must sign. Both arguments are whole seconds. One call sets both windows, so the ordering rule applies to the incoming pair and never to a mix of old and new values.

The checks run in this order:

1. `OwnerNotSet` (2100) when the owner key is absent.
2. Host authorization failure when the owner does not sign.
3. `InvalidStaleness` (783) when the pair breaks the bounds above.

A valid pair reaches the rest of the call. The call extends the instance TTL, writes `DataKey::TradeStaleness` and `DataKey::CloseStaleness`, and publishes `StalenessUpdate`. A trapped call writes nothing and publishes nothing.

## `update_spread_reduction_factor` replaces the factor

```rust
#[only_owner]
pub fn update_spread_reduction_factor(env: Env, spread_reduction_factor: i128)
```

The owner must sign. The argument is `SCALAR_18`-scaled.

The checks run in this order:

1. `OwnerNotSet` (2100) when the owner key is absent.
2. Host authorization failure when the owner does not sign.
3. `InvalidSpreadReduction` (785) when the factor is outside `[0, SCALAR_18]`.

A valid factor reaches the rest of the call. The call extends the instance TTL, writes `DataKey::SpreadReductionFactor`, and publishes `SpreadReductionUpdate`.

## Four views return the settings

| Function | Returns | Unit or scale | Reads |
|---|---|---|---|
| `fn verifier(env: Env) -> Address` | `Address` | | `DataKey::Verifier` |
| `fn trade_staleness(env: Env) -> u64` | `u64` | seconds | `DataKey::TradeStaleness` |
| `fn close_staleness(env: Env) -> u64` | `u64` | seconds | `DataKey::CloseStaleness` |
| `fn spread_reduction_factor(env: Env) -> i128` | `i128` | `SCALAR_18` | `DataKey::SpreadReductionFactor` |

All four are permissionless and take `Env` as their only argument. The constructor writes all four keys, so each view returns a value on a deployed contract.

## Storage

The four settings keys live in instance storage. The temporary key `DataKey::VerifiedReport` holds the memo of verified report bodies. It belongs to [Price verification](./verify-price.md).

| Key | Type | Written by | Read by |
|---|---|---|---|
| `DataKey::Verifier` | `Address` | `__constructor` | `verify_price` on a memo miss, `verifier` |
| `DataKey::TradeStaleness` | `u64` seconds | `__constructor`, `update_staleness` | `verify_price`, `trade_staleness` |
| `DataKey::CloseStaleness` | `u64` seconds | `__constructor`, `update_staleness` | `verify_price` on a protective call, `close_staleness` |
| `DataKey::SpreadReductionFactor` | `i128` `SCALAR_18`-scaled | `__constructor`, `update_spread_reduction_factor` | `verify_price`, `spread_reduction_factor` |

The constructor also writes `OwnableStorageKey::Owner`, which holds the owner `Address`, and `UpgradeableStorageKey::SchemaVersion`, which holds `1`. Both are instance entries and share the instance TTL. The [market storage page](../market/storage.md#ledger-keys) describes the same two keys.

`extend_instance` calls `extend_ttl` on instance storage with the threshold and the bump below. One ledger closes about every five seconds.

| Constant | Value in ledgers | Meaning |
|---|---|---|
| `ONE_DAY_LEDGERS` | 17280 | Ledgers in one day |
| `LEDGER_THRESHOLD_INSTANCE` | 518400 | 30 days. The call extends the instance when its remaining TTL is below this |
| `LEDGER_BUMP_INSTANCE` | 535680 | 31 days. The TTL the instance is extended to |

`__constructor`, `verify_price`, `update_staleness`, `update_spread_reduction_factor`, and `upgrade` extend the instance TTL. The four views and the Ownable entries leave it unchanged.

## Events

```rust
#[contractevent]
pub struct StalenessUpdate {
    pub trade_staleness: u64, // the new strict window, seconds
    pub close_staleness: u64, // the new protective window, seconds
}

#[contractevent]
pub struct SpreadReductionUpdate {
    pub spread_reduction_factor: i128, // the new factor, SCALAR_18-scaled
}
```

The topic symbols are `staleness_update` and `spread_reduction_update`. Each event carries one topic, the name symbol. No field is a `#[topic]`, so every field sits in the data map. Each event is published after the write it reports. `verify_price` publishes no event.

The Ownable calls publish three more events from the oracle address. The [ownership events](../market/events.md#ownership-events) section gives their payloads.

## Ownership and upgrade {#ownership-and-upgrade}

The oracle carries the `Ownable` and `Upgradeable` surface that the [market dependency page](../market/dependencies.md#ownership-and-upgrade) defines. That page gives the signatures, the two-step transfer rule, and the behaviour of `upgrade`. The [Ownable codes](../market/errors.md#ownable-codes) give the library error codes.

`update_staleness`, `update_spread_reduction_factor`, and `upgrade` carry `#[only_owner]`. `upgrade` also needs its `operator` argument to equal the stored owner. Otherwise it traps with `UpgradeNotOwner` (600). After `renounce_ownership`, all three trap with `OwnerNotSet` (2100), and the settings keep their last values.
