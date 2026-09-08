---
title: Constructor and settings
sidebar_position: 3
---

# Constructor and settings

The constructor writes six values into instance storage. Four are its own settings: the Chainlink verifier address, the two staleness windows, and the spread reduction factor. The other two are the owner and the schema version. The owner can change three of the settings later through two calls. This page covers the constructor, the two owner calls, the bounds they enforce, and the storage and events behind them. For the gates that `verify_price` applies, refer to [Price verification](./verify-price.md).

## Constructor

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

The constructor runs once, in the deploy transaction. It calls `require_auth` on no address, so `owner` does not sign the deploy.

| Argument | Type | Unit or scale | Meaning |
|---|---|---|---|
| `env` | `Env` | | The host environment. Soroban passes it to every contract call |
| `owner` | `Address` | | The initial owner, written to `OwnableStorageKey::Owner`. The owner-only calls authorize the address that key holds at call time |
| `verifier` | `Address` | | The verifier contract Chainlink deploys for Data Streams |
| `trade_staleness` | `u64` | seconds | The strict window for fill verifications, and the forward allowance on every verification |
| `close_staleness` | `u64` | seconds | The protective window, for a call that closes a position during a price gap |
| `spread_reduction_factor` | `i128` | `SCALAR_18` | How far both sides of the quote move toward its midpoint |

The body runs in this order:

1. `require_valid_staleness` on the pair.
2. The range check on `spread_reduction_factor`.
3. `set_owner` with `owner`.
4. `set_schema_version` with `1`.
5. `set_verifier`, `set_trade_staleness`, `set_close_staleness`, `set_spread_reduction_factor`.
6. `extend_instance`.

Both checks run before the first write, so the deploy stores all six values or none. The staleness check runs first, so a deploy that breaks both the staleness bounds and the factor range traps with `InvalidStaleness` (783). A factor outside its range traps with `InvalidSpreadReduction` (785).

`__constructor` is the only writer of `DataKey::Verifier`, so the address stays at the value the deploy set. A different verifier means a new oracle deployment, or an upgrade to code that writes the key.

## Staleness bounds

`require_valid_staleness` guards the constructor and `update_staleness`. It accepts a pair when both of these hold:

- `MIN_STALENESS_SECONDS <= trade_staleness <= MAX_TRADE_STALENESS_SECONDS`
- `trade_staleness <= close_staleness <= MAX_CLOSE_STALENESS_SECONDS`

With the constant values, the accepted pairs are `3 <= trade_staleness <= 15` and `trade_staleness <= close_staleness <= 120`. Every bound is inclusive, and `close_staleness == trade_staleness` is valid. Any other pair traps with `InvalidStaleness` (783).

| Constant | Type | Value | Meaning |
|---|---|---|---|
| `MIN_STALENESS_SECONDS` | `u64` | 3 | Floor on `trade_staleness`, and on `close_staleness` through the ordering rule |
| `MAX_TRADE_STALENESS_SECONDS` | `u64` | 15 | Ceiling on `trade_staleness` |
| `MAX_CLOSE_STALENESS_SECONDS` | `u64` | 120 | Ceiling on `close_staleness` |

## Spread reduction bounds

`spread_reduction_factor` is an `i128` on the `SCALAR_18` scale, where `SCALAR_18` is `1_000_000_000_000_000_000`. The accepted range is `[0, SCALAR_18]`, both ends inclusive. `reduce_spread` applies the stored factor to the quote. A factor of `0` returns the quote unchanged, and a factor of `SCALAR_18` collapses both sides onto the midpoint. [Price verification](./verify-price.md) gives the formula. A factor below `0` or above `SCALAR_18` traps with `InvalidSpreadReduction` (785). The constructor and `update_spread_reduction_factor` apply the same range check inline.

## `update_staleness`

```rust
#[only_owner]
pub fn update_staleness(env: Env, trade_staleness: u64, close_staleness: u64)
```

Replaces both windows. The owner must sign. Both arguments are whole seconds. One call sets both windows, so the ordering rule applies to the incoming pair.

`require_valid_staleness` runs first, so the TTL extension, the two writes, and the event follow a valid pair only.

