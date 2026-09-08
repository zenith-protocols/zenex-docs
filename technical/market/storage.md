---
sidebar_position: 16
title: Storage
---

# Storage

The `DataKey` enum names every value the market contract owns, apart from three keys its two mixed-in libraries own. This page holds the four time-to-live tiers and their constants, the ledger key table, and the `MarketData` singleton. The last column of the key table names the page that owns that key's semantics.

## Time-to-live tiers

A ledger lasts about 5 seconds. A threshold is the remaining time-to-live below which an access extends an entry. A bump is the time-to-live the access extends the entry to. Both are counts of ledgers.

| Constant | Ledgers | Time |
| --- | --- | --- |
| `ONE_DAY_LEDGERS` | 17_280 | 1 day |
| `LEDGER_THRESHOLD_INSTANCE` | 518_400 | 30 days |
| `LEDGER_BUMP_INSTANCE` | 535_680 | 31 days |
| `LEDGER_THRESHOLD_SHARED` | 777_600 | 45 days |
| `LEDGER_BUMP_SHARED` | 794_880 | 46 days |
| `LEDGER_THRESHOLD_USER` | 1_728_000 | 100 days |
| `LEDGER_BUMP_USER` | 2_073_600 | 120 days |
| `LEDGER_BUMP_PRICE_CACHE` | 16 | about 80 seconds |

### Instance

The instance carries the small read-mostly state: the parameters, the four wired addresses, the feed id, the status, the wind-down markers, and the auto-deleveraging flags. It loads whole with every invocation. `extend_instance` opens the body of fourteen entry points: `set_config`, `set_status`, `set_terminal_price`, `create_order`, `cancel_order`, `create_vault_order`, `cancel_vault_order`, `claim_credit`, `execute_order`, `execute_liquidation`, `update_adl_state`, `execute_adl`, `execute_vault_order`, and `accrue`. On `set_config`, `set_status`, and `set_terminal_price` the owner check runs ahead of it, and the owner must sign each of the three. `__constructor` calls it last, after every write it makes. `upgrade` also needs the owner's signature. It calls `extend_instance` after the owner check and before it replaces the contract WebAssembly. The views leave the instance time-to-live as it is, and so do the four `Ownable` entry points `get_owner`, `transfer_ownership`, `accept_ownership`, and `renounce_ownership`.

### Shared

`MarketData` is the only entry in the shared tier. Both `get_market_data` and `set_market_data` extend it, so an on-chain call of the `get_market_data` view extends the entry. A simulated call leaves no footprint.

### User

The user tier holds the five per-user keys. `get_position`, `get_order`, and `get_vault_order` extend the entry they read, and `set_position`, `set_order`, and `set_vault_order` extend the entry they write. A `get_position` miss stores the zeroed row, which extends it as well. `get_claimable_credit` and `get_order_counter` read without extending. Only `add_claimable_credit` and `next_order_id` extend those two keys.

### Temporary

`PriceCache` is the only temporary `DataKey` entry. Its bump is the network-minimum temporary lifetime, and `LEDGER_BUMP_PRICE_CACHE` serves as both the threshold and the bump. Soroban does not refresh the time-to-live of a live temporary entry on a plain rewrite, so `set_price_cache` extends the entry itself on every write.

## Ledger keys

Class is the Soroban storage type. Tier is the time-to-live tier from the previous section.

| Key | Value | Class | Tier | Written by | Semantics |
| --- | --- | --- | --- | --- | --- |
| `Config` | `Config` | instance | instance | `__constructor`, `set_config` | [Config](./config.md) |
| `FeedId` | `BytesN<32>` | instance | instance | `__constructor` | [Constructor and dependencies](./dependencies.md) |
| `Status` | `u32`, a `Status` discriminant | instance | instance | `__constructor`, `set_status` | [Market status](./status.md) |
| `Vault` | `Address` | instance | instance | `__constructor` | [Constructor and dependencies](./dependencies.md) |
| `Token` | `Address` | instance | instance | `__constructor` | [Constructor and dependencies](./dependencies.md) |
| `Oracle` | `Address` | instance | instance | `__constructor` | [Constructor and dependencies](./dependencies.md) |
| `Treasury` | `Address` | instance | instance | `__constructor` | [Constructor and dependencies](./dependencies.md) |
| `DelistedAt` | `u64`, seconds | instance | instance | `set_status`, which also removes it | [Market status](./status.md) |
| `TerminalPrice` | `i128`, feed precision | instance | instance | `set_terminal_price` | [Market status](./status.md) |
| `Adl` | `AdlState` | instance | instance | `update_adl_state` | [Auto-deleveraging](./auto-deleveraging.md) |
| `MarketData` | `MarketData` | persistent | shared | `__constructor`, `Market::store` on the working set, `claim_credit`, the retirement sweep in `set_status` | This page |
| `PriceCache` | `PriceData` | temporary | temporary | `Market::load` on the working set, when no cache entry exists or the submitted report is newer than the cache | [Pricing](./pricing.md) |
| `Position(Address, bool)` | `Position` | persistent | user | `get_position` on a miss, a decrease order in `create_order` or `cancel_order`, `Position::store` | [Position lifecycle](./position-lifecycle.md) |
| `VaultOrder(Address, u32)` | `VaultOrder` | persistent | user | `create_vault_order`, and cancel and fill remove it | [Vault orders](./vault-orders.md) |
| `Order(Address, u32)` | `Order` | persistent | user | `create_order`, and cancel, fill, and the closure sweep remove it | [Orders](./orders.md) |
| `OrderCounter(Address)` | `u32` | persistent | user | `next_order_id` | [Orders](./orders.md) |
| `ClaimableCredit(Address)` | `i128`, token-dec | persistent | user | Earned funding in `Position::settle_accruals`, a parked payout in `pay_trader`, `claim_credit` | [Funding rate](./funding-rate.md) |

