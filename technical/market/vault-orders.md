---
sidebar_position: 15
title: Vault orders
---

# Vault orders

A vault order moves liquidity between a user and the strategy vault through the market. The user signs the create call, and the market escrows the principal. A keeper fills the order later with a verified price report. A deposit fill mints vault shares, and a redeem fill burns them and pays assets. Every fill prices shares against the book's pending trader profit and loss (PnL). The gates on the vault size, on the utilization, and on the pending PnL run at the fill. The [constructor and dependencies](./dependencies.md) page gives the vault interface each fill calls.

## Vault order kinds

`VaultOrderKind` is a `u32` enum. It crosses the contract boundary as `VaultOrder.kind`, and `VaultOrderKind::from_u32` traps with `UnknownKind` (734) on any other value.

| Discriminant | Kind | What the fill does |
|---|---|---|
| 0 | `Deposit` | Sends the escrowed assets, net of the vault fee, to the vault and mints shares to the user. |
| 1 | `Redeem` | Burns the escrowed shares and pays the user assets. |

## The vault order row

`VaultOrder` is a `#[contracttype]` in persistent user-tier storage under `DataKey::VaultOrder(user, id)`. The row stays fixed while it rests. It is the `order` field of the `CreateVaultOrder` event and the return of `get_vault_order`.

| Field | Type | Unit | Meaning |
|---|---|---|---|
| `kind` | `u32` | | The `VaultOrderKind` discriminant. |
| `amount` | `i128` | token-dec (deposit) or share-dec (redeem) | The escrowed principal. |
| `min_out` | `i128` | share-dec (deposit) or token-dec (redeem) | The minimum received at the fill, net of the vault fee. `0` is unset. |
| `exec_fee` | `i128` | token-dec | The keeper fee, copied from `Config.exec_fee` at creation. |
| `created_at` | `u64` | seconds | The ledger timestamp at creation. The anti-replay and cooldown anchor. |

token-dec is the settlement token's decimals. share-dec is that token's decimals plus the vault's decimals offset, which `Vault::get_decimals_offset` holds. The [units and scales](../units.md) page gives both. `min_out` bounds the minted shares on a deposit and the paid assets on a redeem. The [storage](./storage.md) page gives the key and its TTL tier.

## `create_vault_order`

```rust
fn create_vault_order(e: Env, user: Address, kind: u32, amount: i128, min_out: i128) -> u32
```

`user` must sign. The return is the new order id of the stored row. A redeem on a `Retired` market stores no row and returns `0`. `create_vault_order` sets `exec_fee` from `Config.exec_fee` and `created_at` to the ledger timestamp. The checks run in this order, and the first failure traps.

| Step | Condition | Error |
|---|---|---|
| 1 | `kind > 1` | `UnknownKind` (734) |
| 2 | `amount < 0` or `min_out < 0` | `NegativeValueNotAllowed` (710) |
| 3 | Status is `Frozen` | `MarketFrozen` (704) |
| 4 | Deposit kind and status is `Retired` | `InvalidStatus` (702) |
| 5 | `amount == 0` | `InvalidOrder` (732) |
| 6 | Deposit kind and `amount < min_deposit` | `InvalidOrder` (732) |
| 7 | Deposit kind and `amount + exec_fee` overflows `i128` | `InvalidOrder` (732) |

Step 1 is `VaultOrderKind::from_u32` and steps 2 to 7 are `VaultOrder::check_valid`. Both run inside `VaultOrder::require_valid`. A redeem passes step 6 at any positive share amount. The market accepts a deposit on `Active`, on `OnIce`, and on `Delisted`. It accepts a redeem on every status except `Frozen`. The [market status](./status.md) page gives the statuses.

All seven checks run on every path, a redeem on a `Retired` market included. A zero `amount` on a `Retired` market still traps `InvalidOrder` (732) at step 5. A redeem that passes the checks on a `Retired` market leaves for `instant_redeem` at that point. Every other order goes on to `VaultOrder::escrow`, which moves the principal to the market. A deposit sends `amount + exec_fee` in one settlement token transfer from `user` to the market. A redeem sends `amount` vault shares through the vault token's `transfer`, then sends `exec_fee` in the settlement token when it is greater than `0`.

`store_new_order` takes the id from `next_order_id` and writes `VaultOrder(user, id)`. It publishes `CreateVaultOrder { user, id, order }` with `user` and `id` as topics, and returns the id. `OrderCounter(user)` is the counter that trade [orders](./orders.md) share, and it allocates from `1`.

### Instant redeem on a retired market

A redeem created on a `Retired` market runs `instant_redeem` and pays out inside the create call. The path transfers `amount` shares from `user` to the market. It then calls `strategy_redeem` for those shares, with `user` as the receiver, the market as the owner, and a `net_pnl` of `0`. Retirement requires a cleared book, so a `net_pnl` of `0` is the exact mark. The vault pays the full redeemed assets to `user`. The stored row, the escrowed `exec_fee`, the vault fee, and the `min_out` bound belong to the queued path alone. The path publishes `RedeemFill` with `shares` as the burned `amount` and `assets` as the assets the vault paid. The `id` is `0`, `keeper` is `user`, `fee` is `0`, and `net_pnl` is `0`. It returns `0`.

