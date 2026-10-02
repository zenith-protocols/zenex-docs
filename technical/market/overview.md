---
sidebar_position: 1
title: Market contract
---

# Market contract

This page covers what the `market` contract holds, how an order becomes a fill, and its public entries grouped by caller. It then states the conventions that every page under it assumes: netted positions, operational status, and units.

`MarketContract` holds one netted position for each account and side of one perpetual futures market. It settles profit and loss, charges the trade, impact, borrowing, and liquidation fees, accrues funding between the two sides, and runs liquidation and auto-deleveraging (ADL). It is also the entry point for its strategy vault. A liquidity provider deposits and redeems through vault orders on the market, and only the market calls the vault's strategy entries.

## One contract serves one market

The immutable `feed_id`, set in `__constructor`, names the price stream of the market. The constructor also stores the settlement token and the addresses of the strategy vault, the oracle, and the treasury. The [Constructor and dependencies](./dependencies.md) page gives its signature and checks.

The factory deploys one market and vault pair for each market. Each pair holds its own risk, storage, and configuration.

The owner can replace the market's code in place with `upgrade`. The [Ownership and upgrade](./dependencies.md#ownership-and-upgrade) section gives its checks and errors. The replaced code keeps the market's address, so it keeps the market's authority over the vault. The vault's own code is fixed at deploy.

## A trader creates an order and a keeper fills it

Every fill runs through a permissionless keeper entry with a signed Chainlink Data Streams report. The flow has two steps.

1. A trader calls `create_order`, or a liquidity provider calls `create_vault_order`. The call carries an intent with no price and needs the caller's own signature. The market escrows the funds at creation.
2. A keeper calls `execute_order` or `execute_vault_order` with a signed report. The market checks the report through the oracle against its `feed_id`. For a trade order it then checks expiry, trigger, and price bound against the price, and settles the fill.

`execute_order` prices at the price in the submitted report. That price must not predate the order, unless the fill runs in the ledger that created a market order. The other priced entries price at the newer of the submitted report and the market's cached price. Once the owner stores a terminal price, every entry prices at it and reads no report. The [Pricing](./pricing.md) page gives the cache rules and the staleness windows.

The keeper is the reward recipient that the caller names, and the market does not authenticate it. The trader's consent is the escrow funded at creation, together with the trigger and price bound signed into the order. A keeper therefore chooses only which report to submit and when. A limit or stop order carries a `trigger_price` and fills once the execution-side price crosses it. The execution side is the entry price for an increase and the exit price for a decrease. The [Orders](./orders.md) page has the six kinds and every fill rule. The stateless router can create and fill a market order in one transaction, and the [Market router](../router/overview.md) page has its flows.

## Public interface

The tables group the entries by caller. The last column names the page that owns each entry's signature, gate order, storage, and errors.

### Owner entries

Each owner entry carries `#[only_owner]` and needs the contract owner's signature.

