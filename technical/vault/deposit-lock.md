---
sidebar_position: 2
title: Deposit Lock
---

# Deposit Lock

LP entry and exit run through the trading contract as **vault orders**, and the locks and gates that protect the pool are enforced there, on the fill, not on the vault. This page covers the vault-order lifecycle and the four protections that gate a fill: cooldowns, the pending-PnL gates, the utilization cap, and the balance cap. All the parameters named here are fields on the trading contract's `Config`, set per market by governance.

## The Vault Order

`create_vault_order(user, kind, amount, max_adverse_pnl)` opens a deposit or redeem:

- A **deposit** escrows `amount` assets in the trading contract, and a **redeem** escrows `amount` shares.
- The deposited assets, or a redeem's previewed assets, must clear `min_deposit`, else `InvalidOrder` (732).
- The order stamps a cooldown deadline (`unlocks_at`) at creation. A `Frozen` market rejects the call with `MarketFrozen` (704).
- `max_adverse_pnl` is the LP's own opt-in fill bound on adverse share mispricing (`SCALAR_18`, `0` = unbounded): a depositor declines to overpay while shares overprice beyond the tolerance, a redeemer declines to exit below fair value beyond it.

`cancel_vault_order` refunds the escrowed assets or shares in full. A `Frozen` market halts cancels with `MarketFrozen` (704), and the escrow stays in the trading contract until the freeze lifts. `execute_vault_order(keeper, user, id, amount, price)` fills up to `amount`, clamped to the order remainder. A fill also requires the verified price's `publish_time` to be at or after the order's `created_at`, else `StalePrice` (740). An order filling in its creation ledger is exempt. A partial fill keeps the remainder pending under the **same id** with `created_at` intact, so a redeem cooldown never restarts, and each fill and the surviving remainder must both clear `min_deposit`, else `InvalidOrder` (732). Every fill deducts the `vault_fee` cut of the moved assets, split keeper / treasury / vault.

## Deposit Fill Gates

A deposit mints shares net of the vault fee. It must clear:

- **Conditional cooldown.** The fill is instant while share underpricing (net pending trader loss over the vault) sits at or under `instant_deposit_pnl` (nothing to snipe). Share overpricing never triggers the cooldown. Otherwise the `deposit_lock` cooldown must elapse, else `VaultOrderLocked` (751).
- **Snipe gate.** Blocked while share underpricing (net pending trader loss over the vault) exceeds `max_pnl_deposit`, else `PendingPnlExceeded` (752). This stops a depositor from buying cheap shares just before pending trader losses are realized into the pool.
- **Balance cap.** The post-deposit balance (the assets net of the fee, plus the vault's own fee cut) may not exceed `max_vault_balance`, else `VaultBalanceExceeded` (753).

## Redeem Fill Gates

A redeem burns shares and pays assets net of the vault fee. It must clear:

- **Redeem cooldown.** The `redeem_lock` cooldown from `created_at` must elapse, else `VaultOrderLocked` (751).
- **Withdraw gate.** Blocked while share overpricing (net pending trader profit over the post-redeem vault) exceeds `max_pnl_withdraw`, else `PendingPnlExceeded` (752). This stops a redeemer from cashing out expensive shares just before pending trader profits are paid out of the pool.
- **Utilization.** The post-withdrawal balance must still back the reserve within `max_util_withdraw`, else `UtilizationExceeded` (714).

## Why the Gates Exist

Vault share price reflects only realized flow (the token balance), not the trading contract's **pending** PnL. Without gates, an LP could deposit right before pending losses land (buying cheap) or redeem right before pending profits are paid (selling dear), extracting value from honest LPs. The snipe and withdraw gates close both directions, and the cooldowns force a deposit or redeem to sit through the window in which pending PnL would resolve. `max_adverse_pnl` lets an individual LP tighten the bound further for their own order.

## Two Utilization Caps

The market carries two utilization caps. `max_util_open` gates new opens and is the borrow-reserve denominator. `max_util_withdraw` (`>= max_util_open`) gates redeems, retaining a minimum vault liquidity buffer so the pool can always back its open reserve. A live lock change can only pull a queued order's stamped deadline **earlier**, never extend it.
