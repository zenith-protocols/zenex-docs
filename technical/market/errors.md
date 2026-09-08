---
title: Errors
sidebar_position: 18
---

# Errors

`MarketError` is the error enum of the market contract. It is a `#[contracterror]` with a `u32` representation. A rejection inside the market traps with one of its codes. The trap rolls back every effect of that market call, so no partial effect survives it. A caller that invokes the market through a fallible path catches the trap and continues. The [router batching page](../router/batching.md) gives those paths.

The codes sit in bands. 600 is the shared admin code, and it carries the same meaning on every upgradeable contract in the protocol. 700 to 706 cover config and status. 710 is the general guard on a negative number. 711 to 715 cover position size and margin. 720 to 723 cover the position lifecycle. 730 to 734 cover orders. 740 to 742 cover the fill price. 750 to 755 cover vault orders. 760 covers the funding credit. 770 to 772 cover auto-deleveraging (ADL).

## Error codes

| Code | Variant | Condition | Raised by |
|---|---|---|---|
| 600 | `UpgradeNotOwner` | `operator` is not the stored owner | `upgrade` |
| 700 | `InvalidConfig` | a `Config::check_valid` rule from 2 onward fails, or `feed_id` does not start with `0x00 0x03` | `__constructor`, `set_config` |
| 701 | `InvalidPrice` | the flat settlement price is not strictly positive | `set_terminal_price` |
| 702 | `InvalidStatus` | the status discriminant is unknown, the transition is illegal, the action needs another status, or the delist grace window has not elapsed | `set_status`, `set_terminal_price`, `create_vault_order` |
| 703 | `MarketNotAccrued` | a borrowing or funding parameter changed while the status is not `Frozen`, and `MarketData.accrued_at` is not the current ledger timestamp | `set_config` |
| 704 | `MarketFrozen` | the status is `Frozen`, or the status is `Retired` and the entry is one that a retirement closes | `create_order`, `cancel_order`, `create_vault_order`, `cancel_vault_order`, `claim_credit`, every price-bearing entry |
| 705 | `IncreaseHalted` | a size-growing increase runs while the status is not `Active`, or runs while the target side carries an ADL flag | `execute_order` |
| 706 | `MarketNotCleared` | a retirement runs while a notional, tokens, or margin total is nonzero | `set_status` |
| 710 | `NegativeValueNotAllowed` | a value that must be non-negative is negative | `__constructor`, `set_config`, `create_order`, `create_vault_order` |
| 711 | `NotionalBelowMinimum` | the resulting position notional is below `min_position_notional` | `execute_order` |
| 712 | `NotionalAboveMaximum` | an increase order's own notional, or the position notional after the fill or after an ADL close, is above `max_position_notional` | `create_order`, `execute_order`, `execute_adl` |
| 713 | `InsufficientMargin` | the position margin is below the initial-margin floor | `execute_order` |
| 714 | `UtilizationExceeded` | a side's reserved value is above the utilization cap on half the vault balance | `execute_order`, `execute_vault_order` |
| 715 | `OpenInterestExceeded` | a side's open interest is above `max_open_interest` | `execute_order` |
| 720 | `PositionNotFound` | the position notional is `0` | `execute_order`, `execute_liquidation`, `execute_adl` |
| 721 | `NotionalLocked` | the close reaches notional that is still under the decrease lock | `execute_order`, `execute_adl` |
| 722 | `NotLiquidatable` | the settled equity is at or above the maintenance requirement, and the market is not both `Delisted` and past its delist deadline | `execute_liquidation` |
| 723 | `PositionLiquidatable` | the settled equity is below the maintenance requirement | `execute_order`, `execute_adl` |
| 730 | `OrderNotFound` | no `Order(user, id)` row exists | `get_order`, `cancel_order`, `execute_order`, `execute_liquidation`, `execute_adl` |
| 731 | `OrderExpired` | `expiration` is behind the current ledger sequence | `create_order`, `execute_order` |
| 732 | `InvalidOrder` | the request fails a size floor or a no-op check, a trigger kind carries a non-positive `trigger_price`, or the escrow sum overflows | `create_order`, `create_vault_order`, `execute_adl` |
| 733 | `TooManyOrders` | the side already lists `MAX_ORDERS_PER_SIDE` pending decrease orders | `create_order` |
| 734 | `UnknownKind` | the `kind` discriminant is not a known variant | `create_order`, `create_vault_order` |
| 740 | `StalePrice` | the effective price predates the position's `priced_at` or the order's `created_at`, or a vault fill runs in its order's creation ledger | `execute_order`, `execute_liquidation`, `execute_adl`, `execute_vault_order` |
| 741 | `PriceBoundExceeded` | the order's `price_bound` is nonzero, and the fill price is worse than it | `execute_order` |
| 742 | `TriggerNotMet` | the order is a trigger kind, and its `trigger_price` is not crossed at the fill price | `execute_order` |
| 750 | `VaultOrderNotFound` | no `VaultOrder(user, id)` row exists | `get_vault_order`, `cancel_vault_order`, `execute_vault_order` |
| 751 | `VaultOrderLocked` | the redeem fill runs before `redeem_lock` elapses | `execute_vault_order` |
| 752 | `MinOutNotMet` | the fill returns less than the order's `min_out` | `execute_vault_order` |
| 753 | `VaultBalanceExceeded` | the deposit fill leaves the vault balance above `max_vault_balance` | `execute_vault_order` |
| 754 | `PendingPnlExceeded` | the redeem fill leaves a side's pending profit and loss (PnL) above `max_pnl_withdraw` of half the post-redeem vault balance | `execute_vault_order` |
| 755 | `VaultInsolvent` | the settlement's vault draw is above the vault balance | `execute_order`, `execute_liquidation`, `execute_adl` |
| 760 | `NothingToClaim` | the claimable amount, capped by the credit pool, is not positive | `claim_credit` |
| 770 | `AdlNotTriggered` | the side carries no ADL flag, or its pending PnL is at or below `adl_clear_target` of half the vault balance | `execute_adl` |
| 771 | `AdlOvershoot` | the close leaves the side's pending PnL under `adl_clear_target` of half the vault balance | `execute_adl` |
| 772 | `AdlNotEligible` | the close does not reduce the side's pending PnL | `execute_adl` |

