---
title: Public data API
sidebar_label: Prices and history
description: Read public configuration, display prices, orders, fills, and market history.
---

# Public data API

Use the backend for display prices and indexed history. Use Stellar RPC for current contract state and transaction confirmation.

The mainnet base URL is `https://api.zenex.trade`. Availability depends on the configured services. Indexed routes allow browser requests from any origin. Configuration and price routes use the service's origin allowlist. Request access or read them through your server.

## Find the data you need

| Read | Route |
| --- | --- |
| Market registry and app contracts | `GET /v1/config` |
| Display bid, ask, and price | `GET /v1/prices/tickers` |
| Chart candles | `GET /v1/prices/udf/history` |
| Recent market trades | `GET /v1/markets/:market/trades` |
| Market observations | `GET /v1/markets/:market/observations` |
| Funding and borrowing rates | `GET /v1/markets/:market/rates` |
| Vault performance | `GET /v1/markets/:market/vault-performance` |
| Pending lists and recent account history | `GET /v1/accounts/:account/state` |
| Trade orders | `GET /v1/accounts/:account/trade/orders` |
| Trade fills | `GET /v1/accounts/:account/trade/fills` |
| Vault orders | `GET /v1/accounts/:account/vault/orders` |
| Vault fills | `GET /v1/accounts/:account/vault/fills` |
| Finalized position lifecycles | `GET /v1/accounts/:account/trade/lifecycles` |

Use the market's `id` from configuration for `:market`. Use its `trading` address for SDK contract calls. Account routes accept either a Stellar account or a contract owner address. Optional market filters also use the configuration ID.

## Fetch a page

Pass a configuration market's `id` to this function. The Quickstart names that registry entry `selected`.

```ts
async function readTradePage(marketId: string) {
  const apiBase = "https://api.zenex.trade";
  const url = new URL("/v1/markets/" + marketId + "/trades", apiBase);
  url.searchParams.set("limit", "20");
  const response = await fetch(url);
  if (!response.ok) throw new Error("Trade history is unavailable");
  return response.json();
}
```

Collection routes return `data.items` and `data.nextCursor`. Pass a non-null cursor unchanged as the next request's `cursor`. Keep its route and filters the same.

Treat atomic amounts as decimal strings. Convert them to `bigint` for exact arithmetic. Format them with the token or share decimals from configuration. Rates use 18-decimal fractions per second. Exact ratio fields contain an integer numerator and denominator. Keep both when you calculate a result.

## Check freshness

Indexed responses contain:

```json
{
  "meta": {
    "apiVersion": "v1",
    "asOf": "<response time>",
    "indexedFromLedger": "<first covered ledger>",
    "throughLedger": "<last projected ledger>"
  }
}
```

`asOf` identifies the response time. `throughLedger` identifies the chain coverage. They answer different questions. A complete page covers the advertised indexed range. It does not promise history before `indexedFromLedger`. Keep the watermark with cached data. Show a freshness state when data trails the latest ledger.

:::warning History can lag behind a confirmed transaction
Refresh current balances and positions through RPC after confirmation. Wait for the index to cover the transaction ledger before you expect its history row.
:::

## Display prices and charts

Ticker responses contain `data` as a list. Each ticker includes `marketId`, `feedID`, `price`, `bid`, `ask`, `observationsTimestamp`, and `validFromTimestamp`. Prices are 18-decimal atomic integers encoded as strings. Observation times use Unix seconds. A failed feed can be absent while other tickers remain available. Ticker metadata identifies the data source and response time. Check each ticker's observation time before you present it as current.

Chart history uses `symbol`, `resolution`, `from`, and `to`. Use the market's `chartSymbol` for `symbol`. Times use Unix seconds. The chart endpoint follows TradingView's Universal Data Feed format. An HTTP 200 response can still contain `s: "error"` or `s: "no_data"`.

:::info Display data and execution data have different jobs
Ticker and chart endpoints return display values. Execution needs the full signed report described in [Signed price reports](./price-feed).
:::

## Handle failures

Backend errors use `{ error: { code, message, requestId } }`. Keep the request ID with your diagnostics. Show an unavailable state for missing index or price services. Use bounded retries for transport errors and throttling. Correct invalid input before another request.

For your own event pipeline, use [Index events](./indexing). For signatures and relay outcomes, use [Relayed transactions](./relay).
