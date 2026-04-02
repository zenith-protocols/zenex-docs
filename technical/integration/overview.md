---
sidebar_position: 1
title: Integration Overview
---

# Integration Overview

This section is for developers building on top of the Zenex protocol. Whether you are creating a trading frontend, operating a keeper bot, building an analytics dashboard, or integrating Zenex as a liquidity venue in an aggregator, these guides cover the architecture, tools, and interfaces you need to get started.

## Architecture Summary

The Zenex protocol consists of several smart contracts deployed on Stellar Soroban, supported by off-chain infrastructure for price feeds, indexing, and transaction relay.

The **trading contract** is the core engine. It manages the full lifecycle of perpetual futures positions: opening, closing, modifying collateral, setting stop-loss and take-profit triggers, processing limit order fills, liquidations, and auto-deleveraging. All trading logic, fee calculations, and PnL settlement happen on-chain within this contract.

The **strategy vault** provides liquidity. It is an ERC-4626 compliant tokenized vault where depositors supply collateral (e.g., USDC) in exchange for share tokens. The vault acts as the counterparty to all traders. When traders lose, the vault gains. When traders profit, the vault pays via the `strategy_withdraw` function, which only the paired trading contract can call.

The **price verifier** authenticates oracle data. It accepts Pyth Lazer price payloads signed by a trusted Ed25519 key, validates the signature, checks confidence and staleness bounds, and returns verified price data. The trading contract calls the price verifier on every price-dependent operation.

The **treasury** collects protocol fees. A configurable fraction of all protocol revenue (base fees, impact fees, and borrowing fees) is routed to the treasury. The treasury rate can be adjusted dynamically without redeploying the trading contract.

The **governance contract** (Trading Admin) is an optional timelock proxy. When set as the owner of a trading contract, it enforces a configurable delay between queuing and executing parameter changes, giving market participants time to react.

The **factory** deploys trading and vault pairs atomically with deterministic addresses. It serves as the canonical registry for verifying that a given address is a legitimately deployed Zenex trading contract.

## Off-Chain Infrastructure

Beyond the smart contracts, several off-chain services support the protocol.

The **Zenex backend** (`zenex-backend`) is a Cloudflare Worker that provides a REST API for submitting transactions, querying positions, accessing market data, and operating a testnet faucet. It uses the Hono framework and stores data in Cloudflare D1.

The **Zenex indexer** (`zenex-indexer`) receives Mercury webhook events from the Stellar network and indexes position data, market events, and trade history into D1. This enables efficient querying of historical data that would be expensive to reconstruct from on-chain state alone.

The **Zenex guardian** (`zenex-guardian`) is a Rust service that monitors protocol health. It manages funding rate updates, takes vault snapshots, monitors PnL exposure, and calls `update_status` when circuit breaker conditions are met.

The **Zenex keeper** (`zenex-keeper`) is a Rust bot that monitors positions and submits `execute` batches to fill limit orders, trigger stop-losses and take-profits, and liquidate underwater positions.

The **Zenex pricer** (`zenex-pricer`) relays real-time Pyth Lazer price data to connected clients, providing a WebSocket feed for frontends and bots that need continuous price updates.

The **OpenZeppelin Relayer** at `https://relayer.zenithprotocols.com` enables gasless transaction submission. Users sign transactions and the relayer submits them to the Stellar network, covering the XLM fees.

## Integration Entry Points

The right starting point depends on what you are building.

**Trading frontend.** If you are building a user-facing trading interface, start with the [SDK Quickstart](./sdk-quickstart.md) to understand how to interact with the contracts programmatically. Then read [Frontend Integration](./frontend-integration.md) for wallet connection, transaction flow, and price feed setup. The `zenex-trade` repository contains the reference frontend implementation.

**Keeper or liquidation bot.** If you want to earn fees by executing limit orders, triggering stop-losses, or liquidating positions, start with [Building a Keeper Bot](./building-a-keeper-bot.md). The `zenex-keeper` Rust crate provides a reference implementation. You will also want to review the [Keeper Execution](/technical/trading/keeper-execution) page in the trading documentation for the full contract interface specification.

**Analytics or indexing platform.** If you are building dashboards, leaderboards, or data feeds, the [API Reference](./api-reference.md) covers the REST endpoints exposed by the Zenex backend. You can also index on-chain events directly by subscribing to Soroban contract events via Mercury or the Stellar RPC.

**Aggregator or protocol integration.** If you are integrating Zenex as a venue within a larger system, start with the [SDK Quickstart](./sdk-quickstart.md) for the contract interface, then review the [Trading Contract](/technical/trading/overview) documentation for the full public interface specification, data structures, and status system.

## Network Information

| Property | Value |
|---|---|
| Network | Stellar testnet |
| Soroban RPC | `https://soroban-testnet.stellar.org` |
| Relayer | `https://relayer.zenithprotocols.com` |
| Contract addresses | See [Contract Addresses](/technical/deployments/contract-addresses) |

The protocol is currently deployed on Stellar testnet. Mainnet deployment details will be published separately.