Errors, in check order:

1. `OwnerNotSet` (2100) when the owner key is absent.
2. Host authorization failure when the owner does not sign.
3. `InvalidStaleness` (783) when the pair breaks the bounds above.

On success the call extends the instance TTL, writes `DataKey::TradeStaleness` and `DataKey::CloseStaleness`, and publishes `StalenessUpdate`.

## `update_spread_reduction_factor`

```rust
#[only_owner]
pub fn update_spread_reduction_factor(env: Env, spread_reduction_factor: i128)
```

Replaces the factor. The owner must sign. The argument is `SCALAR_18`-scaled.

The range check runs first, so the TTL extension, the write, and the event follow a valid factor only.

Errors, in check order:

1. `OwnerNotSet` (2100) when the owner key is absent.
2. Host authorization failure when the owner does not sign.
3. `InvalidSpreadReduction` (785) when the factor is outside `[0, SCALAR_18]`.

On success the call extends the instance TTL, writes `DataKey::SpreadReductionFactor`, and publishes `SpreadReductionUpdate`.

## Views

| Function | Returns | Unit or scale | Reads |
|---|---|---|---|
| `verifier` | `Address` | | `DataKey::Verifier` |
| `trade_staleness` | `u64` | seconds | `DataKey::TradeStaleness` |
| `close_staleness` | `u64` | seconds | `DataKey::CloseStaleness` |
| `spread_reduction_factor` | `i128` | `SCALAR_18` | `DataKey::SpreadReductionFactor` |

All four are permissionless and take `Env` as their only argument. The constructor writes all four keys, so each view returns a value on a deployed contract.

## Storage

The four settings keys live in instance storage. The temporary key `DataKey::VerifiedReport` holds the memo of verified report bodies, and it belongs to [Price verification](./verify-price.md).

| Key | Type | Written by | Read by |
|---|---|---|---|
| `DataKey::Verifier` | `Address` | `__constructor` | `verify_price` on a memo miss, `verifier` |
| `DataKey::TradeStaleness` | `u64` seconds | `__constructor`, `update_staleness` | `verify_price`, `trade_staleness` |
| `DataKey::CloseStaleness` | `u64` seconds | `__constructor`, `update_staleness` | `verify_price` on a protective call, `close_staleness` |
| `DataKey::SpreadReductionFactor` | `i128` `SCALAR_18`-scaled | `__constructor`, `update_spread_reduction_factor` | `verify_price`, `spread_reduction_factor` |

The constructor also writes `OwnableStorageKey::Owner` and `UpgradeableStorageKey::SchemaVersion`, both in instance storage. For those two keys, refer to [Ownership and upgrade](../ownership.md).

`extend_instance` calls `extend_ttl` on instance storage with the threshold and the bump below.

| Constant | Value in ledgers | Meaning |
|---|---|---|
| `ONE_DAY_LEDGERS` | 17280 | Ledgers in one day, at about five seconds per ledger |
| `LEDGER_THRESHOLD_INSTANCE` | 518400 | 30 days. The call extends the instance when its remaining TTL is below this |
| `LEDGER_BUMP_INSTANCE` | 535680 | 31 days. The TTL the instance is extended to |

`__constructor`, `verify_price`, `update_staleness`, `update_spread_reduction_factor`, and `upgrade` extend the instance TTL. The four views and the Ownable entries do not extend it.

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

The topic symbols are `staleness_update` and `spread_reduction_update`. Each event carries one topic, the name symbol. No field is a `#[topic]`, so every field sits in the data map. The oracle defines these two, and it publishes each one after the write it reports. The Ownable calls publish three more events from the oracle address, and [Ownership and upgrade](../ownership.md) covers them.

## Ownership and upgrade

The oracle exposes the Ownable surface, `get_owner`, `transfer_ownership`, `accept_ownership`, and `renounce_ownership`, and the `Upgradeable` entry `upgrade`. `update_staleness`, `update_spread_reduction_factor`, and `upgrade` carry `#[only_owner]`. For the five calls, their arguments, their errors, and their events, refer to [Ownership and upgrade](../ownership.md).
