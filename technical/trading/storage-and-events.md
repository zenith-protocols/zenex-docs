---
sidebar_position: 12
title: Storage & Events
---

# Storage & Events

This page is the on-chain reference for the trading contract: its 14 events with exact topic layouts, the status lifecycle, the `Config` fields, and the error table.

## Events

All events use Soroban's `#[contractevent]` derive. The event-name symbol is the first topic, then the `#[topic]` fields in declared order, then all remaining fields form the data map. Amounts carry units: token decimals (token-dec), base decimals (base-dec), `price_scalar`, or `SCALAR_18`.

| Event | Topics (after the name symbol) | Data fields |
|---|---|---|
| `create_order` | `user`, `id` | `order` (the stored `Order` row) |
| `cancel_order` | `user`, `id` | (none) |
| `create_vault_order` | `user`, `id` | `order` (the stored `VaultOrder` row) |
| `cancel_vault_order` | `user`, `id` | (none) |
| `execute_vault_order` | `user`, `id` | `filled`, `remaining` (`remaining = 0` means completed and removed) |
| `claim_funding` | `user` | `amount` |
| `adl_update` | (none) | `long`, `short` (per-side ADL enabled flags) |
| `status_update` | (none) | `status` (u32 discriminant) |
| `config_update` | (none) | `config` |
| `terminal_price_update` | (none) | `price` |
| `increase_fill` | `user`, `id`, `is_long` | `notional`, `tokens`, `collateral`, `base_fee`, `impact_fee`, `funding`, `borrowing` |
| `decrease_fill` | `user`, `id`, `is_long` | `notional`, `tokens`, `collateral`, `pnl`, `base_fee`, `impact_fee`, `funding`, `borrowing`, `bad_debt`, `returned` |
| `liquidation` | `user`, `is_long` | `notional`, `tokens`, `collateral`, `pnl`, `base_fee`, `impact_fee`, `funding`, `borrowing`, `bad_debt`, `liq_fee`, `returned`, `forfeit` |
| `position_update` | `user`, `is_long` | `position` (the stored `Position` row; zeroed = closed) |

The factory emits one further event, `Deploy { trading, vault }`, when it deploys a pair. See [Factory](../factory/overview).

### Reading the fill receipts

`increase_fill`, `decrease_fill`, and `liquidation` carry the fill's itemized receipt. The resulting position state is carried by the paired `position_update`. A few conventions:

- **Fill price is implied**, `notional * SCALAR_18 / tokens` (in `price_scalar` units). No event carries a price field.
- **`funding` sign**: positive means funding was paid from collateral, negative means it was credited to the trader's claimable balance.
- **`collateral` and `pnl` are gross** of the itemized fees. On a `decrease_fill`, `returned` is the actual payout (the gross legs less the fees they cover, floored at zero). A partial close pays only the profit leg while a realized loss debits the surviving margin. `bad_debt` is `0` on partial closes.
- **`liquidation` tier**: `liq_fee = 0` is the soft tier (post-fee remainder on `returned`, to the trader), while `liq_fee > 0` is the hard tier (remainder on `forfeit`, to the vault).
- **ADL** emits a `decrease_fill` with `id = 0`.

The Ownable module additionally emits its standard ownership-transfer events.

## Status Lifecycle {#status-lifecycle}

The market runs through five states (the `u32` discriminant is in parentheses):

```text
Active (0)   OnIce (1)   Frozen (2)   Delisted (3)   Retired (4)
```

| Status | Opens | Closes / decreases | Vault orders | Claims | Keeper fills | Accrual |
|---|---|---|---|---|---|---|
| Active | yes | yes | yes | yes | yes | yes |
| OnIce | no | yes | yes | yes | yes | yes |
| Frozen | no | no | no | no | no | no |
| Delisted | no | yes | yes | yes | yes | yes |
| Retired | no | no (book already empty) | redeem (direct) only | yes | no | no |

