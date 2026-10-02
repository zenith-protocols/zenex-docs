---
sidebar_position: 15
title: Vault orders
---

# Vault orders

This page covers the vault order, the row it stores, the three calls that create, cancel, and read it, and the fill that `execute_vault_order` runs. A vault order moves liquidity between a user and the strategy vault through the market. The user signs the create call, and the market escrows the principal. A keeper fills the order later with a verified price report. A deposit fill mints vault shares, and a redeem fill burns them and pays assets. Both fills price shares against the pending profit and loss (PnL) of the book. The gates on the vault size, the utilization, and the pending PnL run at the fill. The [constructor and dependencies](./dependencies.md) page gives the vault interface that each fill calls.

## Two kinds select the fill path

`VaultOrderKind` is a `u32` enum. It crosses the contract boundary as `VaultOrder.kind`, and `VaultOrderKind::from_u32` traps with `UnknownKind` (734) on any other value.

| Discriminant | Kind | What the fill does |
|---|---|---|
| 0 | `Deposit` | Sends the escrowed assets, net of the vault fee, to the vault and mints shares to the user. |
| 1 | `Redeem` | Burns the escrowed shares and pays the user assets. |

## The vault order row is fixed while it rests

`VaultOrder` is a `#[contracttype]` in persistent user-tier storage under `DataKey::VaultOrder(user, id)`. It is the `order` field of the `CreateVaultOrder` event and the return of `get_vault_order`. A write or an on-chain read of the key extends its time-to-live (TTL) to `LEDGER_BUMP_USER` (120 days) when the remaining TTL is below `LEDGER_THRESHOLD_USER` (100 days). The [storage](./storage.md) page gives both constants.

token-dec is the settlement token's decimals. share-dec is those decimals plus the vault's decimals offset, which `Vault::get_decimals_offset` holds. The [units and scales](../units.md) page defines both.

| Field | Type | Unit | Meaning |
|---|---|---|---|
| `kind` | `u32` | | The `VaultOrderKind` discriminant. |
| `amount` | `i128` | token-dec (deposit) or share-dec (redeem) | The escrowed principal. |
| `min_out` | `i128` | share-dec (deposit) or token-dec (redeem) | The minimum received at the fill, net of the vault fee. `0` is unset. |
| `exec_fee` | `i128` | token-dec | The keeper fee, copied from `Config.exec_fee` at creation. |
| `created_at` | `u64` | seconds | The ledger timestamp at creation. The price gate and the ledger gate of the fill (steps 4 and 5) and the `redeem_lock` deadline measure from it. |

