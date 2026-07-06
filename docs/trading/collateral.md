---
sidebar_position: 2
title: Collateral
---

# Collateral

Collateral is the margin that backs your position and protects the vault if the trade takes a loss. The more collateral a position carries relative to its size, the further its liquidation price sits from the market and the lower its risk of liquidation (and vice versa), as described [here](./liquidation.md).

**Collateral moves at the fill**

You do not hand over collateral when you create an order. You grant a token allowance, and the collateral is drawn only when a keeper fills an increase. For a decrease, any collateral you withdraw and the fees due are settled out of the position at the fill. This means the value only leaves your wallet at the moment the trade actually executes against a verified price.

When you open or increase a position, the collateral posted is subject to the initial-margin floor:

$$
collateral \geq initialMargin \times notionalSize
$$

The initial margin is set per market by governance and determines the maximum leverage.

**Managing collateral after opening**

While a side is open you adjust its collateral by creating more orders. An increase can add collateral (with or without adding size), which lowers your effective leverage and pushes the liquidation price away. A decrease can withdraw collateral, which raises leverage as long as the position still satisfies the initial and maintenance margins afterward.

**Collateral-only orders**

An order does not have to change your size. A collateral-only order moves margin and nothing else: a collateral-only increase tops up an existing position, and a collateral-only decrease withdraws margin without closing any exposure. Orders that move no value at all are rejected, and any amount below the market's dust floor is rejected as well.

**The decrease lock on fresh size**

Newly added notional is locked against decreases for a short window set per market by governance. Until that window elapses, the freshly added size cannot be closed or withdrawn: a partial decrease may only touch the unlocked fraction, and a full close is blocked while any locked notional remains. A further increase folds into the live lock and resets its deadline. The lock ensures new size carries genuine market risk before it can be unwound.

**Collateral token**

The collateral accepted by a market is the vault token of that market's strategy vault. Which token is accepted depends solely on the vault, not on the asset you are trading. The exact settings per market can be seen [here](../markets/supported-assets.md).