- **Active** is the only status that accepts opens (size-growing increases).
- **OnIce** blocks opens, and everything else keeps running.
- **Frozen** is an emergency halt: `create_order`, `create_vault_order`, `cancel_vault_order`, `claim_funding`, every keeper fill, and `accrue_funding` revert with `MarketFrozen` (704). No accrual runs while a market is Frozen.
- **Delisted** starts the wind-down. Opens are blocked. Within `DELIST_GRACE` (1 day) of the first delist it can be reverted to `Active` or `OnIce`, after that the trading statuses are unreachable for good, and a flat terminal settlement price can be set and refreshed. Once `DELIST_DEADLINE` (7 days) passes, keepers may force-close any remaining position regardless of health, at the flat terminal price if one has been stored and at a verified feed price otherwise (healthy positions flow through the soft liquidation tier and keep full equity). Vault orders keep working in both directions, with redeems still gated by the withdraw-utilization and pending-PnL checks.
- **Retired** is final and reachable from any other status. The only gate is an **empty book** (all positions closed), else `MarketNotCleared` (706). Entering it sweeps the funding-pool surplus to the vault. Only `claim_funding`, a direct vault redeem (a `create_vault_order` redeem forwards straight to `vault.redeem` and returns id `0`, deposits are rejected), and cancels stay live. No transition leaves `Retired`.

`Active`, `OnIce`, and `Frozen` interchange freely on a live market. `Frozen`, `Delisted`, and `Retired` are each reachable from any other status except `Retired` itself. A same-status set is rejected with `InvalidStatus` (702). The switch to flat pricing is governed by terminal-price presence, not by the status value. Accrual never stops during the wind-down. Once a terminal price is stored, it keeps running with everything priced flat at the stored value.

## Config Fields {#config-fields}

The global `Config` is set at deployment and replaced wholesale by `set_config`. Every field is set per market by governance, and the table notes the main ordering and range invariants the protocol enforces. All fractional values are `SCALAR_18`, and rate parameters are per second.

| Field | Meaning |
|---|---|
| `keeper_rate` | Keeper share of the trade and vault fill fees |
| `min_position_notional`, `max_position_notional` | Position size floor and ceiling (token-dec) |
| `max_open_interest` | Per-side open-interest ceiling (token-dec), `>= max_position_notional` |
| `min_order_notional`, `min_order_collateral` | Per-order dust floors (token-dec) |
| `fee_dom`, `fee_non_dom` | Dominant and non-dominant trade fee rates, `fee_dom >= fee_non_dom`, capped at 1% |
| `impact_divisor` | Impact fee = worsening notional / this, floored at `MIN_IMPACT` |
| `max_util_open` | Opens blocked above this; also the borrow-reserve denominator |
| `max_util_withdraw` | Withdrawals blocked above this, `>= max_util_open` |
| `init_margin` | Initial margin; max leverage = `1 / init_margin` |
| `maintenance_margin` | Hard liquidation floor, `< init_margin` |
| `liq_fee` | Liquidation fee, capped at 25% |
| `notional_lock` | Decrease lock on newly added notional (seconds), in `[MIN_NOTIONAL_LOCK, MAX_NOTIONAL_LOCK]` |
| `target_util` | Borrowing kink utilization, `< 1` |
| `borrow_rate` | Borrowing slope below the kink (per second) |
| `increased_borrow_rate` | Borrowing rate at full utilization, `>= borrow_rate`, capped at `MAX_BORROW_RATE` |
| `funding_increase`, `funding_decrease` | Funding velocity acceleration and decay (per second squared) |
| `threshold_stable_funding`, `threshold_decrease_funding` | Skew bands for hold vs decay, decrease `<=` stable |
| `funding_min`, `funding_max` | Charged-rate floor and saved-rate cap (per second), capped at `MAX_FUNDING_RATE` |
| `adl_max_pnl` | ADL trigger on side PnL over half the vault, in `[MIN_ADL_TRIGGER, max_pnl_trader]`, `< 1` |
| `adl_clear_target` | ADL clear target, in `[MIN_ADL_CLEAR, adl_max_pnl]` |
| `max_pnl_trader` | Realized-profit haircut threshold, `< 1` |
| `redeem_lock`, `deposit_lock` | Vault-order cooldowns from `created_at` (seconds) |
| `instant_deposit_pnl` | Share underpricing at or under which a deposit skips its cooldown, `<= max_pnl_deposit` |
| `vault_fee` | Vault fill fee rate on moved assets |
| `min_deposit` | Minimum assets per vault-order fill (token-dec) |
| `max_pnl_deposit` | Deposit fills blocked above this share underpricing, `< 1` |
| `max_pnl_withdraw` | Redeem fills blocked above this share overpricing, `< 1` |
| `max_vault_balance` | Vault balance ceiling on deposit fills (token-dec) |

