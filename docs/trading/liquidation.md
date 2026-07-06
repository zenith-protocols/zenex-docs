---
sidebar_position: 6
title: Liquidation
---

# Liquidation

Liquidation protects the protocol from bad debt when a position no longer has enough equity to cover its risk. If your equity falls below the maintenance margin, a keeper can close the position to restore solvency. Depending on how far equity has fallen, you may keep the remainder or forfeit it, so it is vital to monitor your PnL and top up collateral during volatility to keep a position healthy.

Liquidations are permissionless. Anyone can run a keeper, submit a verified oracle price, and close an eligible position. The keeper that does so receives a cut of the close's trade fee as its reward.

## When a Position Is Liquidatable

A position's health is measured by its equity against the maintenance margin. Equity is your collateral plus unrealized PnL, net of accrued fees. The maintenance margin is a share of your notional, set per market by governance, and it always sits below the initial margin. A position becomes eligible for liquidation when:

$$
equity < maintenanceMargin \times notionalSize
$$

The gap between the initial margin (checked when you open) and the maintenance margin (checked here) is the buffer that absorbs adverse price moves and accruing costs before a position is liquidatable. A healthy position is never liquidatable.

## Two Tiers: Soft and Hard

When a position is liquidated, the outcome depends on how much equity is left, compared against a liquidation margin equal to the liquidation fee rate (`liq_fee`, set per market by governance) applied to the notional.

- **Soft liquidation**: equity still covers the liquidation margin. No liquidation fee is charged, and the remaining equity after fees is returned to you. You are closed out, but you keep what is left.
- **Hard liquidation**: equity has fallen below the liquidation margin. The liquidation fee is charged, and the remainder is forfeited to the vault. Nothing is returned to you.

The two tiers mean a position caught early, while it still holds meaningful equity, is treated far more gently than one that has deteriorated close to insolvency.

## Bad Debt

If a position's losses run past everything backing it, the shortfall is bad debt. Zenex absorbs bad debt into the vault rather than leaving it unsettled, so the market stays solvent and other traders are unaffected. This is the ultimate reason liquidations exist and why the maintenance-margin buffer is enforced: it keeps most positions from ever reaching the point where bad debt occurs.
