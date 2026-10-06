---
sidebar_position: 16
title: Storage
description: Market storage keys, records, TTL tiers, archival, and restoration.
---

# Storage

The `DataKey` enum names every value the market contract owns, apart from three keys that its two mixed-in libraries own. This page holds the four time-to-live (TTL) tiers with their constants, the ledger key table, and the `MarketData` singleton. The last column of the key table names the page that owns each key's semantics.

## Four tiers set every time-to-live

A ledger lasts about 5 seconds. A threshold is the remaining TTL below which an access extends an entry. A bump is the TTL to which the access extends it. Both are counts of ledgers.

| Constant | Ledgers | Time |
| --- | --- | --- |
| `ONE_DAY_LEDGERS` | 17_280 | 1 day |
| `LEDGER_THRESHOLD_INSTANCE` | 518_400 | 30 days |
| `LEDGER_BUMP_INSTANCE` | 535_680 | 31 days |
| `LEDGER_THRESHOLD_SHARED` | 777_600 | 45 days |
| `LEDGER_BUMP_SHARED` | 794_880 | 46 days |
| `LEDGER_THRESHOLD_USER` | 1_728_000 | 100 days |
| `LEDGER_BUMP_USER` | 2_073_600 | 120 days |
| `LEDGER_THRESHOLD_PRICE_CACHE` | 720 | about 1 hour |
| `LEDGER_BUMP_PRICE_CACHE` | 17_280 | 1 day |

### Instance

The instance carries the small read-mostly state. That state is the parameters, the four wired addresses, the feed id, the status, the wind-down markers, and the auto-deleveraging (ADL) flags. It loads whole with every invocation.

`extend_instance` opens the body of fourteen entry points.

| Group | Entry points |
| --- | --- |
| Owner calls | `set_config`, `set_status`, `set_terminal_price` |
| Trader calls | `create_order`, `cancel_order`, `create_vault_order`, `cancel_vault_order`, `claim_credit` |
| Price-bearing calls | `execute_order`, `execute_liquidation`, `update_adl_state`, `execute_adl`, `execute_vault_order`, `accrue` |

On the three owner calls the owner check runs ahead of `extend_instance`, and the owner must sign each of them. `__constructor` calls it last, after every write it makes. `upgrade` also needs the owner's signature. It calls `extend_instance` after the owner checks and before it replaces the contract WebAssembly. The views leave the instance TTL as it is. So do the four `Ownable` entry points `get_owner`, `transfer_ownership`, `accept_ownership`, and `renounce_ownership`.

### Shared

`MarketData` is the only entry in the shared tier. Both `get_market_data` and `set_market_data` extend it, so an on-chain call of the `get_market_data` view extends the entry. A simulated call leaves no footprint.

### User

The user tier holds the five per-user keys. `get_order` and `get_vault_order` extend the entry they read. `get_position` extends the row it finds and extends nothing on a miss. `set_position`, `set_order`, and `set_vault_order` extend the entry they write. `get_claimable_credit` and `get_order_counter` read without extending. Only `add_claimable_credit` and `next_order_id` extend those two keys. The removal helpers extend nothing.

### Temporary

`PriceCache` is the only temporary `DataKey` entry. Soroban does not refresh the TTL of a live temporary entry on a plain rewrite, so `set_price_cache` calls `extend_ttl` on every write with threshold `LEDGER_THRESHOLD_PRICE_CACHE` and bump `LEDGER_BUMP_PRICE_CACHE`.

The threshold must exceed the widest close window of the oracle, `MAX_CLOSE_STALENESS_SECONDS`, which is 120 seconds. A shorter threshold lets a report that the cache has superseded outlive the cache and price a protective call again.

## Ledger keys

Class is the Soroban storage type. Tier is the TTL tier from the previous section.

