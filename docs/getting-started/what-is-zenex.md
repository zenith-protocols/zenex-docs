---
slug: /
sidebar_position: 1
title: What is Zenex
---

# What is Zenex

Zenex is a decentralized perpetual futures exchange built on Stellar Soroban. It lets traders open leveraged long and short positions on assets without intermediaries, expiry dates, or centralized custody of funds. Every position is collateralized and settled in its market's settlement token, and the protocol's smart contracts handle position management end to end, from opening and closing to fee accrual and liquidation. Every fill matches on-chain against a verified oracle price, and the vault itself, transparent and governed by its own contract, is your counterparty for every trade.

The protocol is built around three roles. **Traders** take leveraged positions on asset prices. **Vault depositors** provide the liquidity that backs those positions, and the vault stands as the counterparty to every trade in its market. **Keepers** are permissionless actors who fill orders, run liquidations, and keep the market's accounting current, earning a fee for the work. Traders pay fees that flow to the vault, keepers, and treasury, which creates yield for depositors and incentives for keepers. The result is a self-sustaining system where liquidity providers earn returns, keepers are rewarded for maintaining the protocol, and traders get on-chain leverage.

## What Are Perpetual Futures

Perpetual futures, commonly called "perps," are derivative contracts that let you speculate on the price of an asset without ever owning the asset itself. If you believe XLM will rise, you open a long position. If you believe it will fall, you open a short. Your profit or loss is determined entirely by the price movement from your entry point, settled in the market's settlement token rather than in the underlying asset.

Unlike traditional futures contracts that expire on a fixed date, perpetual futures have no expiry. You can hold a position for minutes or for months. This flexibility needs a mechanism to keep the perpetual price anchored to the real market price. That mechanism is the funding rate, a continuously accruing cost between the long and short sides. When one side dominates, it pays the lighter side, which rewards traders for taking the less popular side and pulls the market back toward balance. On Zenex, funding accrues into a pool and is **claimed**: the side that earns funding claims its balance, rather than having it silently credited.

Leverage is the other defining feature of perpetual futures. Instead of posting the full notional value of a position, you post a fraction as collateral (called margin). With 10x leverage, for example, you control a 10,000 notional position with 1,000 in collateral. This amplifies both gains and losses. If the market moves against you enough that your equity falls below the maintenance margin, a keeper can liquidate your position to prevent bad debt.

## The Order and Keeper Model

Zenex separates deciding a trade from executing it. When you want to open, close, or adjust a position, you **create an order** signed by you. Your order is price-free: it says what you want to do and the bounds you will accept, but it does not carry a price and does not execute the moment you submit it. A permissionless **keeper** then **fills** your order at a price it proves against the market's Pyth Lazer oracle feed.

This split is what makes execution trustless. You never hand a keeper the right to trade on your behalf beyond what your order allows: your order sets a size, a price bound for slippage, an expiration, and, for stop-loss and take-profit orders, a trigger price. A keeper can only fill within those limits and at a verified price. Anyone can run a keeper, so no single operator can censor or hold your order, and the keeper reward can even route back to you if you fill your own order. See [Start Trading](./start-trading.md) for the full trader flow.

## Why Zenex

Zenex is fully on-chain and permissionless. Anyone with a Stellar wallet can trade or provide liquidity, and anyone can run a keeper. The smart contracts enforce every rule transparently. Fees, margin requirements, liquidation thresholds, and interest curves are all visible on-chain and can be governed through a timelock that gives users advance notice of changes. Every fill matches against a verified price that any permissionless keeper can execute, leaving no room for an operator to front-run or censor trades.

Capital efficiency is a core design goal. Each market pairs a trading contract with its own strategy vault, so liquidity is dedicated to the asset it backs and the risk of one market never spills into another. Traders fill against a verified Pyth Lazer price rather than a thin order book. The fee structure rewards balanced markets: the side that improves the long/short balance pays a lower fee than the side that worsens it. Borrowing interest follows a kink curve that steepens as the vault's liquidity is used up, keeping the system stable under heavy load.

Zenex is built on Stellar Soroban, which provides fast finality, low transaction costs, and a WebAssembly-based smart contract environment. Transactions settle in seconds and cost fractions of a cent, making the protocol practical for active trading. For developers, every contract is composable: wallets, trading bots, keepers, aggregators, and strategy products can integrate directly with the protocol's on-chain primitives.

## Markets on Zenex

Each market on Zenex is its own trading contract for a single asset, paired with its own vault. A market has an immutable oracle feed and its own configuration: the margin requirement (which determines maximum leverage), the liquidation threshold, the trade and impact fees, the borrowing and funding curves, and the utilization caps. Prices are sourced from Pyth Lazer oracle feeds and verified on-chain before any fill. See [Markets Overview](../markets/overview.md) for how markets are structured.