## `cancel_vault_order`

```rust
fn cancel_vault_order(e: Env, user: Address, id: u32) -> i128
```

`user` must sign. If the status is `Frozen`, the call traps with `MarketFrozen` (704). Every other status allows a cancel, `Retired` included. If `VaultOrder(user, id)` is absent, the call traps with `VaultOrderNotFound` (750). `VaultOrder::refund` mirrors the escrow from the market back to `user`, principal and `exec_fee` together. The entry removes the row, publishes `CancelVaultOrder { user, id }` with `user` and `id` as topics, and returns `order.amount`. The return is the principal alone, in token-dec for a deposit and in share-dec for a redeem.

## `get_vault_order`

```rust
fn get_vault_order(e: Env, user: Address, id: u32) -> VaultOrder
```

The view returns the stored row or traps with `VaultOrderNotFound` (750). An on-chain read extends the row's TTL.

## `execute_vault_order`

```rust
fn execute_vault_order(e: Env, keeper: Address, user: Address, id: u32, price: Bytes) -> i128
```

The entry takes no authorization, and any account may call it. `keeper` is the address that receives the keeper payout. The caller names it, and the contract never authenticates it. `price` is the serialized oracle report. The return is the keeper payout (token-dec). The whole order fills at once.

The entry loads the working set with `Market::load`, at `newest_price = true` and `protective = false`. `newest_price = true` lets a cached report price the fill when the cache is newer than the submitted report. `protective = false` selects the oracle's trade staleness window. Both accrual indices advance to now before the fill. The [pricing](./pricing.md) page defines the load.

The gates run in this order, and the first failure traps.

| Step | Condition | Error |
|---|---|---|
| 1 | Status is `Frozen` or `Retired` | `MarketFrozen` (704) |
| 2 | The [oracle](../oracle/overview.md) rejects the report | Oracle error. Skipped under a stored `TerminalPrice`. |
| 3 | `VaultOrder(user, id)` is absent | `VaultOrderNotFound` (750) |
| 4 | The effective price's `publish_time` is below `created_at` | `StalePrice` (740) |
| 5 | The ledger timestamp is at or below `created_at` | `StalePrice` (740) |

Step 4 keeps a price that predates the create call out of the fill, and an equal `publish_time` passes. A price published at the close of the creation ledger was not knowable to the user, so the equal timestamp still passes. The gate judges the effective price, so a substituted cache mark counts. A submitted report older than `created_at` passes when the cached mark's own `publish_time` is at or above `created_at`. Step 5 reads the ledger timestamp and ignores what the payload claims. The fill must land at a ledger timestamp above `created_at`. No transaction in the creation ledger can fill the order, because every transaction in a ledger reads the same timestamp. After step 5 the entry decodes `order.kind`. Creation already validated that field. `UnknownKind` (734) therefore does not fire on a stored row. The kind selects the deposit path or the redeem path, and the entry stores the market data last.

### Deposit fill

`fill_deposit` runs these steps in order.

1. `apply_factor_floor` takes `vault_fee` (token-dec) from `order.amount` (token-dec) at the `deposit_fee` rate. `deposit_assets = order.amount - vault_fee`, in token-dec.
2. `Settlement::compute_vault_order` splits `vault_fee` with a trader leg of `0`, because shares pay the depositor.
3. `Market::capped_net_pnl` at `maximize = false` gives `net_pnl` (token-dec, signed). The minimized mark is adverse to the depositor, so the spread accrues to the standing shareholders.
4. The market authorizes exactly one sub-invocation as itself: `transfer` on the settlement token, from the market to the vault, for `deposit_assets`.
5. `strategy_deposit` sends `deposit_assets` with `user` as the receiver, the market as the source, and that `net_pnl`. It returns `shares` (share-dec), and the tracked vault balance rises by `deposit_assets`.
6. If `min_out > 0` and `shares < min_out`, the fill traps with `MinOutNotMet` (752).
7. The path removes the row and publishes `DepositFill { user, id, keeper, assets, shares, fee, net_pnl }`, with `user` and `id` as topics. `assets` is the gross `order.amount` and `fee` is `vault_fee`.
8. The fee legs settle, which raises the tracked balance by the vault's cut.
9. If the tracked vault balance is above `max_vault_balance`, the fill traps with `VaultBalanceExceeded` (753).

The size cap at step 9 reads the settled balance, so the vault's cut of the fee counts toward it. The [PnL and the profit cap](./pnl-calculation.md) page defines `capped_net_pnl` and the mark it carries to the vault.

### Redeem fill

`fill_redeem` runs these steps in order.