| Key | Value | Class | Tier | Written by | Semantics |
| --- | --- | --- | --- | --- | --- |
| `Config` | `Config` | instance | instance | `__constructor`, `set_config` | [Config](./config.md) |
| `FeedId` | `BytesN<32>` | instance | instance | `__constructor` | [Constructor and dependencies](./dependencies.md) |
| `Status` | `u32`, a `Status` discriminant | instance | instance | `__constructor`, `set_status` | [Market status](./status.md) |
| `Vault` | `Address` | instance | instance | `__constructor` | [Constructor and dependencies](./dependencies.md) |
| `Token` | `Address` | instance | instance | `__constructor` | [Constructor and dependencies](./dependencies.md) |
| `Oracle` | `Address` | instance | instance | `__constructor` | [Constructor and dependencies](./dependencies.md) |
| `Treasury` | `Address` | instance | instance | `__constructor` | [Constructor and dependencies](./dependencies.md) |
| `DelistedAt` | `u64`, seconds | instance | instance | `set_status`, which sets it on the first delist and removes it on a return to `Active` or `OnIce` | [Market status](./status.md) |
| `TerminalPrice` | `i128`, feed precision | instance | instance | `set_terminal_price` | [Market status](./status.md) |
| `Adl` | `AdlState` | instance | instance | `update_adl_state` | [Auto-deleveraging](./auto-deleveraging.md) |
| `MarketData` | `MarketData` | persistent | shared | `__constructor`, `Market::store`, `claim_credit`, the retirement sweep in `set_status` | This page |
| `PriceCache` | `PriceData` | temporary | temporary | `Market::load`, when no cache entry exists or the verified report is newer than the cache | [Pricing](./pricing.md) |
| `Position(Address, bool)` | `Position` | persistent | user | `create_order`, `cancel_order` on a decrease, `Position::store` | [Position lifecycle](./position-lifecycle.md) |
| `VaultOrder(Address, u32)` | `VaultOrder` | persistent | user | `create_vault_order`. Cancel, fill, and the `min_out` rejection in `execute_vault_order` remove it. | [Vault orders](./vault-orders.md) |
| `Order(Address, u32)` | `Order` | persistent | user | `create_order`. Cancel, fill, and the closure sweep remove it. | [Orders](./orders.md) |
| `OrderCounter(Address)` | `u32` | persistent | user | `next_order_id` | [Orders](./orders.md) |
| `ClaimableCredit(Address)` | `i128`, token-dec | persistent | user | Earned funding in `Position::settle_accruals`, a parked payout in `pay_trader`, `claim_credit` | [Funding rate](./funding-rate.md) |

The [units page](../units.md) defines token-dec, base-dec, feed precision, `SCALAR_18`, and seconds.

`create_order` stores the target `Position` row whenever it is missing, so the creation transaction funds its initial rent. The transaction's fee payer pays the network charge. A relayer can pay that charge and collect a separate token fee through the fee forwarder.

A decrease order always rewrites the row, because its id joins the side's decrease list. An increase order leaves an existing row untouched. `Position::store` covers every other write, the fills, the liquidation, and the ADL fill included. A closed position persists as the zeroed row.

Eight keys exist from the constructor onward. They are the seven instance keys it writes and `MarketData`. The other keys are lazy, and the contract creates each one on its first write. Exactly one lazy write sits on a read path. When `PriceCache` is absent, `Market::load` stores the verified report. `get_position` writes nothing on a miss and returns the zeroed row.

An absent key reads as a default where the contract defines one.

| Key | Reading when absent |
| --- | --- |
| `Adl` | `AdlState::default`, which is `{ long: false, short: false }` |
| `ClaimableCredit` | `0` |
| `OrderCounter` | `1` |
| `Position` | The zeroed row, with no write |
| `Order` | Trap with `OrderNotFound` (730) |
| `VaultOrder` | Trap with `VaultOrderNotFound` (750) |
| `DelistedAt`, `TerminalPrice`, `PriceCache` | No default. The caller tests for presence. |

`Position(Address, bool)` is keyed by the account and the side, so the long row and the short row of one account are independent. No path removes a `Position`, `ClaimableCredit`, or `OrderCounter` row.

