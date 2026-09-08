---
title: Market status
sidebar_position: 4
---

# Market status

`Status` is the operational state of a market. It is an instance storage singleton under the `Status` key, stored as its `u32` discriminant. The trader entries and the keeper entries read it before they act. `set_terminal_price` reads it as its first gate. `set_config` reads it only when a borrowing or funding parameter changes. The owner moves it with `set_status`. The wind-down carries two more instance keys, `DelistedAt` and `TerminalPrice`, which this page also covers. `DELIST_GRACE` and `DELIST_DEADLINE` are durations in seconds, and their values are on the [Config page](./config.md).

## Status values

```rust
#[repr(u32)]
pub enum Status {
    Active = 0,   // normal trading
    OnIce = 1,    // opens are blocked, everything else runs
    Frozen = 2,   // every price-bearing and fund-moving entry is halted
    Delisted = 3, // the wind-down
    Retired = 4,  // terminal
}
```

`Status` crosses the contract boundary as a bare `u32`. It appears as the `set_status` argument, the `get_status` return, and the `StatusUpdate` payload. `Status::from_u32` decodes it, and any value above 4 traps `InvalidStatus` (702). `Status::allows_open` is true for `Active` only. It gates every increase fill that adds notional.

## set_status

```rust
fn set_status(e: Env, status: u32);
```

Owner only (`#[only_owner]`). The owner must authorize the call. If the market has no owner, the call traps `OwnerNotSet` (2100) before anything else runs. `status` is the target `Status` discriminant. The call decodes it with `Status::from_u32` and checks the move with `Status::check_transition`. It then applies the side effects of the target, writes `Status`, and publishes `StatusUpdate`.

`Status::check_transition` is pure. It takes the current status, the target, the stored `DelistedAt` if any, and `now`, the ledger timestamp in unix seconds. `delisted_at` is the stored `DelistedAt` value in unix seconds. `DELIST_GRACE` is a duration in seconds.

| From | To | Result |
| --- | --- | --- |
| `Retired` | any | `InvalidStatus` (702) |
| any | the same status | `InvalidStatus` (702) |
| any other | `Frozen`, `Delisted`, `Retired` | allowed |
| any other | `Active`, `OnIce` | allowed if `DelistedAt` is absent or `now < delisted_at + DELIST_GRACE`, else `InvalidStatus` (702) |

The `set_status` body gates retirement on an empty book, through `retire` below.

Side effects by target:

- `Delisted`: writes `DelistedAt = now` only if the key is absent. The first delist anchors the grace and deadline windows. A freeze and a second delist keep that anchor.
- `Active` or `OnIce`: removes `DelistedAt` if present. A later delist starts a fresh window.
- `Retired`: runs `retire`. The call sums each of open interest (token-dec), base size (base-dec), and posted margin (token-dec) over the two sides. If any of the three sums is nonzero, the call traps `MarketNotCleared` (706). Otherwise it computes `surplus = credit_pool - credit_owed` (token-dec). `credit_pool` is the claimable-credit pool (token-dec). `credit_owed` is the credit owed to traders (token-dec). If `surplus > 0`, the market transfers `surplus` of the settlement token to the `Vault` address, sets `credit_pool = credit_owed`, and writes `MarketData`. If the contract token balance is below `surplus`, the transfer traps with the settlement token's own error, and the market keeps its current status.
- `Frozen`: no extra state.

`set_status` writes `Status`, `DelistedAt`, and `MarketData` only. `TerminalPrice` keeps its stored value across every transition.

Errors: `OwnerNotSet` (2100), `InvalidStatus` (702) from `Status::from_u32` or `Status::check_transition`, and `MarketNotCleared` (706) on target `Retired` with a non-empty book. A failed surplus transfer traps with the settlement token's own error. Reads: `Status`, `DelistedAt`, on retirement `MarketData`, and on a positive surplus `Token` and `Vault`. Writes: `Status`, `DelistedAt`, and on retirement with a surplus `MarketData`. The call extends the instance TTL before it decodes `status`. Event: `StatusUpdate { status }`.

## set_terminal_price

```rust
fn set_terminal_price(e: Env, price: i128);
```

Owner only (`#[only_owner]`). The owner must authorize the call. If the market has no owner, the call traps `OwnerNotSet` (2100) before anything else runs. `price` is the flat settlement price in price_scalar, the feed's native precision. The checks run in this order:

1. Status is not `Delisted`: `InvalidStatus` (702).
2. `grace_expired` is false: `InvalidStatus` (702).
3. `price <= 0`: `InvalidPrice` (701).

The call writes `TerminalPrice` and publishes `TerminalPriceUpdate { price }`. It runs any number of times, and each run replaces the stored value. `TerminalPrice` is sticky, because no entry removes it. From the first write on, `Market::load` prices every price-bearing entry flat at it. It sets both `bid` and `ask` to the stored `TerminalPrice` in price_scalar. It sets `publish_time` to `now`, the ledger timestamp in unix seconds. It ignores the submitted price bytes and skips the oracle call. The pricing mechanics are on the [Pricing page](./pricing.md).