`MarketFrozen` (704) reaches the price-bearing entries through `Market::load`, which checks the status before it prices anything. Those entries are `execute_order`, `execute_liquidation`, `execute_adl`, `execute_vault_order`, `update_adl_state`, and `accrue`. A `Retired` market keeps `cancel_order`, `cancel_vault_order`, `claim_credit`, and a redeem through `create_vault_order` open.

`InvalidStatus` (702) covers an unknown discriminant through `Status::from_u32`. Every entry that reads the status decodes it that way, and `set_status` is the only entry that takes the discriminant from a caller.

Three raise sites in the table are indirect. `OrderNotFound` (730) reaches `execute_liquidation` and `execute_adl` through the decrease-order sweep that `Position::store` runs on a full close. `UtilizationExceeded` (714) measures against `max_util_open` after an increase fill and against `max_util_withdraw` after a redeem fill. `NegativeValueNotAllowed` (710) comes from rule 1 of `Config::check_valid` on the owner paths, and from `Order::require_valid` or `VaultOrder::require_valid` on the trader paths.

An ADL survivor is checked with a relaxed rule. `Position::require_valid` skips `InsufficientMargin` (713) for an ADL close, and the full-close clamp puts `NotionalBelowMinimum` (711) out of reach on that path. The clamp bounds the survivor from below only, so `NotionalAboveMaximum` (712) stays reachable for a partial ADL survivor. `UnknownKind` (734) is out of reach on every path that decodes a stored row, because the discriminant passed the check at creation. Those paths are the fill entries, `cancel_order`, `cancel_vault_order`, and the decrease-order sweep in `Position::store`. A market-kind order that fills in its creation ledger skips the order's `created_at` check. The position's `priced_at` floor still runs on that path, so `StalePrice` (740) stays reachable there.