1. If the ledger timestamp is below `created_at + redeem_lock`, the fill traps with `VaultOrderLocked` (751). The sum saturates.
2. `Market::capped_net_pnl` at `maximize = true` gives `net_pnl` (token-dec, signed). The maximized mark is adverse to the redeemer.
3. `strategy_redeem` burns `order.amount` shares with the market as both receiver and owner, at that `net_pnl`. It returns `redeemed` (token-dec), and the tracked vault balance falls by `redeemed`.
4. `apply_factor_floor` takes `vault_fee` (token-dec) from `redeemed` at the `redeem_fee` rate. `to_user = redeemed - vault_fee`, in token-dec.
5. `Settlement::compute_vault_order` splits `vault_fee` and carries `to_user` on the trader leg.
6. If `min_out > 0` and `to_user < min_out`, the fill traps with `MinOutNotMet` (752).
7. The path removes the row and publishes `RedeemFill { user, id, keeper, shares, assets, fee, net_pnl }`, with `user` and `id` as topics. `shares` is `order.amount`, `assets` is the gross `redeemed`, and `fee` is `vault_fee`.
8. The legs settle. A failed transfer of `to_user` parks the amount as a claimable credit under the rule on the [fees and settlement](./fee-system.md) page.
9. `Market::require_utilization` runs against `max_util_withdraw` and traps with `UtilizationExceeded` (714).
10. If either side's maximized pending PnL is above the withdraw allowance, the fill traps with `PendingPnlExceeded` (754).

`fill_redeem` reads `redeem_lock` from `Config` at the fill. The row does not store it. A config change moves the deadline of every queued redeem. Steps 9 and 10 both measure the settled balance, which is the balance that remains after the payout. The withdraw allowance is:

```
withdraw_allowance = half_factor(vault_balance, max_pnl_withdraw)
                   = floor((vault_balance / 2) * max_pnl_withdraw / SCALAR_18)
```

`vault_balance` is the tracked vault balance after the settlement (token-dec). `max_pnl_withdraw` is a `Config` factor in `SCALAR_18`, which is `1_000_000_000_000_000_000`. The `/ 2` is integer division. `withdraw_allowance` is token-dec. Step 10 compares the allowance against `MarketData::side_pnl` on each side, at `maximize = true`. The [margin and leverage](./margin-and-leverage.md) page defines `require_utilization`, and the [PnL and the profit cap](./pnl-calculation.md) page defines `side_pnl` and `half_factor`.

## Fee and keeper payout

Both fills charge one vault fee on the assets they move. `apply_factor_floor` computes it, and the floor rounds in the user's favor:

```
vault_fee = floor(moved * fee_rate / SCALAR_18)
```

`moved` is `order.amount` on a deposit and `redeemed` on a redeem, both token-dec. `fee_rate` is `Config.deposit_fee` or `Config.redeem_fee`, a rate in `SCALAR_18`. `vault_fee` carries the unit of `moved`, which is token-dec.

`Settlement::compute_vault_order` splits that fee three ways and adds the escrowed `exec_fee` to the keeper leg. The return of `execute_vault_order` is that leg:

```
payout = floor(vault_fee * keeper_rate / SCALAR_18) + exec_fee
```

`keeper_rate` is `Config.keeper_rate`, a ratio in `SCALAR_18`. `vault_fee` is the fee above and `exec_fee` is the order's escrowed `exec_fee`, both token-dec. `payout` is token-dec. `treasury_rate` is the rate the treasury contract reports through `get_rate`, in `SCALAR_18`. The treasury takes `floor(vault_fee * treasury_rate / SCALAR_18)`, in token-dec. The settlement pays the rest of the fee to the vault. The [fees and settlement](./fee-system.md) page gives the legs and the treasury rate.

## Config fields the paths read

These `Config` fields govern vault orders. The [Config](./config.md) page gives their validation rules.

| Field | Unit | Where it is read |
|---|---|---|
| `min_deposit` | token-dec | Step 6 of `create_vault_order`. |
| `deposit_fee` | `SCALAR_18` | The vault fee rate on the gross `order.amount` of a deposit. |
| `redeem_fee` | `SCALAR_18` | The vault fee rate on the redeemed assets. |
| `redeem_lock` | seconds | The redeem cooldown from `created_at`, read at the fill. |
| `max_vault_balance` | token-dec | The ceiling on the settled balance after a deposit fill. |
| `max_util_withdraw` | `SCALAR_18` | The utilization cap after a redeem fill. |
| `max_pnl_withdraw` | `SCALAR_18` | The factor in the withdraw allowance after a redeem fill. |
| `max_pnl_trader` | `SCALAR_18` | The per-side profit cap in `capped_net_pnl`, on both fill paths. |
| `keeper_rate` | `SCALAR_18` | The keeper's share of the vault fee on both fill paths. |

`create_vault_order` copies `Config.exec_fee` (token-dec) onto the row at creation, and the row's own copy governs the fill.

## Escrow invariant

The market holds the principal and the `exec_fee` of every stored vault order. A deposit escrow is `amount + exec_fee` in the settlement token. A redeem escrow is `amount` in vault shares plus `exec_fee` in the settlement token. The escrow leaves the market by exactly two routes. A fill moves the principal to or from the vault. It pays `keeper` the `exec_fee` and the keeper cut of the vault fee, and the treasury its own cut. A cancel returns both to `user`. A `Frozen` status blocks both routes, and the escrow stays with the market until the freeze lifts. A `Retired` status blocks the fill route, so the cancel is the only exit.
