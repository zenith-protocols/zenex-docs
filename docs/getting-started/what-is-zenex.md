---
slug: /
sidebar_position: 1
title: What is Zenex
---

# What is Zenex

Zenex is a decentralized perpetual futures exchange built on Stellar Soroban. It allows traders to open leveraged long and short positions on assets without intermediaries, expiry dates, or centralized custody of funds. All trades are collateralized and settled in the vault's collateral token, and the protocol's smart contracts handle every aspect of position management, from opening and closing to fee accrual and liquidation. There is no off-chain order matching, no hidden spread, and no counterparty you need to trust with your funds.

The protocol is designed around three roles: traders, who take leveraged positions on asset prices, vault depositors, who provide the liquidity that backs those positions, and keepers, who monitor the market and execute actions like filling limit orders, triggering stop-losses, and liquidating underwater positions. Traders pay fees that flow to the vault and keepers, creating yield for depositors and incentives for keepers. This creates a self-sustaining ecosystem where liquidity providers earn returns, keepers are rewarded for maintaining the protocol, and traders get access to deep, on-chain leverage across multiple markets.

## What Are Perpetual Futures

Perpetual futures, commonly called "perps," are derivative contracts that let you speculate on the price of an asset without ever owning the asset itself. If you believe Bitcoin will rise, you open a long position. If you believe it will fall, you open a short. Your profit or loss is determined entirely by the price movement from your entry point, settled in the vault's collateral token rather than in the underlying asset.

Unlike traditional futures contracts that expire on a fixed date, perpetual futures have no expiry. You can hold a position for minutes or for months. This flexibility comes with a tradeoff: the protocol needs a mechanism to keep the perpetual price anchored to the real market price. That mechanism is the funding rate, a continuously accruing cost charged to the dominant side and credited to the minority side. When there are more longs than shorts, longs pay shorts, incentivizing traders to take the less popular side and bringing the market back toward balance. When shorts dominate, the flow reverses.

Leverage is the other defining feature of perpetual futures. Instead of putting up the full notional value of a position, you post a fraction as collateral (called margin). For example, with 10x leverage, you only need 1,000 in collateral to control a 10,000 notional position. This amplifies both gains and losses. If the market moves against you enough that your remaining equity falls below a safety threshold, the protocol will liquidate your position to prevent bad debt.

## Why Zenex

Zenex is fully on-chain and permissionless. Anyone with a Stellar wallet can trade or provide liquidity without registration, identity verification, or approval. The protocol's smart contracts enforce every rule transparently. Fees, margin requirements, liquidation thresholds, and interest rates are all visible on-chain and governed through a timelock process that gives users advance notice of any parameter changes. There is no opaque matching engine and no ability for the exchange operator to front-run or censor trades.

Capital efficiency is a core design goal. The vault-based liquidity model means that depositors' capital is pooled and available across all markets simultaneously, rather than being fragmented across individual order books. Traders benefit from consistent execution at oracle prices without slippage from thin order books. The fee structure is designed to reward balanced markets: traders on the less crowded side pay lower fees, while the crowded side pays more. Borrowing interest scales with utilization using steep exponential curves, which keeps the system stable even under heavy load.

Zenex is built on Stellar Soroban, which provides fast finality, low transaction costs, and a WebAssembly-based smart contract environment. Transactions settle in seconds and cost fractions of a cent, making the protocol practical for active trading strategies. For developers, every contract is composable. Wallets, trading bots, aggregators, and strategy products can integrate directly with the protocol's on-chain primitives.

## Markets on Zenex

Each market on Zenex represents a specific trading pair and has its own set of parameters. These include the margin requirement (which determines maximum leverage), the liquidation threshold, the price impact divisor, a per-market borrowing rate, and a per-market utilization cap. Prices are sourced from Pyth Lazer oracle feeds, providing reliable and tamper-resistant pricing data.
