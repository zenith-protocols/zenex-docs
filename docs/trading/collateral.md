---
sidebar_position: 2
title: Collateral
---

# Collateral

Collateral is the margin that backs your position and protects the vault if the trade takes a loss. The more collateral a position carries relative to its size, the further its liquidation price sits from the market and the lower its risk of liquidation (and vice versa), as described [here](./liquidation.md).

## Collateral moves at order creation

Creating an increase order moves the posted collateral, plus a flat execution fee, from your wallet into the trading contract right away. It sits there in escrow until a keeper fills the order against a verified price, at which point the escrowed collateral becomes the position's margin, less the fees due at the fill. The execution fee pays the keeper who fills the order. A decrease order escrows only the execution fee at creation. When a decrease fills, any collateral you withdraw and the fees due are settled out of the position.

If an order never fills, cancelling it returns the full escrow to your wallet. And when a position fully closes, whether by a fill, a liquidation, auto-deleveraging, or a market wind-down, any decrease orders still resting on that side are cancelled automatically and their escrow is returned with your payout.

When you open or increase a position, the collateral is subject to the initial-margin floor. The fees due at the fill come out of the posted collateral first, and what remains must be at least the initial margin's share of the notional size. For example, with a 1% initial margin a 1,000 USDC position needs at least 10 USDC of collateral remaining after fees, so post slightly more than the bare minimum or the fill fails. The initial margin is set per market through the protocol's [parameter-change process](../governance/parameter-changes.md) and determines the maximum leverage, as described on the [Margin and Leverage](./margin-and-leverage.md) page.

## Managing collateral after opening

While a side is open you adjust its collateral by creating more orders. An increase can add collateral (with or without adding size), which lowers your effective leverage and pushes the liquidation price away. A decrease can withdraw collateral, which raises leverage as long as the position still satisfies the initial and maintenance margins afterward.

## Collateral-only orders

A collateral-only order moves margin and nothing else, leaving your size unchanged: a collateral-only increase tops up an existing position, and a collateral-only decrease withdraws margin without closing any exposure. A collateral-only increase fills even on markets where opening new size is paused, so you can always add margin to defend an existing position. Orders that move no value at all are rejected, and any amount below the market's dust floor is rejected as well.

## The decrease lock on fresh size

Newly added notional is locked against decreases for a short per-market window. Until that window elapses, the freshly added size cannot be closed or withdrawn: a partial decrease may only touch the unlocked fraction, and a full close is blocked while any locked notional remains. A further increase folds into the live lock and resets its deadline. The lock ensures new size carries genuine market risk before it can be unwound.

## Collateral token

The collateral accepted by a market is the underlying token of that market's strategy vault. Which token is accepted depends solely on the vault, not on the asset you are trading. The exact settings per market can be seen [here](../markets/supported-assets.md).