Changing a borrowing parameter (`target_util`, `borrow_rate`, `increased_borrow_rate`, or `max_util_open`, the borrow-reserve denominator) requires a same-ledger `accrue`, else `set_config` reverts with `BorrowingNotAccrued` (703).

## Error Codes

All errors are hard panics that abort the transaction. Trading errors occupy the `7xx` range.

| Code | Name | Meaning |
|---|---|---|
| 700 | `InvalidConfig` | A config value is out of bounds or an ordering invariant is violated |
| 701 | `InvalidPrice` | Flat settlement price is not strictly positive |
| 702 | `InvalidStatus` | Illegal status transition, or the action needs a different status |
| 703 | `BorrowingNotAccrued` | A borrowing rate changed without a same-ledger `accrue` |
| 704 | `MarketFrozen` | Action halted by status (`Frozen`, or `Retired` on trading paths) |
| 705 | `IncreaseHalted` | An Increase ran while the market does not accept opens (status or ADL flag) |
| 706 | `MarketNotCleared` | Retirement attempted while positions remain open |
| 710 | `NegativeValueNotAllowed` | A value that must be non-negative is negative |
| 711 | `NotionalBelowMinimum` | Resulting notional below `min_position_notional` |
| 712 | `NotionalAboveMaximum` | Notional (or an increase delta) above `max_position_notional` |
| 713 | `InsufficientMargin` | Equity below the initial-margin floor (open, increase, or withdraw) |
| 714 | `UtilizationExceeded` | Open interest or withdrawal would exceed the utilization cap |
| 715 | `OpenInterestExceeded` | A side's open interest would exceed `max_open_interest` |
| 720 | `PositionNotFound` | No position exists for `(user, is_long)` |
| 721 | `NotionalLocked` | Requested close exceeds the position's unlocked notional |
| 722 | `NotLiquidatable` | Liquidation attempted while equity is still above maintenance margin |
| 730 | `OrderNotFound` | No keeper order for `(user, id)` |
| 731 | `OrderExpired` | Order `expiration` is behind the current ledger sequence |
| 732 | `InvalidOrder` | Disallowed delta pair, a value below a dust floor, or an expiration beyond the storage horizon |
| 740 | `StalePrice` | Verified price predates the position or order (anti-replay) |
| 741 | `PriceBoundExceeded` | Fill price is worse than the order's `price_bound` |
| 742 | `TriggerNotMet` | The order's `trigger_price` was not crossed |
| 750 | `VaultOrderNotFound` | No vault order for `(user, id)` |
| 751 | `VaultOrderLocked` | Vault order filled before its cooldown elapsed |
| 752 | `PendingPnlExceeded` | Vault fill blocked by a pending-PnL gate (deposit, redeem, or the order's own bound) |
| 753 | `VaultBalanceExceeded` | Deposit fill would push the vault above `max_vault_balance` |
| 760 | `NothingToClaim` | Claim attempted with no claimable funding balance |
| 770 | `AdlNotTriggered` | ADL execution while the side is unflagged or already at the clear target |
| 771 | `AdlOvershoot` | ADL close overshot below the side's clear target |
| 772 | `AdlNotEligible` | ADL close did not reduce the side's pending PnL (not a winner) |

Access-control failures (a non-owner calling an owner-only entry point) raise the Ownable module's own unauthorized error.