The [units page](../units.md) defines token-dec, base-dec, feed precision, `SCALAR_18`, and seconds.

Eight keys are present from the constructor onward: the seven instance keys it writes and `MarketData`. The rest are lazy. The contract creates each one on its first write, and two of those writes sit on a read path. `get_position` stores the zeroed row when it finds none, and the working set stores the submitted report when the cache is absent. An absent key reads as a default where the contract defines one. `Adl` reads `AdlState::default`, which is `{ long: false, short: false }`. `ClaimableCredit` reads `0`. `OrderCounter` reads `1`. `Position` reads as the zeroed row. `DelistedAt`, `TerminalPrice`, `PriceCache`, `Order`, and `VaultOrder` have no default, and each caller tests for presence or traps. `Position(Address, bool)` is keyed by the account and the side, so the long and the short row of one account are independent.

Three keys sit outside `DataKey`. `OwnableStorageKey::Owner` and `UpgradeableStorageKey::SchemaVersion` are instance entries, and `OwnableStorageKey::PendingOwner` is a temporary entry. The [ownership page](../ownership.md) covers all three.

## The market record

`MarketData` is the market's own book. It is a contract type, so it crosses the application binary interface whole as the return of `accrue` and of `get_market_data`. The constructor writes it as its `Default`, all fields zero, with `accrued_at` set to the deploy ledger's timestamp.

| Field | Type | Unit and meaning |
| --- | --- | --- |
| `notional` | `SidePair` | token-dec. Open interest per side. |
| `margin` | `SidePair` | token-dec. Posted margin per side. |
| `tokens` | `SidePair` | base-dec. Base size per side, the sum of each position's `tokens`. |
| `funding_idx` | `SidePair` | `SCALAR_18`. The cumulative funding index per side, signed. |
| `borrowing_idx` | `SidePair` | `SCALAR_18`. The cumulative borrowing index per side, non-decreasing. |
| `funding_rate` | `i128` | `SCALAR_18` per second, signed. Positive means longs pay. |
| `accrued_at` | `u64` | seconds. The last accrual timestamp. Both indices share it. |
| `credit_pool` | `i128` | token-dec. The internal ledger of claimable credit, parked failed payouts included. It can stand above the contract's token balance. |
| `credit_owed` | `i128` | token-dec. The total of every `ClaimableCredit` balance. |

The [funding rate page](./funding-rate.md) holds the five writers of the pool pair, the surplus it carries, and the invariant between them. The five index and aggregate fields use `SidePair`:

```rust
pub struct SidePair {
    pub long: i128,
    pub short: i128,
}

impl SidePair {
    pub fn get(&self, is_long: bool) -> i128
    pub fn add(&mut self, is_long: bool, delta: i128)
    pub fn total(&self) -> i128
}
```

`get` returns one side. `add` applies a signed delta to one side. `total` returns the sum of both sides, and `set_status` reads it on `notional`, `tokens`, and `margin` to gate retirement. `get` cannot fail. `add` and `total` trap on an `i128` overflow, because the contract builds with overflow checks on.

```rust
fn get_market_data(e: Env) -> MarketData;
```

The view needs no signer and raises no market error. It returns the record as of the last accrual, so the indices and `accrued_at` are as old as the last price-bearing call. An on-chain read extends the shared-tier time-to-live. `accrue` returns the same record after it advances the clock, under the rule on the [pricing page](./pricing.md).

## Archival

The network archives an entry in the instance, shared, or user tier when its time-to-live runs out, and the contract cannot read it until a restoration brings it back. A restoration returns the entry unchanged, so no state is lost.

The instance tier is one ledger entry. It carries the ten instance `DataKey` entries, `OwnableStorageKey::Owner`, `UpgradeableStorageKey::SchemaVersion`, and the reference to the contract code. `extend_instance` extends that single entry, not one key at a time. If it is archived, no entry point runs at all, the views included, until a restoration brings the instance back.

An archived position still counts in the market totals. It must be restored before it can be closed or liquidated. A fill restores an archived order, and the keeper who submits that fill pays for the restoration. `Order.expiration` is a ledger sequence and a pure validity gate, so it is independent of the entry's time-to-live. Every removal of an order runs through contract code, so `Order::escrow_amount` always resolves through a fill, a cancel, or a sweep.

The price cache is the one `DataKey` entry meant to lapse. With no `TerminalPrice` stored, `Market::load` on the working set reads a lapsed cache as absent and prices the call from the submitted report alone. It stores that report as the new cache. Under a stored `TerminalPrice` the cache is neither read nor written.
