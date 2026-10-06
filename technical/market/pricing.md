---
sidebar_position: 5
title: Pricing
description: Effective quotes, cached reports, terminal pricing, timestamps, and accrual.
---

# Pricing

This page covers how a price-bearing entry of the `market` resolves the price it executes at. It also covers how the price cache and the terminal price change that price, and how the position price floor and the accrual clock use it. Six entries carry a `price: Bytes` argument, the serialized oracle report: `execute_order`, `execute_vault_order`, `execute_liquidation`, `update_adl_state`, `execute_adl`, and `accrue`. Each one extends the contract instance, loads the working set once, runs one action, and writes the market record back with `Market::store`. `Market::load` resolves the price once, so every gate, fee, and mark in the call reads the same `PriceData`.

## `PriceData` holds a bid, an ask, and an observation time

The market declares its own `PriceData` with the same External Data Representation (XDR) encoding as the oracle's type. The market can then decode the value `verify_price` returns. The [price verification page](../oracle/verify-price.md) defines how the oracle builds it.

| Field | Type | Unit |
|---|---|---|
| `bid` | `i128` | feed precision, after the oracle's spread reduction |
| `ask` | `i128` | feed precision, the same scale as `bid` |
| `publish_time` | `u64` | seconds, the report's observation time |

```rust
pub fn entry(&self, is_long: bool) -> i128
pub fn exit(&self, is_long: bool) -> i128
```

`PriceData::entry` and `PriceData::exit` each take the side and return one price. A fill sizes a position at the entry side. A close or a liquidation realizes its profit and loss (PnL) at the exit side. Each side takes the quote that is worse for the trader, so a round trip at an unchanged quote pays the spread.

| Side | `entry` | `exit` |
|---|---|---|
| Long | `ask` | `bid` |
| Short | `bid` | `ask` |