Errors: `OwnerNotSet` (2100), `InvalidStatus` (702), `InvalidPrice` (701). Reads: `Status`, `DelistedAt`. Writes: `TerminalPrice`. The call extends the instance TTL before it reads `Status`. Event: `TerminalPriceUpdate { price }`.

## Views

```rust
fn get_status(e: Env) -> u32;
fn get_retirement(e: Env) -> Option<(i128, u64)>;
```

`get_status` returns the `Status` discriminant. The constructor writes `Active`, and `set_status` is the only other writer of the key, so the stored value is always one of the five discriminants. Errors: none.

`get_retirement` returns `None` while `DelistedAt` is absent. Otherwise it returns `(terminal_price, delisted_at)`. `terminal_price` is the stored `TerminalPrice` in price_scalar, or `0` while none is set. `delisted_at` is `DelistedAt` in unix seconds. Errors: none. Both views are read-only and leave the instance TTL as it is.

## Timing predicates

Both predicates read `DelistedAt` and `now` (unix seconds). `DELIST_GRACE` and `DELIST_DEADLINE` are durations in seconds. Both predicates are false while `DelistedAt` is absent. Each addition to `delisted_at` saturates.

| Predicate | True when | Effect |
| --- | --- | --- |
| `grace_expired` | `now >= delisted_at + DELIST_GRACE` | Unlocks `set_terminal_price`. |
| `deadline_passed` | `now >= delisted_at + DELIST_DEADLINE` | With status `Delisted`, waives `NotLiquidatable` (722) in `execute_liquidation`. |

`grace_expired` is private, and `set_terminal_price` is its one caller. `deadline_passed` is crate-visible and read by `execute_liquidation`. `Status::check_transition` locks the `Active` and `OnIce` targets on the same grace arithmetic, which it applies to its own `delisted_at` and `now` arguments.

## Status gates by entry

The owner entries `set_config`, `upgrade`, and the ownership entries run in every status. `set_status` runs in every status except `Retired`, which is terminal. `set_terminal_price` runs in `Delisted` only. Every view runs in every status. `set_config` carries one status-dependent rule. A change to a borrowing or funding parameter traps `MarketNotAccrued` (703) unless the market accrued in the current ledger, and `Frozen` waives that precondition. A `Retired` market never accrues again, so every later ledger traps that change. The [Config page](./config.md) holds the rule. The table below covers the trader and keeper entries.

| Entry | Status | Effect |
| --- | --- | --- |
| `create_order` | `Frozen`, `Retired` | traps `MarketFrozen` (704) |
| `cancel_order` | `Frozen` | traps `MarketFrozen` (704) |
| `create_vault_order`, both kinds | `Frozen` | traps `MarketFrozen` (704), after `UnknownKind` (734) and `NegativeValueNotAllowed` (710) |
| `create_vault_order`, deposit | `Retired` | traps `InvalidStatus` (702) |
| `create_vault_order`, redeem | `Retired` | runs the instant redeem and returns id `0` |
| `cancel_vault_order` | `Frozen` | traps `MarketFrozen` (704) |
| `claim_credit` | `Frozen` | traps `MarketFrozen` (704) |
| `execute_order`, `execute_liquidation`, `execute_vault_order`, `execute_adl`, `update_adl_state`, `accrue` | `Frozen`, `Retired` | traps `MarketFrozen` (704) in `Market::load`, before the oracle call |
| `execute_order`, increase with `order.notional > 0` | `OnIce`, `Delisted` | traps `IncreaseHalted` (705), after the `Market::load` gate, `OrderNotFound` (730), and `UnknownKind` (734) |
| `execute_order`, increase with `order.notional == 0` | `Active`, `OnIce`, `Delisted` | runs |
| `execute_liquidation` | `Delisted` with `deadline_passed` | waives `NotLiquidatable` (722), closes the position even when its settled equity covers the maintenance requirement, and still charges `liq_fee` |

An increase fill with `order.notional > 0` also traps `IncreaseHalted` (705) when the side's `AdlState` flag is set, in every status that reaches the fill. The instant redeem is on the [Vault orders page](./vault-orders.md). The waived liquidation is on the [Liquidation page](./liquidation.md).

## Invariants

`DelistedAt` is written once per wind-down, on the first delist. Only a revert to `Active` or `OnIce` before `delisted_at + DELIST_GRACE` removes it. From `delisted_at + DELIST_GRACE` on, the trading statuses are unreachable, and `Frozen`, `Delisted`, and `Retired` remain. `Retired` is terminal. With an empty book and a token balance that covers the surplus sweep, `Retired` is reachable from every other status. The switch to flat pricing follows the presence of `TerminalPrice`, not the status value. Through `Delisted`, accrual and every keeper fill except an increase that adds notional keep running, priced flat once a terminal price exists.
