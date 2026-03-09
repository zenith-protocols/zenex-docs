---
slug: /
sidebar_position: 1
title: About Zenex
---

# About Zenex

## What is Zenex?

Zenex is a decentralized perpetual futures exchange built on Stellar. It lets traders open leveraged long and short positions on crypto assets without intermediaries, expiry dates, or centralized custody of funds. All positions are settled in the vault’s collateral token.

Zenex is designed for speed, transparency, and composability. Traders can access on-chain leverage, while developers and integrators can build on top of the protocol’s core primitives,

## What is a Perpetual Exchange?

A perpetual exchange is a trading venue for perpetual futures, also called “perps” These are derivative contracts that let you speculate on an asset’s price without owning the asset itself and without an expiry date. On Zenex, traders can go long if they expect the price to rise or go short if they expect it to fall.

Unlike traditional futures, perpetuals do not settle on a fixed date. Instead, the protocol uses margin, liquidation rules, and an imbalance-based hourly interest mechanism to keep markets functional and risk-managed.

Here's how it works, fast:

- **Price tracking via funding rate:** Because there's no expiry, perps use a funding payment between longs and shorts (e.g., every 1–8 hours) to keep the perp price close to the spot/index price.
    - If the perp trades **above** spot, **longs pay shorts** (positive funding)
    - If it trades **below** spot, **shorts pay longs** (negative funding)
- **Leverage & margin:** You can borrow exposure (e.g., 5x, 10x, 25x+). You post collateral (margin). If the market moves against you too far, you can be liquidated (your position is closed to prevent your balance going negative)
- **No delivery of the asset:** You're trading a contract on price, not owning the underlying. PnL is realized in the collateral currency (USDT, USDC, BTC, etc.)
- **Fees & mechanics you'll see:**
    - **Maker/taker fees** on each trade
    - **Funding rate** (periodic, paid between traders)

## Markets on Zenex

Each Zenex market represents a specific asset and has its own fee settings, margin requirements, interest parameters, and collateral limits.