Marks of a whole side pick their price through a `maximize` flag on `MarketData::side_pnl`, which the [PnL page](./pnl-calculation.md#a-side-marks-from-its-aggregates) defines. `MarketData::side_reserved` returns a token-dec value and is defined on the [margin and leverage page](./margin-and-leverage.md#utilization). The [units page](../units.md) defines feed precision.

## The `Market` working set carries the price and a tracked vault balance

Two things carry the name `Market`. One is the trait that declares the contract entries. The other is the working set below, the struct a price-bearing entry loads.

| Field | Type | Unit or meaning |
|---|---|---|
| `config` | `Config` | the stored config at load |
| `data` | `MarketData` | the stored market record, mutated in place, written back by `Market::store` |
| `status` | `Status` | the status at load |
| `price` | `PriceData` | the effective price for the call |
| `token` | `Address` | the settlement token |
| `vault` | `Address` | the strategy vault |
| `vault_balance` | `i128` | token-dec, `VaultClient::total_assets` at load, then tracked through the call |
| `now` | `u64` | seconds, the ledger timestamp at load |

`vault_balance` is read from the vault once. Every `Settlement::settle` in the call then adds its own vault leg to the tracked value, and a draw is a negative leg. A deposit fill adds the order amount less the vault fee. Its settlement leg then adds the vault's share of that fee, which is the fee less the keeper and treasury cuts. A redeem fill subtracts the assets the vault released before its settlement leg. The utilization caps, the PnL allowances, and the `VaultInsolvent` (755) check all read this tracked value. So does the `VaultBalanceExceeded` (753) cap, which runs on a deposit fill after the settlement. The tracked value lets each gate judge the balance the call leaves behind and not the balance it found.

## `Market::load` resolves the price before it touches any position

```rust
pub fn load(e: &Env, price_data: &Bytes, newest_price: bool, protective: bool) -> Self
```

The load runs in four steps.

1. Status gate. If `Status` is `Frozen` or `Retired`, the call traps `MarketFrozen` (704). The gate runs before any price work, so a frozen market makes no oracle call. The [status page](./status.md) gives the per-entry gates.
2. Price resolution. If `TerminalPrice` is stored, `bid` and `ask` both take the stored terminal price in feed precision, and `publish_time` takes `now`. The market ignores `price_data`, skips the oracle, and leaves `PriceCache` unread and unwritten. Otherwise the market calls `verify_price` with `price_data`, the stored `FeedId`, and `protective`. A report the Chainlink verifier rejects traps inside the verifier with the verifier's own error code. A report an oracle gate rejects traps with an `OracleError`, listed on the [price verification page](../oracle/verify-price.md). The verified price then passes through the cache rules below.
3. State. The load reads `Config`, `MarketData`, `Token`, and `Vault`, and reads `vault_balance` from the vault.
4. Accrual. The load computes the elapsed time, runs `MarketData::accrue_borrowing` at the effective price, then `MarketData::accrue_funding`, and stamps `MarketData.accrued_at` with `now`.

```
elapsed = now - MarketData.accrued_at
```

Where `now` is the ledger timestamp at load and `MarketData.accrued_at` is the ledger timestamp of the last accrual, both `u64` in seconds. Borrowing and funding accrue over the same `elapsed`, so both indices move together and reach `now` at once. The accrual runs before any position is touched, so every position settles against indices that are current at the effective price. At `elapsed` of zero neither index moves. A market accrued at second 1000 and loaded at second 1005 accrues over 5 seconds.

Every path reads `Status`, `Config`, `MarketData`, `Token`, and `Vault`, tests `TerminalPrice` for presence, and calls `total_assets` on the vault. A market with a stored terminal price reads that key. A market without one reads `Oracle`, `FeedId`, and `PriceCache`, and calls `verify_price` on the oracle. The only market key the load writes is `PriceCache`, under the cache rules below. The read of `MarketData` extends that entry's time to live (TTL). The [borrowing rate](./borrowing-rate.md) and [funding rate](./funding-rate.md) pages give the two index formulas.

### Two flags set the class of each entry

`newest_price` allows the cache substitution in the rules below. `protective` widens the backward staleness window from `trade_staleness` to `close_staleness`. The forward allowance stays `trade_staleness` under either setting of `protective`. The [price verification page](../oracle/verify-price.md) gives both windows.

| Entry | `newest_price` | `protective` | Backward window |
|---|---|---|---|
| `execute_order` | `false` | `false` | `trade_staleness` |
| `execute_vault_order` | `true` | `false` | `trade_staleness` |
| `execute_liquidation` | `true` | `true` | `close_staleness` |
| `update_adl_state` | `true` | `true` | `close_staleness` |
| `execute_adl` | `true` | `true` | `close_staleness` |
| `accrue` | `true` | `true` | `close_staleness` |

The flags govern a market with no stored terminal price. `execute_order` fills at the submitted payload, so its trigger and bound checks judge the price the keeper chose, under the strict window. `execute_vault_order` is a voluntary fill, so it keeps the strict window and still executes at the newest price. The four protective entries must survive a feed gap. Each accepts a report older than the trade window and executes at the newer of the payload and the cache, so a liquidation lands through a gap or one ledger late. Under a stored terminal price no entry reads the payload or the cache.

## `PriceCache` holds the newest verified price and moves only forward

`PriceCache` is a temporary entry that holds the newest verified price the market has consumed. Each write also extends its TTL. The [storage page](./storage.md#temporary) gives the threshold, the extend-to value, and the reason the threshold exceeds the oracle's widest close window. A lapsed entry reads as absent, and the next verified payload seeds it again. A trap later in the same invocation reverts the write with that invocation's other effects. The [router batching page](../router/batching.md) gives the trap scope under the router's isolated calls.

In the rules below, `submitted` is the verified payload and `cached` is the stored entry. The load applies the first matching rule.

| Condition | Effective price | Cache write |
|---|---|---|
| no cache entry | `submitted` | `submitted` |
| `submitted.publish_time > cached.publish_time` | `submitted` | `submitted` |
| `newest_price` and `cached.publish_time > submitted.publish_time` | `cached` | none |
| every other case | `submitted` | none |

The last rule covers an equal `publish_time` under either flag, and an older payload with `newest_price` false. An equal timestamp keeps the submitted payload with its own `bid` and `ask`, and leaves the cache as it stands. The cache therefore never moves back.

The rows below apply the rules to a cache entry with a `publish_time` of 100.

| `submitted.publish_time` | `newest_price` | Effective `publish_time` | Cache after the call |
|---|---|---|---|
| 110 | `false` or `true` | 110 | the submitted payload |
| 100 | `false` or `true` | 100, the submitted `bid` and `ask` | unchanged |
| 90 | `true` | 100, the cached `bid` and `ask` | unchanged |
| 90 | `false` | 90 | unchanged |

:::info A cached quote can differ from the submitted report
Vault fills and protective entries can use a strictly newer cached quote. Trade-order fills use their submitted report after verification.

A stored terminal price overrides both paths.
:::

## `Market::store` writes the record back

```rust
pub fn store(&self, e: &Env)
```

`Market::store` writes `data` back to `MarketData` and extends its TTL. Every price-bearing entry calls it once, after its action.

## `accrue` advances both indices without a position

```rust
fn accrue(e: Env, price: Bytes) -> MarketData;
```

- Auth: any account may call `accrue`. No signature is required and the call pays no reward.
- Effect: accrues both indices to the ledger timestamp, moves the price cache under the rules above, and stores `MarketData`. It returns the stored `MarketData`.
- Errors: `MarketFrozen` (704). A report the Chainlink verifier rejects traps with the verifier's own error code. A report an oracle gate rejects traps with an `OracleError`.
- Storage written: `MarketData`, and `PriceCache` when no cache entry exists or the payload is newer than the cached report. A stored `TerminalPrice` leaves `PriceCache` untouched.
- Event: `accrual_update`, published as `AccrualUpdate` with an empty payload on every successful call, including a call at zero elapsed. The [events page](./events.md) gives the layout.

`accrue` is the maintenance path for a market with no fill traffic. Every price-bearing entry stamps `accrued_at` the same way, so `accrue` adds only the price cache movement and the event. Unless the status is `Frozen`, a borrowing or funding change traps `MarketNotAccrued` (703) in `set_config`. The trap fires when `accrued_at` differs from the ledger timestamp of that call. An earlier accrual does not clear that guard. The [config page](./config.md) gives the guard and the fields it covers.

## The position price floor keeps each row's mark monotone {#the-position-price-floor}

`Position.priced_at` (seconds) holds the `publish_time` of the price the position last filled at. `Position::increase` and a partial `Position::decrease` set it to the effective price's `publish_time`. A full close stores an all-zero `Position` in place of the row, so `priced_at` reads `0`. A side with no stored row loads as the same zeroed row, and that load writes nothing.

If the effective price's `publish_time` is below `priced_at`, `Position::require_price_not_stale` traps `StalePrice` (740). An equal `publish_time` passes. `execute_order`, `execute_liquidation`, and `execute_adl` apply the floor after `Market::load` and before the position changes. The floor judges the effective price, so a substituted cache mark counts. Across the life of one open row `priced_at` never falls, because a fill that passes the floor sets `priced_at` to its own `publish_time`.

Under a terminal price, `publish_time` equals `now`. The oracle accepts an observation up to `trade_staleness` seconds ahead of the ledger clock, so `priced_at` can sit above `now`. In that case an execution under a terminal price traps `StalePrice` (740) until `now` reaches `priced_at`.

Three further anchors raise `StalePrice` (740) against an order's `created_at` and not against a position. The [orders page](./orders.md) gives the `Order.created_at` anchor on `execute_order`. The [vault orders page](./vault-orders.md) gives the two anchors on `execute_vault_order`. One compares the effective price's `publish_time` to `created_at`. The other compares the ledger timestamp at load to `created_at`.

## One price serves the whole call

A single call prices every gate, fee, and mark at one `PriceData`, and the entry class fixes which report that is. A fill at `execute_order` executes at the report the keeper submitted. A protective entry executes at the newer of its report and the cache. A stored terminal price replaces both. The floor on `priced_at` and the anchors on `created_at` bound how far back any of these prices can reach.
