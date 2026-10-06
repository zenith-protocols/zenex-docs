---
title: Market status
description: Market statuses, transitions, wind-down timestamps, and entry-point gates.
sidebar_position: 4
---

# Market status

This page covers the five statuses of a market, the two owner calls that move it through a wind-down (`set_status` and `set_terminal_price`), the two views that read the wind-down, and the gate each status applies to every other entry.

`Status` is an instance storage singleton under the `Status` key, stored as its `u32` discriminant. The instance tier holds it so that the status gate reads it without loading `Config`. The wind-down adds two lazy instance keys, `DelistedAt` and `TerminalPrice`. `DELIST_GRACE` and `DELIST_DEADLINE` are durations in seconds, and the [Config page](./config.md) holds their values.

## Five statuses, and only one accepts an increase that adds notional

```rust
#[repr(u32)]
pub enum Status {
    Active = 0,   // normal trading
    OnIce = 1,    // an increase that adds notional is halted, everything else runs
    Frozen = 2,   // every price-bearing and fund-moving entry is halted
    Delisted = 3, // the wind-down, revertible within DELIST_GRACE
    Retired = 4,  // terminal, only credit claims, instant redeems, and cancels remain
}
```

An increase adds notional when its `order.notional` is above zero. An increase with `order.notional == 0` adds margin only. `Status::allows_open` is true for `Active` alone, and `execute_order` reads it to gate an increase that adds notional.

`Status` crosses the contract boundary as a bare `u32`. It appears as the `set_status` argument, the `get_status` return, and the `status` field of the `status_update` event. `Status::from_u32` decodes it, and any value above 4 traps `InvalidStatus` (702).

## set_status moves the status under a transition matrix

```rust
fn set_status(e: Env, status: u32);
```

Owner only (`#[only_owner]`). The owner must authorize the call, and a market with no owner traps `OwnerNotSet` (2100) before anything else runs. `status` is the target discriminant. The checks and effects run in this order.

1. `extend_instance` raises the instance time to live (TTL) to `LEDGER_BUMP_INSTANCE`, 535,680 ledgers, when fewer than `LEDGER_THRESHOLD_INSTANCE`, 518,400 ledgers, remain.
2. `Status::from_u32` decodes `status`. An unknown value traps `InvalidStatus` (702).
3. `Status::check_transition` judges the move. It reads no storage. Its inputs are the current status, the target, the stored `DelistedAt` if any, and `now`, the ledger timestamp in unix seconds. A rejected move traps `InvalidStatus` (702).
4. The side effect of the target runs, as listed below.
5. The call writes `Status` and publishes `status_update`.

`Status::check_transition` applies the rows of this table from the top, and the first match decides. `delisted_at` is the stored `DelistedAt` value.

| Row | From | To | Result |
| --- | --- | --- | --- |
| 1 | `Retired` | any | `InvalidStatus` (702) |
| 2 | any | the same status | `InvalidStatus` (702) |
| 3 | any | `Frozen`, `Delisted`, `Retired` | allowed |
| 4 | any | `Active`, `OnIce` | allowed if `DelistedAt` is absent or `now < delisted_at + DELIST_GRACE`, else `InvalidStatus` (702) |

Row 4 closes the way back to trading once the grace window ends. After that point the delist is permanent, which is the condition for a flat settlement price. Row 3 leaves retirement open, and the `retire` step of the call gates it on an empty book.

### Side effects by target

- `Delisted` writes `DelistedAt = now` when the key is absent. The first delist anchors the grace and deadline windows. A `Frozen` market that returns to `Delisted` keeps that anchor, so a freeze does not restart either window.
- `Active` and `OnIce` remove `DelistedAt` when it is present. A later delist then starts a fresh window.
- `Frozen` runs no extra step.
- `Retired` runs `retire`, described below.

`retire` sums three `MarketData` totals over both sides. They are open interest (`notional`, token-dec), base size (`tokens`, base-dec), and posted margin (`margin`, token-dec). If any sum is nonzero, the call traps `MarketNotCleared` (706). Otherwise it sweeps the credit pool surplus to the vault.

```text
surplus = credit_pool - credit_owed
```

`credit_pool` is the claimable-credit pool and `credit_owed` is the credit owed to traders, both in `MarketData` and both token-dec. The market keeps the credit it owes and sends the rest to the vault. If `surplus > 0`, the market transfers `surplus` of the settlement token to the `Vault` address, sets `credit_pool = credit_owed`, and writes `MarketData`. Two rows show the range.

| `credit_pool` | `credit_owed` | Transfer to the vault | `credit_pool` after |
| --- | --- | --- | --- |
| 12,500,000 | 10,000,000 | 2,500,000 | 10,000,000 |
| 10,000,000 | 10,000,000 | none | 10,000,000 |

If the contract token balance is below `surplus`, the transfer traps with the settlement token's own error, and the market keeps its current status. A balance that covers the surplus makes retirement reachable again.

### set_status raises three errors and writes three keys

| Error | Code | Condition |
| --- | --- | --- |
| `OwnerNotSet` | 2100 | The market has no owner. |
| `InvalidStatus` | 702 | `status` is above 4, or `Status::check_transition` rejects the move. |
| `MarketNotCleared` | 706 | The target is `Retired` and a total of `notional`, `tokens`, or `margin` is nonzero. |

The call reads `Status` and `DelistedAt`. On retirement it also reads `MarketData`, and on a positive surplus `Token` and `Vault`. It writes `Status` and `DelistedAt`, and on retirement with a surplus it writes `MarketData`. `TerminalPrice` keeps its stored value across every transition. The event is `status_update` with the data field `status`, the new discriminant.

## set_terminal_price fixes one settlement price for the wind-down

