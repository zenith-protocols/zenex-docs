---
sidebar_position: 6
title: Liquidation
---

# Liquidation

Liquidation protects the protocol from bad debt when a position no longer has enough equity to cover its risk. If your equity falls below the maintenance margin, a keeper can close the position to restore solvency. Depending on how far equity has fallen, you may keep the remainder or forfeit it, so it is vital to monitor your PnL and top up collateral during volatility to keep a position healthy.

Liquidations are permissionless. Anyone can run a keeper, submit a verified oracle price, and close an eligible position. The keeper that does so receives a cut of the close's trade fee as its reward.

## When a Position Is Liquidatable

A position's health is measured by its equity against the maintenance margin. Equity is your collateral plus unrealized PnL, net of accrued fees. The maintenance margin is a share of your notional, set per market by governance, and it always sits below the initial margin. A position becomes eligible for liquidation once its equity falls below the maintenance margin's share of its notional.

For example, on a market with a 1% maintenance margin, a position with a 10,000 USDC notional becomes liquidatable once its equity falls below 100 USDC.

The gap between the initial margin (checked when you open) and the maintenance margin (checked here) is the buffer that absorbs adverse price moves and accruing costs before a position is liquidatable. On an active market a healthy position is never liquidatable.

## Your Liquidation Price

The same rule can be read as a price level. Take a long of 10,000 USDC notional opened at 20x leverage, so 500 USDC of collateral, on that market with a 1% maintenance margin. The position becomes liquidatable once equity falls below 100 USDC, which takes a 400 USDC loss. That is a 4% adverse move: entered at 2.50, the liquidation price starts near 2.40. The mirror short entered at 2.50 starts near 2.60.

Treat it as a moving line, not a fixed one. Borrowing interest and any funding you pay accrue against your equity, and the close itself carries a trade fee, so the level creeps toward your entry price over time. Adding collateral pushes it away, and lower leverage starts it further away in the first place. At 5x in the same example the collateral is 2,000 USDC and the liquidation price starts near a 19% adverse move rather than 4%. The one exception is a market being wound down: once a delisted market's force-close deadline passes, keepers may close any remaining position regardless of health. A healthy position closed this way falls in the soft tier, so its remaining equity after fees is returned. See the market lifecycle in [Markets](../markets/overview.md).

## Two Tiers: Soft and Hard

When a position is liquidated, the outcome depends on how much equity is left, compared against a liquidation margin equal to the market's liquidation fee rate, set per market by governance, applied to the notional. On that same 10,000 USDC position, a 0.5% liquidation fee rate puts the liquidation margin at 50 USDC.

- **Soft liquidation**: equity still covers the liquidation margin (between 50 and 100 USDC in this example). No liquidation fee is charged, and the remaining equity after fees is returned to you. You are closed out, but you keep what is left.
- **Hard liquidation**: equity has fallen below the liquidation margin. The liquidation fee is charged, and the remainder is forfeited to the protocol. Nothing is returned to you.

The two tiers mean a position caught early, while it still holds meaningful equity, is treated far more gently than one that has deteriorated close to insolvency.

## Bad Debt

If a position's losses run past everything backing it, the shortfall is bad debt. Zenex absorbs bad debt into the vault rather than leaving it unsettled, so the market stays solvent and other traders are unaffected. This is the ultimate reason liquidations exist and why the maintenance-margin buffer is enforced: it keeps most positions from ever reaching the point where bad debt occurs.
