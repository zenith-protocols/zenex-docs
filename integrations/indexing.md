---
sidebar_position: 5
title: Indexing
---

# Indexing

Zenex runs a hosted indexer that consumes the trading contract's events through a Goldsky Turbo pipeline and writes position state to Postgres. A separate backend serves the data over a REST API. Use these endpoints to render a user's live positions and their closed-position history without operating any infrastructure of your own.

Base URL: _TBD_

## Live positions

```http
GET /positions/:userAddress
GET /positions/:userAddress?contract=:tradingContractAddress
```

Returns every pending and filled position the user holds. The optional `contract` query parameter narrows the result to a single trading contract; omit it to get positions across every contract the user has interacted with.

Response:

```json
{
  "positions": [
    {
      "contract_id": "C…",
      "user_address": "G…",
      "position_id": 7,
      "market_id": 1,
      "is_long": true,
      "filled": true,
      "col": "1000_0000000",
      "notional": "10000_0000000",
      "entry_price": "...",
      "sl": "0",
      "tp": "0",
      "placed_at": "2026-05-04T08:21:13.000Z",
      "filled_at": "2026-05-04T08:21:14.000Z",
      "updated_at": "2026-05-05T11:02:09.000Z",
      "market": { "symbol": "BTC/USD", "feedId": 1, "priceDecimals": 8 },
      "col_usdc": "1000.00",
      "notional_usdc": "10000.00",
      "entry_price_usd": "65432.10",
      "sl_usd": null,
      "tp_usd": null
    }
  ]
}
```

Raw `i128` fields are returned as strings to preserve precision, alongside descaled counterparts (`_usdc` / `_usd` suffixed). Pick whichever your client wants.

## Closed-position history

```http
GET /positions/:userAddress/history
GET /positions/:userAddress/history?contract=:tradingContractAddress&limit=:n
```

Returns closed positions ordered by `closed_at` descending. `limit` defaults to `100` and is capped at `500`. `contract` narrows by trading contract.

Response:

```json
{
  "positions": [
    {
      "contract_id": "C…",
      "user_address": "G…",
      "position_id": 4,
      "market_id": 1,
      "is_long": false,
      "col": "500_0000000",
      "notional": "5000_0000000",
      "entry_price": "...",
      "close_reason": "user",
      "notional_settled": "5000_0000000",
      "close_price": "...",
      "pnl": "12_4500000",
      "open_base_fee": "2_5000000",
      "open_impact_fee": "0",
      "close_base_fee": "5_0000000",
      "close_impact_fee": "0",
      "funding": "1_2300000",
      "borrowing_fee": "0_8500000",
      "liq_fee": null,
      "placed_at": "2026-05-03T14:00:00.000Z",
      "filled_at": "2026-05-03T14:00:01.000Z",
      "closed_at": "2026-05-04T18:42:33.000Z",
      "close_tx": "abc…",
      "market": { "symbol": "BTC/USD", "feedId": 1, "priceDecimals": 8 },
      "col_usdc": "500.00",
      "notional_usdc": "5000.00",
      "notional_settled_usdc": "5000.00",
      "entry_price_usd": "...",
      "close_price_usd": "...",
      "pnl_usdc": "12.45",
      "open_base_fee_usdc": "2.50",
      "open_impact_fee_usdc": "0.00",
      "close_base_fee_usdc": "5.00",
      "close_impact_fee_usdc": "0.00",
      "funding_usdc": "1.23",
      "borrowing_fee_usdc": "0.85",
      "liq_fee_usdc": null
    }
  ]
}
```

`close_reason` is one of `user`, `liquidation`, or `adl`. `pnl` is the realized PnL in raw token units (negative for losses); `pnl_usdc` is the descaled string. Every raw numeric field has a descaled counterpart in the same response.

## Running your own indexer

Zenex's indexer is a Node.js service that receives a Goldsky webhook, decodes Soroban events with `@zenith-protocols/zenex-sdk`, and writes to Postgres. The source ([`zenex-indexer`](https://github.com/zenith-protocols/zenex-indexer)) is a reference implementation; deploy it under your own Goldsky pipeline and Postgres database if you want full control over the data, custom enrichment, or to track a private trading contract that the hosted indexer does not.

The contract events consumed are documented in [Storage and Events](/technical/trading/storage-and-events). The same event schema is decoded by the SDK's `decodeEvent` helper, so you can build an alternative indexer in any language that can read Soroban events.