| Entry | Effect | Page |
|---|---|---|
| `set_config` | Replaces the whole `Config`. A change to a borrowing or funding parameter needs the market to have accrued in the current ledger, else `MarketNotAccrued` (703). `Frozen` waives that check. | [Config](./config.md#accrual-before-a-rate-change) |
| `set_status` | Moves the market to another status. Entering `Retired` needs an empty book and sweeps the credit-pool surplus to the vault. | [Market status](./status.md) |
| `set_terminal_price` | Sets or refreshes the flat settlement price of a `Delisted` market once `DELIST_GRACE` has passed. From the first write, every entry prices at it. | [Market status](./status.md) |
| `upgrade` | Replaces the contract code in place and keeps every storage entry. | [Ownership and upgrade](./dependencies.md#ownership-and-upgrade) |

The market also carries the two-step `Ownable` entries `get_owner`, `transfer_ownership`, `accept_ownership`, and `renounce_ownership`. The [Ownership and upgrade](./dependencies.md#ownership-and-upgrade) section gives their signers. The [Errors](./errors.md#ownable-codes) and [Events](./events.md#ownership-events) pages give their codes and payloads. The behavior of these entries is that of the [`stellar-access`](https://docs.openzeppelin.com/stellar-contracts/access/ownable) library.

### Trader and liquidity provider entries

Each entry needs the signature of its `user` argument and carries no price.

| Entry | Effect | Page |
|---|---|---|
| `create_order` | Creates an order of one of six kinds, each a market, limit, or stop order that increases or decreases the position. An increase escrows `margin + exec_fee`. A decrease escrows `exec_fee`. Returns the order id. | [Orders](./orders.md) |
| `cancel_order` | Cancels a resting order of `user` and refunds its full escrow. Returns the refund. | [Orders](./orders.md) |
| `create_vault_order` | Creates a deposit or redeem vault order and escrows the assets or shares plus `exec_fee`. Returns the order id. On a `Retired` market a redeem pays at once and returns id `0`, and a deposit traps `InvalidStatus` (702). | [Vault orders](./vault-orders.md) |
| `cancel_vault_order` | Cancels a resting vault order and refunds the escrow, `exec_fee` included. Returns the principal. | [Vault orders](./vault-orders.md) |
| `claim_credit` | Pays the claimable credit of `user`, which is earned funding plus any payout the market could not deliver. The payout is capped at what the credit pool holds, and any remainder stays claimable. | [Funding rate](./funding-rate.md) |

### Keeper entries

Any account may call these entries. Each takes a signed report as `price: Bytes`. An entry that pays a reward takes a `keeper` argument, names the recipient, and returns the payout in token-dec.

`execute_order` and `execute_vault_order` check the report against the oracle's trade staleness window. `execute_liquidation`, `execute_adl`, `update_adl_state`, and `accrue` use the wider close staleness window.

| Entry | Effect | Page |
|---|---|---|
| `execute_order` | Fills a resting order at the report price and settles it into the position. | [Orders](./orders.md) |
| `execute_liquidation` | Force-closes a position whose settled equity is below `maintenance_margin` of its notional. Also closes any position on a `Delisted` market once `DELIST_DEADLINE` has passed. | [Liquidation](./liquidation.md) |
| `execute_vault_order` | Fills a whole vault order at the effective price, in full or not at all. If the quote is under the order's `min_out`, it emits `reject_vault_order`, refunds the principal, pays the `exec_fee` to the keeper, and removes the order. A deposit refund that fails parks as claimable credit. A fill in the ledger that created the order traps `StalePrice` (740), and a redeem inside its `redeem_lock` traps `VaultOrderLocked` (751). A capacity gate traps and leaves the order. The gates are `VaultBalanceExceeded` (753), `UtilizationExceeded` (714), and `PendingPnlExceeded` (754). | [Vault orders](./vault-orders.md) |
| `execute_adl` | Closes part or all of a winning position on a side whose ADL flag is set. | [Auto-deleveraging](./auto-deleveraging.md) |
| `update_adl_state` | Recomputes the pending profit of both sides against the vault and sets or clears the per-side ADL flags. | [Auto-deleveraging](./auto-deleveraging.md) |
| `accrue` | Advances the borrowing and funding indices to the ledger timestamp. | [Pricing](./pricing.md) |

`update_adl_state` and `accrue` pay no reward and carry no `keeper` argument. The [Fees and settlement](./fee-system.md#each-keeper-entry-returns-its-keeper-leg) page gives the payout of every other entry.

### View entries

| Entry | Returns | Page |
|---|---|---|
| `get_config` | The current `Config`. | [Config](./config.md) |
| `get_market_data` | `MarketData` as of its last accrual. | [Storage](./storage.md) |
| `get_position` | The netted `Position` for `(user, is_long)`, or a zeroed one when none is stored. The read stores nothing. | [Position lifecycle](./position-lifecycle.md) |
| `get_order`, `get_vault_order` | The row for `(user, id)`. Traps `OrderNotFound` (730) or `VaultOrderNotFound` (750) when absent. | [Orders](./orders.md), [Vault orders](./vault-orders.md) |
| `get_order_counter` | The next unallocated order id of a user. Trade orders and vault orders share it, and it reads `1` before the first order. | [Orders](./orders.md) |
| `get_status` | The `Status` discriminant as a `u32`. | [Market status](./status.md) |
| `get_adl` | `AdlState`, the two per-side flags, zeroed until the first `update_adl_state`. | [Auto-deleveraging](./auto-deleveraging.md) |
| `get_claimable_credit` | The credit balance of a user, `0` when none. | [Funding rate](./funding-rate.md) |
| `get_retirement` | `None` while no delist is in effect. That covers a market never delisted and one whose last delist the owner reverted. Otherwise `(terminal_price, delisted_at)`, where `terminal_price` is `0` until the owner sets one and `delisted_at` is in unix seconds. | [Market status](./status.md) |
| `get_token`, `get_vault`, `get_oracle`, `get_treasury`, `get_feed` | The stored addresses and the `feed_id`. | [Constructor and dependencies](./dependencies.md) |

## Positions are netted per account and side

The market stores one position for each `(user, is_long)`. An account holds at most one long and one short. An increase grows the position on its side, a decrease shrinks it, and a full close stores a zeroed row. An increase that adds size locks that size against decreases for `notional_lock` seconds. One accepted price therefore cannot open and close the same size. The [Position lifecycle](./position-lifecycle.md) page gives the row layout, the increase and decrease paths, the lock, and the sweep of resting decrease orders.

## The status decides which entries run

A market is `Active`, `OnIce`, `Frozen`, `Delisted`, or `Retired`. Only `Active` accepts increases that add size. `Frozen` halts every entry that moves funds or takes a price. `Delisted` is the wind-down, and the owner can set a flat terminal price once `DELIST_GRACE` has passed. `Retired` is terminal and needs an empty book. `cancel_order` and `cancel_vault_order` run in every status except `Frozen`, where they trap `MarketFrozen` (704). The [Market status](./status.md) page gives the transitions and the gate on every entry.

## Units

Every rate, ratio, fee, and margin fraction is a `SCALAR_18` fixed-point value, where `10^18` is 100%. Borrowing and funding rates are per second. Prices are 18-decimal integers. Notional, margin, payouts, and fees are token-dec, the settlement token's own decimals. Base sizes carry the same decimals. The [Units and scales](../units.md) page defines each unit and the rounding rules.

The protocol bounds on `Config` fields and the wind-down windows are constants. The [Constants](./config.md#constants) section of the Config page lists them.

The [Errors](./errors.md), [Events](./events.md), and [Storage](./storage.md) pages index the whole contract by code, topic, and key.
