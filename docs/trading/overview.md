---
sidebar_position: 1
title: Trading Overview
---

# Trading Overview

Trading on Zenex means opening leveraged positions on asset prices. You never buy or sell the underlying asset. Instead, you take a directional bet using the vault's collateral token as margin, and your profit or loss is determined by how the price moves from your entry point. This page covers the core concepts you need to understand before placing your first trade.

## Position Basics

Every position on Zenex has a direction, a size, and collateral backing it. When you go long, you profit if the asset price rises. When you go short, you profit if the price falls. The collateral you deposit is your margin, and the notional value is the total size of your exposure. Leverage is the ratio between your notional and your collateral. For example, depositing 500 in collateral for a 5,000 notional position gives you 10x leverage.

Higher leverage means greater sensitivity to price movements. A 1% price move translates to a 10% change in equity at 10x leverage, a 20% change at 20x, and so on. The maximum leverage available depends on the market's margin parameter. A market with a 1% margin requirement allows up to 100x leverage, while a 5% margin requirement caps leverage at 20x.

## Order Types

Zenex supports two order types: market orders and limit orders.

Market orders execute immediately at the current oracle price when you submit the transaction. You specify your collateral, leverage, and direction, and the position opens in the same transaction. This is the simplest way to enter a position and is suitable when you want to trade at the current price without waiting.

Limit orders let you specify a target price at which you want your position to open. Your collateral is committed when you place the order, but the position is not filled until the oracle price reaches your target. For long positions, the limit triggers when the price drops to your specified level. For short positions, it triggers when the price rises to your level. Limit orders are filled by keepers, permissionless bots that monitor prices and execute orders when conditions are met. If the oracle price never reaches your target, the order remains pending until you cancel it.

## Position Lifecycle

A position on Zenex follows a clear lifecycle from creation to settlement.

The position opens when your market order executes or when a keeper fills your limit order. At this point, the protocol records your entry price, collateral, notional value, and the current state of all fee indices. A minimum open time of 30 seconds applies to all positions. During this window, you cannot close the position yourself, and stop-loss or take-profit orders will not trigger. This ensures every position carries real market risk and prevents risk-free extraction between oracle price updates.

While the position is open, you can manage it in several ways. You can add collateral to reduce your effective leverage and push your liquidation price further away. You can remove collateral to increase leverage, provided you stay within the market's margin limits. You can also set or update stop-loss and take-profit price levels. A stop-loss automatically closes your position if the price moves against you to a specified level, limiting your downside. A take-profit closes your position when the price reaches a target on the profitable side, locking in gains.

The position closes when one of several events occurs. You can close it manually at any time after the minimum open time has elapsed. A keeper can close it by executing your stop-loss or take-profit trigger. Or, if your equity drops below the liquidation threshold, a keeper will liquidate the position to protect the protocol from bad debt. In a liquidation, all remaining collateral is forfeited.

## Fee Overview

Zenex charges four types of fees, each serving a distinct purpose in keeping the protocol healthy and fair.

The base fee is charged when you open a position and again when you close it. Positions on the dominant side of the market (the side with more open interest) pay a higher base fee than positions on the non-dominant side. This encourages balanced markets.

The price impact fee scales with your position size relative to the market's impact parameter. Larger positions pay proportionally more, reflecting the cost that large orders would impose on a traditional order book.

The borrowing interest accrues continuously over the lifetime of your position and is charged only to the dominant side. It compensates the vault for the risk of backing your position. The rate increases as vault utilization and market utilization rise, using steep exponential curves that stay low when utilization is modest but climb sharply as capacity is consumed.

The funding rate is a continuous cost or credit between longs and shorts. The rate is recalculated hourly based on the current open interest imbalance, but it accrues every second against open positions. It flows entirely peer-to-peer: the dominant side pays the non-dominant side, with zero protocol cut. This mechanism incentivizes traders to balance the market. Funding is settled when a position is closed.

For a detailed breakdown of how each fee is calculated, see the [Fees](./fees.md) and [Funding Rate](./funding-rate.md) pages.

## Minimum Open Time

All positions must remain open for at least 30 seconds before they can be closed by the user or by a stop-loss or take-profit trigger. This ensures every position carries real market risk. Without this restriction, a trader could open and close a position within the same block to capture the difference between oracle price updates without any actual exposure to price movements. Liquidations are exempt from this restriction. If your equity falls below the liquidation threshold, keepers can liquidate your position regardless of how long it has been open.
