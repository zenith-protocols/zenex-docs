---
sidebar_position: 3
title: API Reference
---

# API Reference

The Zenex backend exposes a REST API for submitting transactions, querying positions, and accessing market data. The backend is a Cloudflare Worker built with the Hono framework, using Cloudflare D1 as its datastore. Position and market data are populated by the Zenex indexer, which receives on-chain events via Mercury webhooks and writes them to the shared D1 database.

:::note
This is a preliminary reference. The API is under active development and endpoint paths, request formats, and response shapes may change before the production release. Full API documentation will be published alongside the mainnet launch.
:::

## Base URL

The base URL varies by environment. For testnet, the backend runs as a Cloudflare Worker with a URL configured at deployment time. Consult the project's deployment configuration for the current base URL.

| Environment | Base URL |
|---|---|
| Testnet | _Configured at deployment time_ |
| Mainnet | _TBD_ |

## Endpoints

### Submit Transaction

`POST /submit`

Submits a signed Stellar transaction to the network. The backend validates the transaction envelope, simulates it against the Soroban RPC, and submits it if simulation succeeds. This endpoint is the primary way for frontends to submit transactions without requiring users to interact with the Stellar RPC directly.

The request body should contain the signed transaction XDR. The response includes the transaction hash and submission status.

### Get Positions

`GET /positions/:address`

Returns all positions for a given Stellar address. The data is sourced from the D1 database, which is populated by the indexer from on-chain events. Each position includes its current state (pending, filled, closed, liquidated), collateral, notional, entry price, and trigger prices.

This endpoint is more efficient than querying the on-chain contract directly for multiple positions because the indexer pre-processes and flattens the data into a queryable format.

### Get Markets

`GET /markets`

Returns market data for all registered trading pairs. Each market entry includes the feed ID, current open interest (long and short), funding rate, and market configuration parameters. This data is sourced from on-chain state and updated by the indexer.

### Leaderboard

`GET /leaderboard`

Returns the trading leaderboard, ranking addresses by realized PnL, number of trades, or other metrics. The leaderboard is computed from indexed trade history stored in D1.

### Testnet Faucet

`POST /faucet`

Distributes testnet tokens to a specified address. This endpoint is only available on testnet and is rate-limited to prevent abuse. The faucet distributes the collateral token (e.g., USDC) used by the trading contracts.

## Authentication

Most API endpoints are public and require no authentication. Transaction submission requires a signed Stellar transaction, where authentication is handled at the Stellar protocol level through the transaction signature rather than through API keys or tokens.

The faucet endpoint is rate-limited by IP address and wallet address to prevent abuse, but does not require authentication beyond providing a valid Stellar address.

## Data Freshness

Position and market data served by the API reflects the latest state processed by the indexer. There may be a short delay (typically under a few seconds) between an on-chain state change and its reflection in the API. For latency-sensitive applications such as keeper bots, querying the on-chain contract state directly via Soroban RPC is recommended.

## Error Responses

The API returns standard HTTP status codes. Error responses include a JSON body with a message field describing the issue. Transaction submission errors include the Soroban simulation result, which contains the specific contract error code if the transaction would fail on-chain. These error codes correspond to the `TradingError` enum defined in the [Trading Contract](/technical/trading/overview) documentation.

## Alternative Data Sources

For applications that need real-time or historical data beyond what the REST API provides, two alternatives are available.

Direct on-chain queries via Soroban RPC allow reading contract state with zero indexing delay. The trading contract exposes read-only functions (`get_position`, `get_market`, `get_user_positions`, `get_config`, `get_status`) that return current on-chain state. This approach is suitable for keeper bots and applications that need guaranteed freshness.

Event streaming via Mercury webhooks provides real-time notifications of on-chain events (position opens, closes, liquidations, funding updates). The Zenex indexer uses this approach internally, and external integrators can set up their own Mercury subscriptions to build custom indexing pipelines.
