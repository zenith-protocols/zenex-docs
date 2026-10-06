---
title: Errors
description: Every market error code, its condition, and the entries that can raise it.
sidebar_position: 18
---

# Errors

This page lists every code the market contract can raise, the condition behind it, and the entries that raise it. It also lists the traps that carry no `MarketError` code.

`MarketError` is a `#[contracterror]` enum with a `u32` representation. A rejection inside the market traps with one of its codes. The trap rolls back every effect of that market call, so no partial effect survives it. A caller that invokes the market through a fallible path catches the trap and continues. The [router batching page](../router/batching.md) gives those paths.

## Code bands

Each band groups the codes of one concern. A gap inside a band is a code no variant uses.

| Codes | Concern |
|---|---|
| 600 | The shared admin code. It carries the same meaning on every upgradeable contract in the protocol. |
| 700 to 706 | Config, status, and retirement. |
| 710 | The general guard on a negative number. |
| 711 to 716 | Position size, margin, and capacity limits. Utilization is 714, open interest is 715, and a size that rounds to zero is 716. |
| 720 to 723 | The position lifecycle. |
| 730 to 734 | Orders. |
| 740 to 742 | The fill price. |
| 750 to 754 | Vault orders and vault fills. The band leaves 752 unassigned. |
| 755 | Vault solvency. A settlement raises it on the order, liquidation, and auto-deleveraging (ADL) paths. |
| 760 | The claimable credit. |
| 770 to 772 | ADL. |

## Error codes

Every row names the entries that raise the code. Token amounts are in token-dec, the decimals of the settlement token. Prices are in feed precision, and a ratio is in `SCALAR_18`.

