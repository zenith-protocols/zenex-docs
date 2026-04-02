---
sidebar_position: 2
title: SDK Quickstart
---

# SDK Quickstart

The Zenex TypeScript SDK (`zenex-sdk-js`) provides typed wrappers for all contract interactions on Stellar Soroban. It handles transaction construction, XDR encoding, and contract client generation so that integrators can call trading contract functions with familiar TypeScript interfaces rather than raw Soroban RPC calls.

:::note
The SDK is under active development. The API surface described here represents the intended design. Package names, method signatures, and import paths may change before the production release. Full SDK API reference is available in the `zenex-sdk-js` repository README.
:::

## Installation

```bash
npm install @zenex/sdk
```

The SDK requires a Stellar account (keypair or smart account) for signing transactions. For testnet development, you can generate a new keypair or use the Zenex faucet to fund an existing account.

## Connecting to the Network

The SDK client needs a Soroban RPC endpoint and the addresses of the deployed contracts. For testnet, the RPC endpoint is `https://soroban-testnet.stellar.org`. Contract addresses can be found on the [Contract Addresses](/technical/deployments/contract-addresses) page.

```typescript
import { ZenexClient } from "@zenex/sdk";

const client = new ZenexClient({
  rpc: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  tradingAddress: "CAAAA...", // Trading contract address
  vaultAddress: "CBBBB...",   // Strategy vault address
});
```

## Opening a Position

To open a market position, you construct the transaction parameters and submit through the client. The SDK handles price data fetching, transaction assembly, and simulation before submission.

```typescript
// Open a 10x long BTC position with 100 USDC collateral
const result = await client.openMarket({
  user: walletAddress,
  feedId: 42,           // Pyth Lazer feed ID for BTC/USD
  isLong: true,
  collateral: 1000000000, // 100 USDC in 7-decimal token units
  notional: 10000000000,  // 1000 USDC notional (10x leverage)
  priceData: freshPricePayload,
});
```

The `priceData` parameter must contain a recent Pyth Lazer signed payload. The price verifier contract enforces staleness limits, so the price must be fresh at the time the transaction is executed on-chain.

## Closing a Position

```typescript
const result = await client.closePosition({
  user: walletAddress,
  positionId: 42,
  priceData: freshPricePayload,
});
```

The contract enforces `MIN_OPEN_TIME` (30 seconds), so a position cannot be closed in the same block it was opened. The returned result includes the PnL, fees, and final equity.

## Placing a Limit Order

```typescript
const result = await client.placeLimit({
  user: walletAddress,
  feedId: 42,
  isLong: true,
  entryPrice: 9500000000000, // Limit price in oracle decimals
  collateral: 1000000000,
  notional: 10000000000,
});
```

Limit orders do not require price data at placement time because the user specifies their desired entry price. The order remains pending until a keeper fills it when the market price reaches the limit.

## Querying State

The SDK provides read-only methods for querying contract state without submitting transactions.

```typescript
// Get a specific position
const position = await client.getPosition(positionId);

// Get all position IDs for an address
const ids = await client.getUserPositions(walletAddress);

// Get market config and data for a feed
const { config, data } = await client.getMarket(feedId);

// Get all registered feed IDs
const feeds = await client.getMarkets();

// Get current trading config
const tradingConfig = await client.getConfig();

// Get contract status (Active, OnIce, AdminOnIce, Frozen)
const status = await client.getStatus();
```

## Key Operations Summary

| Operation | Function | Auth Required | Price Data |
|---|---|---|---|
| Open market position | `openMarket` | User | Yes |
| Place limit order | `placeLimit` | User | No |
| Close position | `closePosition` | User | Yes |
| Cancel order/position | `cancelPosition` | User | No |
| Modify collateral | `modifyCollateral` | User | Yes (for withdrawals) |
| Set stop-loss/take-profit | `setTriggers` | User | No |
| Keeper execute batch | `execute` | None (permissionless) | Yes |
| Apply funding | `applyFunding` | None (permissionless) | No |

## Transaction Submission

Transactions can be submitted in two ways. Direct submission sends the signed transaction to the Soroban RPC endpoint, requiring the user's account to hold XLM for fees. Relayed submission sends the signed transaction to the Zenex relayer at `https://relayer.zenithprotocols.com`, which covers the XLM fees on behalf of the user. The SDK supports both modes through configuration.

## Next Steps

For building a complete trading frontend, see [Frontend Integration](./frontend-integration.md). For building automated execution bots, see [Building a Keeper Bot](./building-a-keeper-bot.md). For querying historical data and trade history, see the [API Reference](./api-reference.md).