Three keys sit outside `DataKey`. `OwnableStorageKey::Owner` holds the owner `Address`. `UpgradeableStorageKey::SchemaVersion` holds `1`. Both are instance entries that share the instance TTL. `OwnableStorageKey::PendingOwner` is a temporary entry that holds `PendingTransfer { address, live_until_ledger }` while a two-step transfer is open. The [Ownership and upgrade](./dependencies.md#ownership-and-upgrade) section gives the transfer rule. The oracle, factory, treasury, and governance contracts hold the same `Ownable` keys. The treasury and governance contracts hold no `SchemaVersion`.

## The market record holds the whole book

`MarketData` is the market's own book. It is a contract type, so it crosses the application binary interface whole as the return of `accrue` and of `get_market_data`. The constructor writes its `Default`, with every field zero except `accrued_at`, which is the deploy ledger's timestamp.

| Field | Type | Unit and meaning |
| --- | --- | --- |
| `notional` | `SidePair` | token-dec. Open interest per side. |
| `margin` | `SidePair` | token-dec. Posted margin per side. |
| `tokens` | `SidePair` | base-dec. Base size per side, the sum of each position's `tokens`. |
| `funding_idx` | `SidePair` | `SCALAR_18`. The cumulative funding index per side, signed. |
| `borrowing_idx` | `SidePair` | `SCALAR_18`. The cumulative borrowing index per side, non-decreasing. |
| `funding_rate` | `i128` | `SCALAR_18` per second, signed. Positive means longs pay. |
| `accrued_at` | `u64` | seconds. The last accrual timestamp. Both indices share it. |
| `credit_pool` | `i128` | token-dec. The ledger of funding claims, parked payouts included. It is a ledger and not a balance. |
| `credit_owed` | `i128` | token-dec. The total of every `ClaimableCredit` balance. |

The [funding rate page](./funding-rate.md) holds the writers of `credit_pool` and `credit_owed`, the surplus between them, and the invariant. It also states that the retirement sweep traps when the ledger exceeds the contract's token balance.

The fields `notional`, `margin`, `tokens`, `funding_idx`, and `borrowing_idx` use `SidePair`:

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

The view needs no signer and raises no market error. It returns the record as of the last accrual, so the indices and `accrued_at` are as old as the last price-bearing call. An on-chain read extends the shared-tier TTL. `accrue` returns the same record after it advances the clock, under the rule on the [pricing page](./pricing.md).

## Archival removes access and keeps state

The network archives an entry in the instance, shared, or user tier when its TTL runs out. The contract cannot read the entry until a restoration brings it back. A restoration returns the entry unchanged, so no state is lost.

The instance tier is one ledger entry. It carries the ten instance `DataKey` entries, `OwnableStorageKey::Owner`, `UpgradeableStorageKey::SchemaVersion`, and the reference to the contract code. `extend_instance` extends that single entry and not one key at a time. If the instance is archived, no entry point runs at all, the views included, until a restoration brings it back.

An archived position still counts in the market totals. It must be restored before it can be closed or liquidated. A fill restores an archived order, and the fee payer of the transaction that submits the fill, the keeper or its relayer, pays for the restoration. `Order.expiration` is a ledger sequence and a pure validity gate, so it is independent of the entry's TTL.

Archival never removes an order or its escrow. Only a fill, a cancel, or a closure sweep removes the row. The cancel and the closure sweep refund `Order::escrow_amount`, and a fill spends it.

The price cache is the one `DataKey` entry meant to lapse. With no `TerminalPrice` stored, `Market::load` reads a lapsed cache as absent and prices the call from the verified report alone. It stores that report as the new cache. Under a stored `TerminalPrice` the cache is neither read nor written.

Archival therefore changes what the contract can reach and never what it holds. Every archived entry returns unchanged on restoration, except the price cache, which the next verified report rebuilds.

:::info Archived state needs restoration
Archival preserves persistent state and order escrow. Restoration adds a network cost before that state can be accessed again.

Order expiration is independent of storage time-to-live. It does not remove escrow or refund it.
:::
