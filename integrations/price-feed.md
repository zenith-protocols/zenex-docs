---
sidebar_position: 3
title: Price feed
---

# Price feed

A trader's `create_order` is price-free. The price arrives later, at fill time, from whoever fills the order: a keeper calling `execute_order`, `execute_liquidation`, `update_adl_state`, `execute_adl`, `execute_vault_order`, or `accrue`, or an integrator opening atomically through the router's `create_and_fill`. This page matters once you run fills yourself or open atomically. If your application only creates orders and leaves fills to public keepers, you can skip it.

## How the price is verified on-chain

Each trading contract carries an immutable `(feed_id, exponent)` anchor set at deployment, where `price_scalar = 10^-exponent`. When a keeper submits a price update, the contract hands the bytes to the price-verifier, which delegates signature verification to the deployed Pyth Lazer contract (the LE-ECDSA envelope checked against its trusted signer set), then rejects a stale update (older than `max_staleness`), one whose confidence interval is wider than `max_confidence_bps`, and a missing, non-positive, crossed, or wrong-feed price. A malformed update traps the whole call, so a fill can only ever land on a verified price.

Execution prices off the verified bid and ask, not a single mid price:

- An **increase** enters at the entry price: the ask for a long, the bid for a short.
- A **decrease** exits at the exit price: the bid for a long, the ask for a short.

A trigger and a `priceBound` are both judged on that same execution-side price, so a stop or a limit fires on the price the fill actually touches.

The verified update also carries a `publish_time`. To prevent replay, the update must not predate the order (`publish_time >= order.created_at`), with one exception: a market order (no trigger) filling in its own creation ledger is an atomic create-and-fill and accepts any verifier-accepted price. When a delisted market has a terminal price stored, the market prices flat (bid, ask, and price all equal the terminal price) and submitted price bytes are ignored entirely.

## Get an API token

Sign up at [pyth.network/lazer](https://pyth.network/lazer) and grab your token. Store it as a server-side secret. Never ship it to the browser.

## The Pyth Lazer request

Pyth Lazer exposes a `POST /v1/latest_price` endpoint. The request asks for one or more feeds and which encodings to return. For Stellar you want the `leEcdsa` format because it carries the LE-ECDSA envelope the deployed Pyth Lazer verification contract checks against its trusted signer set. Request all six properties below: the verifier rejects a feed missing its best bid, best ask, or per-feed update timestamp.

```json
{
  "channel": "fixed_rate@1000ms",
  "properties": ["price", "bestBidPrice", "bestAskPrice", "exponent", "confidence", "feedUpdateTimestamp"],
  "formats": ["leEcdsa"],
  "priceFeedIds": [1],
  "jsonBinaryEncoding": "hex"
}
```

Feed IDs map to assets (`1` = BTC, `2` = ETH, `23` = XLM). The full list is in the Pyth Lazer dashboard, and the id you request must match the `feed_id` the target market was deployed with (read it from `getFeed`). Pyth runs three redundant nodes (`pyth-lazer-0.dourolabs.app`, `-1`, `-2`). Fail over between them on error.

## Minimum working proxy

If your client is a browser, front the Pyth Lazer REST API with a tiny backend proxy so the API token never reaches the client. A Cloudflare Worker using [Hono](https://hono.dev/) gets you there in about thirty lines. The same shape works on any Node-style runtime.

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
    properties: [
      'price', 'bestBidPrice', 'bestAskPrice',
      'exponent', 'confidence', 'feedUpdateTimestamp',
    ],
    formats: ['leEcdsa'],
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
        leEcdsa?: { data?: string };
      };
      const hex = json.leEcdsa?.data;
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

Your keeper (or `create_and_fill` flow) hits `GET /prices/1`, gets back `{ data, price, exponent, confidence, timestamp }`, decodes `data` from hex into a `Uint8Array`, and passes that as the `price` argument on the fill:

```typescript
const { data } = await (await fetch(`${PROXY}/prices/${feedId}`)).json();
const priceUpdate = Uint8Array.from(Buffer.from(data, 'hex'));

const fillOp = trading.executeOrder(keeper, user, orderId, priceUpdate);
```

## Previewing a verified price off-chain

To inspect what the verifier would accept without submitting a fill, simulate `PriceVerifierContract.verifyPrice`. It returns the verified `PriceVerifierPriceData` (`feed_id`, `price`, `exponent`, `bid`, `ask`, `publish_time`), which is handy for showing an expected fill price or checking staleness before a keeper commits gas. For the expected fill price, read the execution side: the `ask` for a long increase, the `bid` for a short increase, with `price` as the mid. The `feedId` and `exponent` arguments must match the market's `getFeed` anchors.

```typescript
import { PriceVerifierContract, simulateAndParse } from '@zenith-protocols/zenex-sdk';

const verifier = new PriceVerifierContract(PRICE_VERIFIER_ADDRESS);
const { result } = await simulateAndParse(
  network,
  verifier.verifyPrice(priceUpdate, feedId, exponent),
  PriceVerifierContract.parsers.verifyPrice,
);
```

## Caching

Pyth Lazer is fast but not free. A short in-memory cache per feed (for example 500 ms) absorbs rapid polling without ever serving a payload outside the verifier's staleness window. Add an `expiresAt` field to the response, check it before fetching, and store the last response in a `Map<number, ...>`. On Cloudflare Workers the map persists across requests inside a single isolate.

## When to skip the proxy

If your integration is a backend service (a keeper, a market maker, an automation) you can call Pyth Lazer directly with the API token. The proxy pattern exists to keep the token server-side when the client is a browser. Choose accordingly.
