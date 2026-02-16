---
slug: /
sidebar_position: 1
title: About Zenex
---

# About Zenex

## What is Zenex?

Zenex is a DeFi protocol that allows anyone to create or utilize an immutable perpetual market that fits its needs.

## What is a Perpetual Exchange?

A "perps exchange" is a trading platform for perpetual futures ("perps") derivatives that let you bet on an asset's price (like BTC, ETH, etc.) without ever expiring. Unlike regular futures that settle on a set date, perps can be held indefinitely, as long as you have enough margin

Here's how it works, fast:

- **Price tracking via funding rate:** Because there's no expiry, perps use a funding payment between longs and shorts (e.g., every 1–8 hours) to keep the perp price close to the spot/index price.
    - If the perp trades **above** spot, **longs pay shorts** (positive funding)
    - If it trades **below** spot, **shorts pay longs** (negative funding)
- **Leverage & margin:** You can borrow exposure (e.g., 5x, 10x, 25x+). You post collateral (margin). If the market moves against you too far, you can be liquidated (your position is closed to prevent your balance going negative)
- **No delivery of the asset:** You're trading a contract on price, not owning the underlying. PnL is realized in the collateral currency (USDT, USDC, BTC, etc.)
- **Fees & mechanics you'll see:**
    - **Maker/taker fees** on each trade
    - **Funding rate** (periodic, paid between traders)
