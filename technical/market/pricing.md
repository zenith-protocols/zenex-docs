---
sidebar_position: 5
title: Pricing
---

# Pricing

A price-bearing entry prices its whole call at one `PriceData`. `Market::load` resolves that price once, and every gate, fee, and mark in the call reads it. Six entries carry a `price: Bytes` argument, the serialized oracle report: `execute_order`, `execute_vault_order`, `execute_liquidation`, `update_adl_state`, `execute_adl`, and `accrue`. Each one loads the working set, runs one action, then writes the market record back with `Market::store`.

## `PriceData`

The market declares `PriceData` with the same XDR encoding as the oracle.

| Field | Type | Unit |
|---|---|---|
| `bid` | `i128` | feed precision, after the oracle's spread reduction |
| `ask` | `i128` | feed precision, the same scale as `bid` |
| `publish_time` | `u64` | seconds, the report's observation time |

```rust
pub fn entry(&self, is_long: bool) -> i128
pub fn exit(&self, is_long: bool) -> i128
```

Each takes the side and returns one price. `PriceData::entry` returns `ask` for a long and `bid` for a short. `PriceData::exit` returns `bid` for a long and `ask` for a short. A fill sizes a position at the entry side, and a close or a liquidation realizes its profit and loss (PnL) at the exit side. The market's own marks pick their side from a different selector. `MarketData::side_pnl` picks by its `maximize` flag. A maximized long marks at `ask` and a minimized long marks at `bid`. A maximized short marks at `bid` and a minimized short marks at `ask`. `MarketData::side_reserved` has no such flag, and it returns a token-dec value rather than a price. The long side is the long token balance marked at `ask`. The short side is the stored short entry notional (token-dec). The [units page](../units.md) defines feed precision.

## The `Market` working set

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

`vault_balance` is read from the vault once. Every `Settlement::settle` in the call then adds its own vault leg to the tracked value. A deposit fill adds the order amount less the vault fee. Its settlement leg then adds the vault's share of that fee on top, which is the fee less the keeper and treasury cuts. A redeem fill subtracts the assets the vault released. The utilization caps, the PnL allowances, and the `VaultInsolvent` (755) check all read this tracked value. So does the `VaultBalanceExceeded` (753) cap, which runs on a deposit fill after the settlement.

## `Market::load`

```rust
pub fn load(e: &Env, price_data: &Bytes, newest_price: bool, protective: bool) -> Self
```

The load runs in four steps.

1. Status gate. If `Status` is `Frozen` or `Retired`, the call traps `MarketFrozen` (704). The gate runs before any price work, so a frozen market makes no oracle call. The [status page](./status.md) gives the per-entry gates.
2. Price resolution. If `TerminalPrice` is stored, `bid` and `ask` both take the stored terminal price, in feed precision, and `publish_time` takes `now`. The market ignores `price_data`, skips the oracle, and leaves `PriceCache` unread and unwritten. Otherwise the market calls `verify_price` with `price_data`, the stored `FeedId`, and `protective`. A report the Chainlink verifier rejects traps inside the verifier with the verifier's own error code. A report an oracle gate rejects traps with an `OracleError`, listed on the [price verification page](../oracle/verify-price.md). The verified price then passes through the cache rules below.
3. State. The load reads `Config`, `MarketData`, `Token`, and `Vault`, and reads `vault_balance` from the vault.
4. Accrual. `elapsed = now - MarketData.accrued_at`, in seconds. `now` is a `u64` in seconds, the ledger timestamp at load. `MarketData.accrued_at` is a `u64` in seconds, the ledger timestamp of the last accrual. The load runs `MarketData::accrue_borrowing` at the effective price, then `MarketData::accrue_funding`, then stamps `accrued_at` with `now`. Both indices share one clock. At zero elapsed neither index moves.

Every path reads `Status`, `Config`, `MarketData`, `Token`, and `Vault`, tests `TerminalPrice` for presence, and calls `total_assets` on the vault. A market with a stored terminal price reads that key. A market without one reads `Oracle`, `FeedId`, and `PriceCache`, and calls `verify_price` on the oracle. The only market key the load writes is `PriceCache`, under the cache rules below. The read of `MarketData` extends that entry's TTL. Every price-bearing entry extends the contract instance before the load runs. The [borrowing rate](./borrowing-rate.md) and [funding rate](./funding-rate.md) pages give the two index formulas.

### Flags per entry

`newest_price` allows the cache substitution in the rules below. `protective` widens the backward staleness window from `trade_staleness` to `close_staleness`. The forward allowance stays `trade_staleness` under either setting of `protective`. The [price verification page](../oracle/verify-price.md) gives both windows.