`min_out` bounds the shares that a deposit mints and the assets that a redeem pays. A fill whose quote falls under it rejects the order and returns the principal, as [Rejection](#rejection) describes.

## `create_vault_order`

```rust
fn create_vault_order(e: Env, user: Address, kind: u32, amount: i128, min_out: i128) -> u32
```

`user` must sign the call and the escrow transfers that the call makes from `user`. The return is the id of the new row. `create_vault_order` copies `Config.exec_fee` into `exec_fee` and the ledger timestamp into `created_at`. A redeem on a `Retired` market stores no row and returns `0`. The checks run in this order, and the first failure traps.

| Step | Condition | Error |
|---|---|---|
| 1 | `kind > 1` | `UnknownKind` (734) |
| 2 | `amount < 0` or `min_out < 0` | `NegativeValueNotAllowed` (710) |
| 3 | Status is `Frozen` | `MarketFrozen` (704) |
| 4 | Deposit kind and status is `Retired` | `InvalidStatus` (702) |
| 5 | `amount == 0` | `InvalidOrder` (732) |
| 6 | Deposit kind and `amount < min_deposit` | `InvalidOrder` (732) |
| 7 | Deposit kind and `amount + exec_fee` overflows `i128` | `InvalidOrder` (732) |

Step 1 is `VaultOrderKind::from_u32`. Steps 2 to 7 are `VaultOrder::check_valid`. `VaultOrder::require_valid` runs both. Steps 4, 6, and 7 apply to a deposit only, so a redeem needs a positive `amount` and nothing else. The market accepts a deposit on `Active`, `OnIce`, and `Delisted`. It accepts a redeem on every status except `Frozen`. The [market status](./status.md) page gives the statuses.

The checks run before the status split, so a redeem on a `Retired` market meets them as well. A zero `amount` on a `Retired` market traps `InvalidOrder` (732) at step 5. If a redeem passes the checks on a `Retired` market, the call runs `instant_redeem` and does not call `VaultOrder::escrow`. Every other order goes to `VaultOrder::escrow`, which moves the principal to the market. A deposit moves `amount + exec_fee` in one settlement token transfer from `user` to the market. A redeem moves `amount` vault shares through the share token's `transfer`, then moves `exec_fee` in the settlement token when `exec_fee` is above `0`.

`store_new_order` takes the id from `next_order_id` and writes `VaultOrder(user, id)`. It publishes `CreateVaultOrder { user, id, order }` with `user` and `id` as topics, and returns the id. `OrderCounter(user)` is the counter that trade [orders](./orders.md) share. It allocates from `1`, so `0` is free to mark the `instant_redeem` return.

### A redeem on a retired market pays at once {#instant-redeem}

`instant_redeem` runs inside the create call. It never calls `Market::load`, so it reads no price and accrues no index. It applies no `redeem_lock`, escrows no `exec_fee`, and charges no `redeem_fee`. It writes no row and ignores `min_out` after the sign check at step 2. The vault pays the redeemed assets to `user` in full.

The path transfers `amount` shares from `user` to the market. It then calls `strategy_redeem` for those shares, with `user` as the receiver, the market as the owner, and a `net_pnl` of `0`. Retirement needs a cleared book, which `set_status` enforces with `MarketNotCleared` (706). A `net_pnl` of `0` is therefore the exact mark. An error from the vault or the token contract propagates.

The path publishes `RedeemFill` with `shares` as `amount` and `assets` as the assets the vault paid. The `id` is `0`, `keeper` is `user`, and `fee` and `net_pnl` are `0`. The call returns `0`.

## `cancel_vault_order`

```rust
fn cancel_vault_order(e: Env, user: Address, id: u32) -> i128
```

`user` must sign. If the status is `Frozen`, the call traps with `MarketFrozen` (704). Every other status allows a cancel, `Retired` included. If `VaultOrder(user, id)` is absent, the call traps with `VaultOrderNotFound` (750). A cancel reads no price and applies no `redeem_lock`.

`VaultOrder::refund` mirrors the escrow from the market back to `user`, principal and `exec_fee` together. The call removes the row, publishes `CancelVaultOrder { user, id }` with `user` and `id` as topics, and returns `order.amount`. The return is the principal alone, in token-dec for a deposit and in share-dec for a redeem.

## `get_vault_order`

```rust
fn get_vault_order(e: Env, user: Address, id: u32) -> VaultOrder
```

The view needs no signature. It returns the stored row or traps with `VaultOrderNotFound` (750).

## `execute_vault_order`

```rust
fn execute_vault_order(e: Env, keeper: Address, user: Address, id: u32, price: Bytes) -> i128
```

The call takes no authorization, and any account may call it. `keeper` is the reward recipient. The caller names it, and the contract never authenticates it. `price` is the serialized oracle report. The return is the keeper payout (token-dec). The whole order fills at once, and the fill removes the row.

The call loads the working set with `Market::load`, at `newest_price = true` and `protective = false`. Under `newest_price = true`, a cached report prices the fill when the cache is strictly newer than the submitted report. `protective = false` selects the oracle's trade staleness window. Both accrual indices advance to the ledger timestamp before the fill. The [pricing](./pricing.md) page defines the load.

The gates run in this order, and the first failure traps.

| Step | Condition | Error |
|---|---|---|
| 1 | Status is `Frozen` or `Retired` | `MarketFrozen` (704) |
| 2 | The [oracle](../oracle/overview.md) rejects the report | Oracle error. Skipped under a stored `TerminalPrice`. |
| 3 | `VaultOrder(user, id)` is absent | `VaultOrderNotFound` (750) |
| 4 | The effective price's `publish_time` is below `created_at` | `StalePrice` (740) |
| 5 | The ledger timestamp is at or below `created_at` | `StalePrice` (740) |

The fill therefore runs on `Active`, `OnIce`, and `Delisted`. Step 4 keeps a price that predates the create call out of the fill. A `publish_time` equal to `created_at` passes, because a price published at the close of the creation ledger was not knowable when the user created the order. The gate judges the effective price, so a substituted cache mark counts. A submitted report older than `created_at` passes when the cached mark's own `publish_time` is at or above `created_at`.

Step 5 reads the ledger timestamp and ignores what the payload claims. The fill must land at a ledger timestamp above `created_at`. Every transaction in a ledger reads the same timestamp, so no transaction in the creation ledger can fill the order. A stored `TerminalPrice` sets `publish_time` to the ledger timestamp, so it passes step 4 and meets step 5.

After step 5 the call decodes `order.kind`. Creation validated that field, so `UnknownKind` (734) cannot fire on a stored row. The kind selects the deposit fill or the redeem fill. Both return to the entry, which persists the working set with `Market::store`.

### The deposit fill marks against the depositor {#deposit-fill}

`fill_deposit` runs these steps in order.

1. `apply_factor_floor` takes `vault_fee` (token-dec) from `order.amount` (token-dec) at the `deposit_fee` rate. `deposit_assets = order.amount - vault_fee`, in token-dec.
2. `Market::capped_net_pnl` at `maximize = false` gives `net_pnl` (token-dec, signed). The minimized mark reads each side's pending profit as low as the price allows. The vault's effective backing is its total assets less `net_pnl`, so a lower `net_pnl` raises the backing and the deposit mints fewer shares. The difference stays in the vault for the other shareholders.
3. If `min_out > 0`, `preview_deposit` on the vault quotes the shares (share-dec) that `deposit_assets` mints at that `net_pnl`. If the quote is below `min_out`, the path rejects the order under [Rejection](#rejection) and returns. Nothing has moved. If `min_out` is `0`, the step is skipped.
4. `Settlement::compute_vault_order` splits `vault_fee` with a trader leg of `0`, because shares pay the depositor.
5. The vault pulls the assets inside its own call frame, which the market's own authorization does not cover. The market therefore authorizes exactly one sub-invocation as itself, a `transfer` on the settlement token from the market to the vault for `deposit_assets`. It then calls `strategy_deposit` with `deposit_assets`, `user` as the receiver, the market as `from`, and that `net_pnl`. The vault mints `shares` (share-dec) to `user`. When `min_out > 0`, `shares` equals the quote at step 3. The tracked vault balance rises by `deposit_assets`.
6. The path removes the row and publishes `DepositFill { user, id, keeper, assets, shares, fee, net_pnl }`, with `user` and `id` as topics. `assets` is the gross `order.amount` and `fee` is `vault_fee`.
7. The fee legs settle after the mint, so the vault's cut of the fee prices against the balance from before the fee. The settlement raises the tracked balance by that cut.
8. If the tracked vault balance is above `max_vault_balance`, the fill traps with `VaultBalanceExceeded` (753).

The size cap at step 8 reads the settled balance, so the vault's cut of the fee counts toward it. The [PnL and the profit cap](./pnl-calculation.md) page defines `capped_net_pnl` and the mark it carries to the vault.

### The redeem fill marks against the redeemer {#redeem-fill}

`fill_redeem` runs these steps in order.

1. If the ledger timestamp is below `created_at + redeem_lock`, the fill traps with `VaultOrderLocked` (751). The sum saturates. A `redeem_lock` of `0` leaves the fill open as soon as a later ledger exists.
2. `Market::capped_net_pnl` at `maximize = true` gives `net_pnl` (token-dec, signed). The maximized mark reads each side's pending profit as high as the price allows. A higher `net_pnl` lowers the vault's effective backing, so the redeem pays fewer assets. The difference stays in the vault for the other shareholders.
3. If `min_out > 0`, `preview_redeem` on the vault quotes the assets (token-dec) that `order.amount` shares redeem at that `net_pnl`. `apply_factor_floor` takes the `redeem_fee` cut from the quote. If the net quote is below `min_out`, the path rejects the order under [Rejection](#rejection) and returns. Nothing has moved. If `min_out` is `0`, the step is skipped.
4. `strategy_redeem` burns `order.amount` shares with the market as both receiver and owner, at that `net_pnl`. It returns `redeemed` (token-dec). When `min_out > 0`, `redeemed` equals the gross quote at step 3. The tracked vault balance falls by `redeemed`.
5. `apply_factor_floor` takes `vault_fee` (token-dec) from `redeemed` at the `redeem_fee` rate. `to_user = redeemed - vault_fee`, in token-dec.
6. `Settlement::compute_vault_order` splits `vault_fee` and carries `to_user` on the trader leg.
7. The path removes the row and publishes `RedeemFill { user, id, keeper, shares, assets, fee, net_pnl }`, with `user` and `id` as topics. `shares` is `order.amount`, `assets` is the gross `redeemed`, and `fee` is `vault_fee`.
8. The legs settle. A failed transfer of `to_user` parks the amount as a claimable credit, under the rule on the [fees and settlement](./fee-system.md) page.
9. `Market::require_utilization` runs twice at `max_util_withdraw`, once with `is_long = true` and once with `is_long = false`. Either side above the cap traps with `UtilizationExceeded` (714).
10. If either side's maximized pending PnL is above the withdraw allowance, the fill traps with `PendingPnlExceeded` (754).

`fill_redeem` reads `redeem_lock` from `Config` at the fill, and the row does not store it. A config change therefore moves the deadline of every queued redeem. Steps 9 and 10 both measure the settled balance, which is the balance that remains after the payout. At step 9, the cap on a side is `half_factor(vault_balance, max_util_withdraw)`. The long reserve is `MarketData::side_reserved` at `price.ask`, rounded up, and the short reserve is `notional.short`. The cap rounds down and the long reserve rounds up, so both round toward rejection. The [margin and leverage](./margin-and-leverage.md#utilization) page defines `require_utilization`.

Step 10 uses `max_pnl_withdraw`, and the allowance is:

```
withdraw_allowance = half_factor(vault_balance, max_pnl_withdraw)
                   = floor((vault_balance / 2) * max_pnl_withdraw / SCALAR_18)
```

Where:

- `vault_balance` is the tracked vault balance after the settlement (token-dec).
- `max_pnl_withdraw` is a `Config` factor (`SCALAR_18`).
- `SCALAR_18` is `1_000_000_000_000_000_000`, which stands for 100%.
- `/ 2` is integer division, so an odd balance loses one unit before the factor applies.
- `withdraw_allowance` is token-dec.

In words, a redeem may leave each side's pending profit at no more than the `max_pnl_withdraw` share of half the remaining vault. The rows below use a token with 7 decimals and are illustrations, not live parameters.

| `vault_balance` | `max_pnl_withdraw` | `withdraw_allowance` |
|---|---|---|
| 10,000,000,000,000 (1,000,000 tokens) | 40% | 2,000,000,000,000 (200,000 tokens) |
| 10,000,000,000,001 | 40% | 2,000,000,000,000 |
| 10,000,000,000,000 | 45% | 2,250,000,000,000 |
| 1 | 40% | 0 |

Step 10 compares the allowance with `MarketData::side_pnl` on each side, at `maximize = true`. The [PnL and the profit cap](./pnl-calculation.md) page defines `side_pnl`, and the [Units and scales](../units.md#truncating-halves) page defines `half_factor`. `Config::check_valid` rejects a `Config` with `InvalidConfig` (700) unless `0 < max_pnl_withdraw <= adl_clear_target`, and with `NegativeValueNotAllowed` (710) first when `max_pnl_withdraw` is negative. A permitted redeem therefore leaves both sides at or below the auto-deleveraging (ADL) clear target. It cannot arm ADL, and it cannot leave an armed flag above the clear target. The [Config](./config.md) page numbers the rule, and the [auto-deleveraging](./auto-deleveraging.md) page defines the clear target.

### A quote below `min_out` rejects the order {#rejection}

`reject` runs when step 3 of either fill finds the quote under `min_out`. It runs before any asset moves, so the escrow is intact. A redeem reaches it after the `redeem_lock` check, so only a mature redeem rejects.

1. A deposit refunds `order.amount` (token-dec) to `user` through `pay_trader`. A refund that the token contract rejects parks as a claimable credit, under the rule on the [fees and settlement](./fee-system.md) page. A redeem transfers `order.amount` shares from the market to `user` on the share token, and that transfer needs no trustline.
2. The path removes the row.
3. It publishes `RejectVaultOrder { user, id, keeper, quoted, net_pnl }`, with `user` and `id` as topics. `quoted` is the shares that the deposit would mint (share-dec) or the net assets that the redeem would pay (token-dec). `net_pnl` is the mark the quote priced against.
4. `Settlement::compute_vault_order` runs with a vault fee of `0` and a trader leg of `0`, so only the keeper leg, `order.exec_fee`, settles. The call returns that amount as the keeper payout.

A rejection charges no vault fee, and the user keeps the whole principal. The `exec_fee` is the cost of the rejected attempt. It pays the keeper, so a rejection never costs the keeper. The first fill attempt after maturity settles the order either way. `min_out` therefore bounds slippage and cannot hold an order for a better price.

The capacity gates trap instead. These are the size cap of a deposit and the two exit gates of a redeem. A trap reverts the whole call, so the order stays in place and fills later.

## One vault fee rounds down and splits three ways

Both fills charge one vault fee on the assets they move. `apply_factor_floor` computes it.

```
vault_fee = floor(moved * fee_rate / SCALAR_18)
```

Where:

- `moved` is `order.amount` on a deposit and `redeemed` on a redeem, both token-dec.
- `fee_rate` is `Config.deposit_fee` or `Config.redeem_fee` (`SCALAR_18`).
- `vault_fee` carries the unit of `moved`, which is token-dec.

The floor rounds in the user's favor. The rows below use a token with 7 decimals and a `fee_rate` of 0.3%.

| `moved` | `vault_fee` |
|---|---|
| 10,000,000,000 (1,000 tokens) | 30,000,000 (3 tokens) |
| 3,333 | 9, the floor of 9.999 |

`Settlement::compute_vault_order` splits that fee into keeper, treasury, and vault legs and adds the escrowed `exec_fee` to the keeper leg. `execute_vault_order` returns the keeper leg.

```
payout = floor(vault_fee * keeper_rate / SCALAR_18) + exec_fee
```

Where:

- `keeper_rate` is `Config.keeper_rate` (`SCALAR_18`).
- `vault_fee` is the fee above (token-dec).
- `exec_fee` is the `exec_fee` stored on the order (token-dec).
- `payout` is token-dec.

In words, the keeper takes its share of the vault fee and the whole escrowed execution fee. The rows below use a `keeper_rate` of 10% and an `exec_fee` of 100,000.

| `vault_fee` | `payout` |
|---|---|
| 30,000,000 | 3,100,000 |
| 9 | 100,000 |
| 0 (a rejection) | 100,000 |

The treasury takes its own cut at the rate that its contract reports through `get_rate`, and the vault keeps the rest. The [fees and settlement](./fee-system.md) page gives the legs and the treasury rate.

## Ten Config fields govern vault orders

The [Config](./config.md) page gives the validation rules for each field.

| Field | Unit | Where it is read |
|---|---|---|
| `min_deposit` | token-dec | Step 6 of `create_vault_order`. |
| `exec_fee` | token-dec | Step 7 of `create_vault_order`, and the copy that the row stores at creation. The row's own copy governs the fill. |
| `deposit_fee` | `SCALAR_18` | The vault fee rate on the gross `order.amount` of a deposit. |
| `redeem_fee` | `SCALAR_18` | The vault fee rate on the redeemed assets. |
| `redeem_lock` | seconds | The seconds after `created_at` before a redeem can fill, read at the fill. |
| `max_vault_balance` | token-dec | The ceiling on the settled balance after a deposit fill. |
| `max_util_withdraw` | `SCALAR_18` | The utilization cap after a redeem fill. |
| `max_pnl_withdraw` | `SCALAR_18` | The factor in the withdraw allowance after a redeem fill. |
| `max_pnl_trader` | `SCALAR_18` | The per-side profit cap in `capped_net_pnl`, on both fills. |
| `keeper_rate` | `SCALAR_18` | The keeper's share of the vault fee, on both fills. |

## Escrow leaves the market by three routes

The market holds the principal and the `exec_fee` of every stored vault order. A deposit escrow is `amount + exec_fee` in the settlement token. A redeem escrow is `amount` in vault shares plus `exec_fee` in the settlement token. A call of `execute_vault_order` resolves the order by a fill or by a rejection, and `cancel_vault_order` resolves it by a cancel.

| Route | Principal | `exec_fee` |
|---|---|---|
| Fill | A deposit sends `amount` less `vault_fee` to the vault. A redeem burns the shares and pays `user` the redeemed assets less `vault_fee`. | Paid to `keeper`, with the keeper cut of `vault_fee`. The treasury takes its own cut of `vault_fee`. |
| Rejection | Returned to `user`. | Paid to `keeper`. |
| Cancel | Returned to `user`. | Returned to `user`. |

A `Frozen` status blocks all three routes, and the escrow stays with the market until the freeze lifts. A `Retired` status blocks the fill and the rejection, so the cancel is the only exit.
