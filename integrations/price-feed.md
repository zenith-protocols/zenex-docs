---
sidebar_position: 3
title: Price feed
---

# Price feed

Trade calls require a signed Pyth Lazer payload. The cleanest way to wire this up is a tiny backend proxy that fronts the Pyth Lazer REST API: your frontend asks the proxy for a feed, the proxy adds the API token, and your client never sees the credential. This page is a minimum working example.

## Get an API token

Sign up at [pyth.network/lazer](https://pyth.network/lazer) and grab your token. Store it as a server-side secret. Never ship it to the browser.

## The Pyth Lazer request

Pyth Lazer exposes a `POST /v1/latest_price` endpoint. The request body asks for one or more feeds and which encodings to return; for Stellar trades you want the `solana` format because its Ed25519 signature scheme matches what the on-chain price verifier expects.

```json
{
  "channel": "fixed_rate@1000ms",
  "properties": ["price", "exponent", "confidence"],
  "formats": ["solana"],
  "priceFeedIds": [1],
  "jsonBinaryEncoding": "hex"
}
```

Feed IDs map to assets (`1` = BTC, `2` = ETH, `23` = XLM). The full list is in the Pyth Lazer dashboard. Pyth runs three redundant nodes (`pyth-lazer-0.dourolabs.app`, `-1`, `-2`); fail over between them on error.

## Minimum working proxy

A Cloudflare Worker using [Hono](https://hono.dev/) gets you to a working price feed in about thirty lines. The same shape works on any other Node-style runtime.

```typescript
import { Hono } from 'hono';

const NODES = [
  'https://pyth-lazer-0.dourolabs.app/v1/latest_price',
  'https://pyth-lazer-1.dourolabs.app/v1/latest_price',
  'https://pyth-lazer-2.dourolabs.app/v1/latest_price',
];

const app = new Hono<{ Bindings: { PYTH_LAZER_TOKEN: string } }>();

app.get('/prices/:feedId', async (c) => {
  const feedId = Number(c.req.param('feedId'));
  if (!Number.isInteger(feedId)) {
    return c.json({ error: 'invalid feed id' }, 400);
  }

  const body = JSON.stringify({
    channel: 'fixed_rate@1000ms',
    properties: ['price', 'exponent', 'confidence'],
    formats: ['solana'],
    priceFeedIds: [feedId],
    jsonBinaryEncoding: 'hex',
  });

  for (const url of NODES) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${c.env.PYTH_LAZER_TOKEN}`,
        },
        body,
      });
      if (!res.ok) continue;

      const json = await res.json() as {
        parsed?: { timestampUs?: string; priceFeeds?: { price: string; exponent: number; confidence: number }[] };
        solana?: { data?: string };
      };
      const hex = json.solana?.data;
      if (!hex) continue;

      const feed = json.parsed?.priceFeeds?.[0];
      return c.json({
        data: hex,
        price: feed?.price ?? '0',
        exponent: feed?.exponent ?? 0,
        confidence: feed?.confidence ?? 0,
        timestamp: Math.floor(Number(json.parsed?.timestampUs ?? '0') / 1_000_000),
      });
    } catch {
      // try the next node
    }
  }

  return c.json({ error: 'all Pyth Lazer nodes failed' }, 502);
});

export default app;
```

Your frontend hits `GET /prices/1`, gets back `{ data, price, exponent, confidence, timestamp }`, decodes `data` from hex into a `Uint8Array`, and passes that to the SDK as the `price` arg on a trade call.

## Caching

Pyth Lazer is fast but not free. A 500 ms in-memory cache per feed is enough to absorb rapid polling from a frontend without ever serving a payload that's outside the contract's staleness window. Add an `expiresAt` field to the response, check it before fetching, and store the last response in a `Map<number, ...>`. For Cloudflare Workers, the same map persists across requests inside a single isolate.

## When to skip the proxy

If your application is a backend service (a trading bot, a market maker, an automation) you can call Pyth Lazer directly with the API token. The proxy pattern exists to keep the token server-side when the client is a browser. Choose accordingly.
