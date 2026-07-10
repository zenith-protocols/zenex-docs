---
sidebar_position: 2
title: Vault Orders
---

# Vault Orders and Fill Gates

LP entry and exit run through the trading contract as **vault orders**, and the gates that protect the pool are enforced there, on the fill, not on the vault. This page covers the vault-order lifecycle and the fill gates: the per-order `min_out` slippage floor, the redeem cooldown, the redeem-side pending-PnL gate, the utilization buffer, and the balance cap. Apart from the per-order `min_out`, all the parameters named here are per-market fields on the trading contract's `Config`.

## The Vault Order

`create_vault_order(user, kind, amount, min_out)` opens a deposit (`kind` 0) or a redeem (`kind` 1). Any other kind traps `UnknownKind` (734).

- A **deposit** escrows `amount` plus the `exec_fee` in the settlement token. A **redeem** escrows `amount` vault shares plus the `exec_fee` in the settlement token.
- A deposit's gross `amount` must clear `min_deposit`, else `InvalidOrder` (732). A redeem requires only a positive share amount.
- `min_out` is the LP's slippage floor on the amount received at fill net of the vault fee: minted shares for a deposit, paid assets for a redeem. `0` leaves the bound unset, and a negative value traps `NegativeValueNotAllowed` (710).
- Market status gates creation. A `Frozen` market rejects the call with `MarketFrozen` (704). On a `Retired` market a deposit traps `InvalidStatus` (702), and a redeem executes immediately at creation: the shares transfer in, `strategy_redeem` runs with `net_pnl = 0`, no `exec_fee` is charged, and the call returns the reserved id `0`. Deposits stay open on `OnIce` and `Delisted` markets, so a wind-down vault keeps taking liquidity to fund remaining payouts.

`cancel_vault_order` refunds the escrowed principal and the escrowed `exec_fee` (the return value is the principal only). A `Frozen` market halts cancels with `MarketFrozen` (704), and the escrow stays in the trading contract until the freeze lifts.

`execute_vault_order(keeper, user, id, price)` fills the whole order at once and removes it. The verified price's `publish_time` must be strictly greater than the order's `created_at`, and at least the market's `last_price_time` (the publish time of the most recent consumed price). Either failing traps `StalePrice` (740). The flow is commit then execute: an atomic create-and-fill can never price a vault order. Every fill deducts the vault fee cut of the moved assets (`deposit_fee` on a deposit, `redeem_fee` on a redeem), split keeper / treasury / vault, and the keeper receives the escrowed `exec_fee` on top of its fee cut.

## Deposit Fill Gates

A deposit fill prices its mint through `strategy_deposit` with the book's pending PnL marked minimized (long side at bid, short at ask), the mark adverse to the depositor. It must clear:

- **Slippage floor.** The minted shares must reach the order's `min_out`, else `MinOutNotMet` (752). Skipped when `min_out` is `0`.
- **Balance cap.** After settlement the tracked vault balance (the vault's own fee cut included) may not exceed `max_vault_balance`, else `VaultBalanceExceeded` (753).

Deposits have no cooldown and no pending-PnL gate.

## Redeem Fill Gates

A redeem fill burns shares through `strategy_redeem` with pending PnL marked maximized (long side at ask, short at bid), adverse to the redeemer, and pays assets net of the vault fee. It must clear:

- **Redeem cooldown.** The fill traps `VaultOrderLocked` (751) while `now < created_at + redeem_lock`, with `redeem_lock` read live from config at fill, so a config change moves queued orders' effective deadlines in either direction.
- **Slippage floor.** The assets paid net of the vault fee must reach the order's `min_out`, else `MinOutNotMet` (752). Skipped when `min_out` is `0`.
- **Utilization.** After the redeem settles, each side's reserve must stay within `max_util_withdraw` of half the tracked vault balance, else `UtilizationExceeded` (714).
- **Pending-PnL gate.** After the redeem settles, either side's maximized pending trader profit exceeding `max_pnl_withdraw` of half the post-redeem vault balance traps `PendingPnlExceeded` (754).

The last two are act-then-check gates: the redeem executes, then a failing gate reverts the whole fill.

## Why the Gates Exist

Every fill prices shares against the book's pending PnL, marked adversely to the filler: a deposit mints with PnL minimized, a redeem burns with PnL maximized, and each side's pending profit is capped at `max_pnl_trader` of half the vault balance so the recognized liability never exceeds what closes can realize. Timing an entry or exit around pending PnL extracts nothing, since the share price already carries it and the bid/ask spread accrues to standing shareholders. The gates protect the pool's solvency and liquidity rather than its price: the redeem cooldown keeps liquidity sticky, the utilization buffer keeps the remaining balance able to back the open reserve, the pending-PnL redeem gate bounds the profit overhang against what would remain, and the balance cap bounds pool size. `min_out` is the LP's own opt-in bound on fill slippage.

## Two Utilization Caps

The market carries two utilization caps, both applied per side against half the tracked vault balance. `max_util_open` gates new opens after an increase fill's settlement and sets each side's borrow capacity denominator (`max_util_open` of half the vault). `max_util_withdraw` (`>= max_util_open`) gates redeems after settlement, retaining a minimum vault liquidity buffer so the pool can always back the open reserve on either side.
