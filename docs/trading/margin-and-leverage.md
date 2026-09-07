---
sidebar_position: 3
title: Margin and Leverage
---

# Margin and Leverage

Margin is the collateral that backs a position, and leverage is how large the position is relative to its margin. A position with 10 USDC of margin behind 100 USDC of notional size runs at 10x leverage. Because the vault backs the exposure your margin does not cover, every position is held to two margin floors: an initial margin you must meet whenever you change the position yourself, and a lower maintenance margin that marks the liquidation line.

## Isolated margin

Margin on Zenex is isolated per position. Each position is backed only by its own collateral, and a loss on one position never draws on the margin of another. Within a single market you can hold a long and a short at the same time, each margined separately. You add or withdraw margin by creating orders against the position, as described on the [Collateral](./collateral.md) page.

## Initial margin and maximum leverage

The initial margin is the floor checked whenever you change a position yourself. Opening, increasing, partially closing, and withdrawing collateral all require the remaining collateral to cover the initial margin's share of the remaining notional size. The check measures collateral on its own, before any unrealized profit or loss, so a favorable price move cannot stand in for posted margin.

The initial margin also sets the maximum leverage, which is one divided by the initial margin. A market with a 1% initial margin requires at least 10 USDC of collateral behind a 1,000 USDC position, so the most leverage available is 100x. A market with a 5% initial margin requires at least 50 USDC behind that same position, capping leverage at 20x. The initial margin is a per-market parameter set through the protocol's [parameter-change process](../governance/parameter-changes.md), so the leverage ceiling varies by market. Fees due at a fill come out of the posted collateral before the check runs, so post slightly more than the bare minimum.

## Maintenance margin

The maintenance margin is a lower floor checked against your live equity, meaning collateral plus unrealized profit or loss. It is the hard line for liquidation and is always set below the initial margin. A position whose equity falls below the maintenance margin's share of its notional size can be liquidated, as described on the [Liquidation](./liquidation.md) page.

## The buffer between the two lines

The gap between the initial and maintenance margins is the buffer that absorbs adverse price moves and accruing costs before a position becomes liquidatable. It also means you cannot withdraw collateral down to the maintenance level yourself, since every withdrawal must leave the position at or above the initial margin. Only liquidation and auto-deleveraging bypass the initial floor.

## How leverage affects your outcomes

Leverage amplifies both directions. Take a position with a notional size of \$100 backed by \$10 of collateral. If the price rises 10% and the position closes, the trader receives the \$10 collateral plus \$10 of profit, doubling the margin after only a 10% move. A 10% move the other way would instead wipe the collateral out.

Higher leverage also means a smaller buffer above the maintenance margin: the same price move consumes a larger share of a thinly collateralized position's equity, so a highly leveraged position becomes liquidatable after a smaller adverse move. And a position's effective leverage drifts after opening, as accrued fees and unrealized losses eat into its margin, which is why it pays to monitor leveraged positions and top up collateral when needed.

The exact margin checks and formulas are in the [technical reference](/technical/market/margin-and-leverage).