| Entry | `newest_price` | `protective` | Backward window |
|---|---|---|---|
| `execute_order` | `false` | `false` | `trade_staleness` |
| `execute_vault_order` | `true` | `false` | `trade_staleness` |
| `execute_liquidation` | `true` | `true` | `close_staleness` |
| `update_adl_state` | `true` | `true` | `close_staleness` |
| `execute_adl` | `true` | `true` | `close_staleness` |
| `accrue` | `true` | `true` | `close_staleness` |

The flags govern a market with no stored terminal price. `execute_order` fills at the submitted payload, so its trigger and bound checks judge the price the keeper chose. Every other entry executes at the newer of the payload and the cache. Under a stored terminal price no entry reads the payload or the cache.

## `PriceCache`

`PriceCache` is a temporary entry that holds the newest verified price the market has consumed. Its TTL is 16 ledgers (`LEDGER_BUMP_PRICE_CACHE`), used as both threshold and extend-to on every write. A lapsed entry reads as absent, and the next verified payload seeds it again. The entry moves forward only on `publish_time`. A trap later in the same invocation reverts the write with that invocation's other effects. The [units page](../units.md) gives the trap scope under the router's catching calls.

In the rules below, `submitted` is the verified payload and `cached` is the stored entry. The load applies the first matching rule.

| Condition | Effective price | Cache write |
|---|---|---|
| no cache entry | `submitted` | `submitted` |
| `submitted.publish_time > cached.publish_time` | `submitted` | `submitted` |
| `newest_price` and `cached.publish_time > submitted.publish_time` | `cached` | none |
| every other case | `submitted` | none |

The last rule covers an equal `publish_time` under either flag, and an older payload with `newest_price` false. An equal timestamp keeps the submitted payload with its own `bid` and `ask`, and leaves the cache as it stands.

## `Market::store`

```rust
pub fn store(&self, e: &Env)
```

`Market::store` writes `data` back to `MarketData` and extends its TTL. Every price-bearing entry calls it once, after its action.

## `accrue`

```rust
fn accrue(e: Env, price: Bytes) -> MarketData;
```

- Auth: none. The entry takes no `keeper` argument and pays no reward.
- Body: `Market::load` with `newest_price` and `protective` both `true`, then `Market::store`. Returns the stored `MarketData`.
- Errors: `MarketFrozen` (704). A report the Chainlink verifier rejects traps inside the verifier with the verifier's own error code, and a report an oracle gate rejects traps with an `OracleError`.
- Storage written: `MarketData`, and `PriceCache` when no cache entry exists or the payload is newer than the cached report. A stored `TerminalPrice` leaves `PriceCache` untouched.
- Event: `AccrualUpdate`, an empty payload, published on every successful call, including a call at zero elapsed.

`accrue` is the maintenance path for a market with no fill traffic. It advances both indices when time has elapsed, stamps `MarketData.accrued_at` with the ledger timestamp at load, and moves the price cache forward under the rules above. Every price-bearing entry stamps `accrued_at` the same way. A borrowing or funding change needs an accrual in the ledger of the `set_config` call itself, so an earlier accrual does not clear the guard. The [config page](./config.md) gives that guard and the fields it covers.

## The position price floor

`Position.priced_at` (seconds) holds the `publish_time` of the price the position last filled at. `Position::increase` and a partial `Position::decrease` set it to the effective price's `publish_time`. A full close stores an all-zero `Position` in place of the row, so `priced_at` reads `0`.

If the effective price's `publish_time` is below `priced_at`, `Position::require_price_not_stale` traps `StalePrice` (740). An equal `publish_time` passes. `execute_order`, `execute_liquidation`, and `execute_adl` apply the floor after `Market::load` and before the position changes. The floor judges the effective price, so a substituted cache mark counts. Under a terminal price, `publish_time` equals `now`. The oracle accepts an observation up to `trade_staleness` seconds ahead of the ledger clock, so `priced_at` can sit above `now`. `Position::require_price_not_stale` traps in that case. Across the life of one open row the stamp never falls, because a fill that passes the floor sets `priced_at` to its own `publish_time`.

Three further anchors raise `StalePrice` (740) against an order's `created_at` rather than against a position. The [orders page](./orders.md) gives the `Order.created_at` anchor on `execute_order`. The [vault orders page](./vault-orders.md) gives the two anchors on `execute_vault_order`. One compares the effective price's `publish_time` to `created_at`. The other compares the ledger timestamp at load to `created_at`.