| Code | Variant | Condition | Raised by |
|---|---|---|---|
| 600 | `UpgradeNotOwner` | `operator` is not the stored owner | `upgrade` |
| 700 | `InvalidConfig` | Rules 2 to 20 of `Config::check_valid` fail, or `feed_id` does not start with `0x00 0x03` | `__constructor`, `set_config` |
| 701 | `InvalidPrice` | The flat settlement price is not strictly positive | `set_terminal_price` |
| 702 | `InvalidStatus` | `set_status` receives an unknown discriminant, a same-status set, or a move out of `Retired`. It also rejects a move to `Active` or `OnIce` once the delist grace window (`DELIST_GRACE`, 86,400 seconds) has passed. `set_terminal_price` runs while the status is not `Delisted` or the grace window is open. `create_vault_order` receives a deposit on a `Retired` market. | `set_status`, `set_terminal_price`, `create_vault_order` |
| 703 | `MarketNotAccrued` | A borrowing or funding rate parameter changes while the status is not `Frozen`, and `MarketData.accrued_at` is not the current ledger timestamp | `set_config` |
| 704 | `MarketFrozen` | The status is `Frozen`, or the status is `Retired` and the entry is one that retirement closes. The [status gate](#the-status-gate-of-marketfrozen) below lists both groups. | `create_order`, `cancel_order`, `create_vault_order`, `cancel_vault_order`, `claim_credit`, every price-bearing entry |
| 705 | `IncreaseHalted` | An increase with positive notional runs while the status is not `Active`, or while the target side carries an ADL flag | `execute_order` |
| 706 | `MarketNotCleared` | A retirement runs while a notional, tokens, or margin total is nonzero | `set_status` |
| 710 | `NegativeValueNotAllowed` | A value that must be non-negative is negative. Rule 1 of `Config::check_valid` raises it on the owner paths. `Order::require_valid` and `VaultOrder::require_valid` raise it on the trader paths. | `__constructor`, `set_config`, `create_order`, `create_vault_order` |
| 711 | `NotionalBelowMinimum` | The resulting position notional is below `min_position_notional`. An ADL close cannot raise it, because the full-close clamp absorbs a small remainder. | `execute_order` |
| 712 | `NotionalAboveMaximum` | An increase order's own notional, the position notional after a fill, or the remainder of a partial ADL close is above `max_position_notional` | `create_order`, `execute_order`, `execute_adl` |
| 713 | `InsufficientMargin` | The position margin is below the initial-margin requirement, which is `init_margin` times the notional rounded up. An ADL close skips the check. | `execute_order` |
| 714 | `UtilizationExceeded` | After an increase fill that adds notional, the increased side's reserved value is above `max_util_open` of half the settled vault balance. After a redeem fill, either side's reserved value is above `max_util_withdraw` of it. | `execute_order`, `execute_vault_order` |
| 715 | `OpenInterestExceeded` | An increase with positive notional leaves a side's open interest above `max_open_interest` | `execute_order` |
| 716 | `SizeRoundsToZero` | An increase with positive notional buys no base size at the entry price. Only a long can raise it, because a short rounds its size up. A margin-only increase, with notional 0, passes. | `execute_order` |
| 720 | `PositionNotFound` | The position notional is `0`. `get_position` never raises it. | `execute_order`, `execute_liquidation`, `execute_adl` |
| 721 | `NotionalLocked` | The close reaches notional that is still under the decrease lock | `execute_order`, `execute_adl` |
| 722 | `NotLiquidatable` | The settled equity is at or above the maintenance requirement, and the market is not both `Delisted` and past `DELIST_DEADLINE` | `execute_liquidation` |
| 723 | `PositionLiquidatable` | The settled equity is below the maintenance requirement, either before a decrease or ADL close, or after an increase or a partial close | `execute_order`, `execute_adl` |
| 730 | `OrderNotFound` | No `Order(user, id)` row exists. On a full close, the sweep of the listed decrease orders raises it when a listed row is missing. | `get_order`, `cancel_order`, `execute_order`, `execute_liquidation`, `execute_adl` |
| 731 | `OrderExpired` | `expiration` is behind the current ledger sequence | `create_order`, `execute_order` |
| 732 | `InvalidOrder` | The request fails a dust floor or a no-op check, a trigger kind carries a zero `trigger_price`, or the escrow sum overflows. `execute_adl` raises it when `amount` is below `min_order_notional`. | `create_order`, `create_vault_order`, `execute_adl` |
| 733 | `TooManyOrders` | The side already lists `MAX_ORDERS_PER_SIDE` (8) pending decrease orders | `create_order` |
| 734 | `UnknownKind` | The `kind` discriminant is not a known variant. A stored row always holds a known kind, so a fill or a cancel never raises it. | `create_order`, `create_vault_order` |
| 740 | `StalePrice` | The effective price predates the position's `priced_at` or the order's `created_at`. A vault fill in its order's creation ledger also raises it. A market order filled in its creation ledger skips the `created_at` check only. | `execute_order`, `execute_liquidation`, `execute_adl`, `execute_vault_order` |
| 741 | `PriceBoundExceeded` | The order's `price_bound` is nonzero, and the fill price is worse than it | `execute_order` |
| 742 | `TriggerNotMet` | The order is a trigger kind, and its `trigger_price` is not crossed at the fill price | `execute_order` |
| 750 | `VaultOrderNotFound` | No `VaultOrder(user, id)` row exists | `get_vault_order`, `cancel_vault_order`, `execute_vault_order` |
| 751 | `VaultOrderLocked` | A redeem fill runs before `redeem_lock` seconds have passed since `created_at` | `execute_vault_order` |
| 753 | `VaultBalanceExceeded` | A deposit fill leaves the settled vault balance above `max_vault_balance` | `execute_vault_order` |
| 754 | `PendingPnlExceeded` | A redeem fill leaves a side's pending profit and loss (PnL) above `max_pnl_withdraw` of half the settled vault balance | `execute_vault_order` |
| 755 | `VaultInsolvent` | The vault leg of a settlement is negative and larger than the tracked vault balance. Only a decrease fill can raise it on `execute_order`. | `execute_order`, `execute_liquidation`, `execute_adl` |
| 760 | `NothingToClaim` | The claimable amount, capped by the credit pool, is not positive | `claim_credit` |
| 770 | `AdlNotTriggered` | The side carries no ADL flag, or its pending PnL is at or below `adl_clear_target` of half the vault balance | `execute_adl` |
| 771 | `AdlOvershoot` | The close leaves the side's pending PnL under `adl_clear_target` of half the vault balance, re-measured after settlement | `execute_adl` |
| 772 | `AdlNotEligible` | The close does not reduce the side's pending PnL | `execute_adl` |

The [Orders page](./orders.md), the [Vault orders page](./vault-orders.md), and the [Auto-deleveraging page](./auto-deleveraging.md) own the mechanism behind these conditions. Every utilization check rounds toward rejection. The cap rounds down and a long side's reserve rounds up.

## The status gate of MarketFrozen

`Market::load` raises `MarketFrozen` (704) before it prices anything, so every price-bearing entry traps on a `Frozen` or `Retired` market. Those entries are `execute_order`, `execute_liquidation`, `execute_adl`, `execute_vault_order`, `update_adl_state`, and `accrue`. `create_order` traps on the same two statuses.

`cancel_order`, `cancel_vault_order`, `claim_credit`, and `create_vault_order` trap on `Frozen` alone. A `Retired` market therefore keeps cancels, funding claims, and a redeem through `create_vault_order` open.

`Status::from_u32` decodes every status discriminant and raises `InvalidStatus` (702) on an unknown one. `set_status` is the only entry that takes the discriminant from a caller.

## Failures without a MarketError

Seven other sources of a trap reach a caller of the market. None of them is a `MarketError`.

| Source | Codes | Reached through |
|---|---|---|
| Ownership | `OwnableError` (2100 to 2102) and `RoleTransferError` (2200 to 2203), both from stellar-access | `set_config`, `set_status`, `set_terminal_price`, `upgrade`, `transfer_ownership`, `accept_ownership`, `renounce_ownership` |
| Oracle | The oracle's codes, or the report verifier's own error | `verify_price`, which `Market::load` calls once per price-bearing entry |
| Treasury | None, because `get_rate` declares no error. A trap on the call is a host error. | `get_rate` on the treasury contract |
| Settlement token | The token contract's codes | Escrow, the cancel refund, the `claim_credit` payout, the retirement surplus sweep in `set_status`, and the vault, keeper, and treasury legs of every settlement |
| Strategy vault | The vault's codes | `strategy_deposit`, `strategy_redeem`, `strategy_withdraw`, `transfer` on the share token, and `preview_deposit` and `preview_redeem` when the order's `min_out` is positive |
| Authorization | None, because host authorization carries no contract error code | `require_auth` on `user` in `create_order`, `cancel_order`, `create_vault_order`, `cancel_vault_order`, and `claim_credit`. The escrow transfer from `user` in `create_order` and `create_vault_order`. The stored owner in the owner-only entries. |
| Arithmetic | None, because a host arithmetic trap carries no contract error code | The fixed-point and index math of the market, including `MarketData::side_reserved` and `MarketData::accrue_borrowing`, which declare no `MarketError` |

After a renounce, every owner-only entry traps with `OwnerNotSet` (2100). The [Ownable codes](#ownable-codes) table below gives the condition for each library code.

`Market::load` skips the oracle call while a terminal price is stored. The [price verification page](../oracle/verify-price.md) gives the report checks and the two staleness windows.

Every settlement reads the protocol fee rate. `Settlement::fee_split` reads it on an increase, a decrease, and a liquidation. `Settlement::compute_vault_order` reads it on a deposit fill, a redeem fill, and a vault-order rejection. A rejection pays only the keeper's `exec_fee`, and the vault fee is zero. The [fee rate page](../treasury/fee-rate.md) gives the treasury's surface.

The trader leg of a settlement is the exception to the token row. `pay_trader` uses a fallible transfer, and it parks the amount as a claimable credit when the transfer fails.

`Market::load` reads the vault's `total_assets` on every price-bearing entry. `create_vault_order` and `cancel_vault_order` move shares, and on a `Retired` market `create_vault_order` runs the redeem outright. `execute_vault_order` runs a deposit or a redeem, and quotes it through the preview calls when `min_out` is positive. A settlement with a negative vault leg calls `strategy_withdraw`. The [share pricing page](../vault/share-pricing.md) gives the codes for the deposit, the redeem, and both previews. The [share token page](../vault/share-token.md) gives them for `transfer`, and the [strategy withdraw page](../vault/strategy-withdraw.md) gives them for `strategy_withdraw`.

### Ownable codes

Codes 2100 to 2102 are `OwnableError` and codes 2200 to 2203 are `RoleTransferError`, both from stellar-access 0.7.2. The codes are the same on the oracle, factory, treasury, and governance contracts.

| Code | Name | Raised by | Condition |
|---|---|---|---|
| 2100 | `OwnerNotSet` | Every owner-only entry, `transfer_ownership`, `renounce_ownership` | The owner key is absent |
| 2101 | `TransferInProgress` | `renounce_ownership` | An unexpired pending transfer exists |
| 2102 | `OwnerAlreadySet` | Constructor | The owner key exists, which a constructor on a fresh instance never meets |
| 2200 | `NoPendingTransfer` | `transfer_ownership` with `0`, `accept_ownership` | No pending entry exists |
| 2201 | `InvalidLiveUntilLedger` | `transfer_ownership` with a value above `0` | `live_until_ledger` is below the current ledger sequence or above the highest sequence an entry can live to |
| 2202 | `InvalidPendingAccount` | `transfer_ownership` with `0` | `new_owner` differs from the pending address |
| 2203 | `TransferExpired` | `accept_ownership` | The current ledger sequence is above the pending `live_until_ledger` |

## The check order lives on the mechanism pages

This page gives the condition for a code, not the sequence an entry runs. The [Orders page](./orders.md) gives the numbered gate list for `create_order` and `execute_order`. The [Vault orders page](./vault-orders.md) gives the lists for `create_vault_order` and for the deposit and redeem fills. The [Liquidation page](./liquidation.md) and the [Auto-deleveraging page](./auto-deleveraging.md) give the lists for `execute_liquidation` and `execute_adl`. The [Config page](./config.md) numbers the `Config::check_valid` rules behind `InvalidConfig` (700). The [Market status page](./status.md) gives the transition matrix behind `InvalidStatus` (702).