## Failures without a `MarketError`

Seven other sources of a trap reach a caller of the market. None of them is a `MarketError`.

| Source | Codes | Reached through |
|---|---|---|
| Ownership | `OwnableError` (2100 to 2102) from stellar-access, and `RoleTransferError` (2200 to 2203) on `transfer_ownership` and `accept_ownership` | every entry marked `#[only_owner]`, `upgrade` among them |
| Oracle | the oracle's codes, or the report verifier's own error | `verify_price`, which `Market::load` calls once per price-bearing entry |
| Treasury | none of its own, so a trap on the call is a host error | `get_rate` on the treasury contract |
| Settlement token | the token contract's codes | escrow, cancel refund, the `claim_credit` payout, the retirement surplus sweep in `set_status`, and the vault, keeper, and treasury legs of every settlement |
| Strategy vault | the vault's codes | `strategy_deposit`, `strategy_redeem`, `strategy_withdraw`, and `transfer` on the share token |
| Authorization | none, because host authorization carries no contract error code | `require_auth` on `user` in `create_order`, `cancel_order`, `create_vault_order`, `cancel_vault_order`, and `claim_credit`, the escrow transfer that `create_order` and `create_vault_order` make from `user`, and the stored owner in every `#[only_owner]` entry |
| Arithmetic | none, because a host arithmetic trap carries no contract error code | the market's fixed-point and index math, including `MarketData::side_reserved` and `MarketData::accrue_borrowing` |

After a renounce, every entry marked `#[only_owner]` traps with `OwnerNotSet` (2100). The [Ownership and upgrade page](../ownership.md) gives the code table and the condition for each.

`Market::load` skips the oracle call while a terminal price is stored. The [price verification page](../oracle/verify-price.md) gives the report checks and the two staleness windows.

Every settlement reads the protocol fee rate. `Settlement::fee_split` reads it on an increase, a decrease, and a liquidation. `Settlement::compute_vault_order` reads it on a deposit fill and a redeem fill. The [fee rate page](../treasury/fee-rate.md) gives the treasury's surface.

A deposit fill pre-authorizes one more transfer of the net deposit assets from the market to the vault. `strategy_deposit` pulls that transfer inside the vault's own frame. The trader leg is the one exception. `pay_trader` uses a fallible transfer, and it parks the amount as a claimable credit when the transfer fails.

`Market::load` reads the vault's `total_assets` on every price-bearing entry. `create_vault_order` and `cancel_vault_order` move shares, and on a `Retired` market `create_vault_order` runs the redeem outright. `execute_vault_order` runs a deposit or a redeem, and a settlement with a negative vault leg calls `strategy_withdraw`. The [share pricing page](../vault/share-pricing.md) gives the codes for the deposit and the redeem. The [share token page](../vault/share-token.md) gives them for `transfer`, and the [strategy withdraw page](../vault/strategy-withdraw.md) gives them for `strategy_withdraw`.

`MarketData::side_reserved` and `MarketData::accrue_borrowing` declare no `MarketError`, so an arithmetic trap is their only failure.

## Order of the checks

This page gives the condition for a code, not the sequence an entry runs. A caller that needs the sequence reads the mechanism page for that entry. The [Orders page](./orders.md) gives the numbered gate list for `execute_order`. The [Liquidation page](./liquidation.md) and the [Auto-deleveraging page](./auto-deleveraging.md) give the lists for `execute_liquidation` and `execute_adl`. The [Vault orders page](./vault-orders.md) gives the deposit and redeem fills. The [Config page](./config.md) numbers the `Config::check_valid` rules behind `InvalidConfig` (700). The [Market status page](./status.md) gives the transition matrix behind `InvalidStatus` (702).