```rust
fn set_terminal_price(e: Env, price: i128);
```

Owner only (`#[only_owner]`). The owner must authorize the call, and a market with no owner traps `OwnerNotSet` (2100) before anything else runs. `price` is the flat settlement price at feed precision (18 decimals, see [Units and scales](../units.md)). The checks run in this order.

1. `extend_instance` extends the instance TTL, as in `set_status`.
2. The status is not `Delisted`. The call traps `InvalidStatus` (702).
3. `grace_expired` is false. The call traps `InvalidStatus` (702).
4. `price <= 0`. The call traps `InvalidPrice` (701).

The call writes `TerminalPrice` and publishes `terminal_price_update` with the data field `price`. It runs any number of times, and each run replaces the stored value. Once written, `TerminalPrice` stays stored for the life of the market. From the first write on, `Market::load` prices every price-bearing entry at `TerminalPrice` and does not verify the submitted report. The [Pricing page](./pricing.md) gives the mechanics.

The call reads `Status` and `DelistedAt`, and it writes `TerminalPrice`. Its errors are `OwnerNotSet` (2100), `InvalidStatus` (702), and `InvalidPrice` (701).

## Two views expose the wind-down

```rust
fn get_status(e: Env) -> u32;
fn get_retirement(e: Env) -> Option<(i128, u64)>;
```

`get_status` returns the `Status` discriminant. The constructor writes `Active`, and `set_status` is the only other writer of the key, so the stored value is always one of the five discriminants.

`get_retirement` returns `None` while `DelistedAt` is absent. That covers a market never delisted and a market whose last delist was reverted. Otherwise it returns `(terminal_price, delisted_at)`. `terminal_price` is the stored `TerminalPrice` at feed precision, or `0` while none is set. `delisted_at` is `DelistedAt` in unix seconds. Neither view raises an error. Both are read-only and leave the instance TTL as it is.

## Two timing predicates read the delist anchor

```text
grace_expired   = now >= delisted_at + DELIST_GRACE
deadline_passed = now >= delisted_at + DELIST_DEADLINE
```

`now` is the ledger timestamp and `delisted_at` is `DelistedAt`, both in unix seconds. `DELIST_GRACE` and `DELIST_DEADLINE` are durations in seconds. Both predicates are false while `DelistedAt` is absent, and each addition saturates. `grace_expired` is private, and `set_terminal_price` is its one caller. `deadline_passed` is crate-visible, and `execute_liquidation` reads it. `Status::check_transition` applies the same grace arithmetic to its own `delisted_at` and `now` arguments.

With `DELIST_GRACE` at 86,400 seconds and `DELIST_DEADLINE` at 604,800 seconds, a delist anchored at `T` gives these rows.

| `now` | `grace_expired` | `deadline_passed` | Effect |
| --- | --- | --- | --- |
| `T + 86,399` | false | false | `Active` and `OnIce` stay reachable. `set_terminal_price` traps `InvalidStatus` (702). |
| `T + 86,400` | true | false | `Active` and `OnIce` are unreachable. `set_terminal_price` runs while the status is `Delisted`. |
| `T + 604,799` | true | false | `execute_liquidation` still checks eligibility. |
| `T + 604,800` | true | true | With status `Delisted`, `execute_liquidation` waives `NotLiquidatable` (722). |

Until the deadline, traders may close voluntarily. After it, a forced close reaches every remaining position.

## Status gates by entry

The owner entries `set_config`, `upgrade`, and the ownership entries run in every status. `set_status` runs in every status except `Retired`. `set_terminal_price` runs in `Delisted` only. Every view runs in every status. `set_config` carries one status-dependent precondition, `MarketNotAccrued` (703), which `Frozen` alone waives. The [Config page](./config.md) holds the rule. The table covers the trader and keeper entries.

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
| `execute_order`, an increase that adds notional | `OnIce`, `Delisted` | traps `IncreaseHalted` (705), after the `Market::load` gate, `OrderNotFound` (730), and `UnknownKind` (734) |
| `execute_order`, an increase with `order.notional == 0` | `Active`, `OnIce`, `Delisted` | runs |
| `execute_liquidation` | `Delisted` with `deadline_passed` | waives `NotLiquidatable` (722) and closes the position whatever its settled equity. It charges `liq_fee`, capped at the equity the close frees. |

`execute_order` also traps `IncreaseHalted` (705) for an increase that adds notional when the `AdlState` flag of the order's side is set. That check applies in every status that passes `Market::load`. The margin-only increase is exempt from both halts, so a trader can add margin to a position while the market is `OnIce` or `Delisted`. The [Vault orders page](./vault-orders.md) describes the instant redeem, and the [Liquidation page](./liquidation.md) describes the waived liquidation.

:::warning Frozen status blocks refunds and claims
`Frozen` blocks cancels, credit claims, and every price-bearing action. Escrow and positions remain stored until an allowed status restores those paths.
:::

## The statuses guarantee four things across calls

- `DelistedAt` is written once per wind-down, on the first delist. Only a revert to `Active` or `OnIce` before `delisted_at + DELIST_GRACE` removes it.
- From `delisted_at + DELIST_GRACE` on, the trading statuses are unreachable, and `Frozen`, `Delisted`, and `Retired` remain.
- `Retired` is terminal. It is reachable from every other status when the book is empty and the token balance covers the surplus sweep.
- Flat pricing follows the presence of `TerminalPrice`, not the status value. Through `Delisted`, accrual and every keeper fill except an increase that adds notional keep running, priced flat once a terminal price exists.

For a reader of a `Delisted` market, `get_retirement` answers the pricing question. A nonzero `terminal_price` means every price-bearing entry settles at that value. A `terminal_price` of `0` means the entries still verify the submitted report.
