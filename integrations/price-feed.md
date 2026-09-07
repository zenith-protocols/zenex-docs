---
sidebar_position: 3
title: Price feed
---

# Price feed

A trader's `create_order` is price-free. The price arrives later, at fill time, from whoever fills the order: a keeper calling `execute_order`, `execute_liquidation`, `update_adl_state`, `execute_adl`, `execute_vault_order`, or `accrue`, or an integrator opening atomically through the router's `create_and_fill`. This page matters once you run fills yourself or open atomically. If your application only creates orders and leaves fills to public keepers, you can skip it.

## How the price is verified on-chain

Each market contract carries an immutable 32-byte `feed_id` anchor set at deployment, the Chainlink Data Streams V3 stream id for its market. When a filler submits a signed report, the contract hands the bytes to the oracle, which passes them verbatim to Chainlink's deployed verifier contract for the DON signature check, then decodes the returned report body and rejects a mismatched or non-V3 stream, an expired report, an observation outside the call's staleness window, and a non-positive or crossed bid/ask pair. A rejected report traps the whole call, so a fill can only ever land on a verified price.

The staleness window depends on the call. The two fill paths (`execute_order`, `execute_vault_order`) use the oracle's strict `trade_staleness`, at most 15 seconds and set lower in practice (10 seconds on the current testnet deployment). The gap-closing paths (`execute_liquidation`, `execute_adl`, `update_adl_state`, `accrue`) use the wider `close_staleness`, at most 120 seconds (60 seconds on testnet). Both windows are readable from the oracle (`tradeStaleness`, `closeStaleness`), and the forward allowance on a future-stamped report is `trade_staleness` on every path. Budget your submission latency against the strict window: a report that ages past it while the transaction is in flight fails with `PriceStale` (782).

Execution prices off the verified bid and ask, not a single mid price:

- An **increase** enters at the entry price: the ask for a long, the bid for a short.
- A **decrease** exits at the exit price: the bid for a long, the ask for a short.

A trigger and a `priceBound` are both judged on that same execution-side price, so a stop or a limit fires on the price the fill actually touches.

The verified report also carries a `publish_time`, the observation timestamp in seconds. To prevent replay, it must not predate the order (`publish_time >= order.created_at`) or the position's last mark (`publish_time >= position.priced_at`), with one exception: a market order (no trigger) filling in its own creation ledger is an atomic create-and-fill and accepts any oracle-accepted price. When a delisted market has a terminal price stored, the market prices flat (bid and ask both equal the terminal price) and submitted report bytes are ignored entirely.

## Get Data Streams credentials

Data Streams is a subscription product. Chainlink issues a client id and an HMAC secret for your account, which authenticate every REST call. Both are server-side secrets. Never ship either to the browser.

## The Data Streams request

The API exposes `GET /api/v1/reports/latest?feedID=0x…` on `https://api.dataengine.chain.link`. One request returns the latest report for one stream, and the stream id you request must equal the `feed_id` the target market was deployed with (read it from `getFeed`). Reports publish once per second upstream, so a one-second poll tracks the stream.

Every request carries three headers, an HMAC-SHA256 signature over a canonical string built from the method, the path including its query string, the hex SHA-256 of the body (the empty-string digest for a GET), the client id, and a millisecond timestamp:

```text
Authorization:                     <client id>
X-Authorization-Timestamp:         <unix milliseconds>
X-Authorization-Signature-SHA256:  hex(hmac_sha256(secret,
    "GET {path} {sha256_hex(body)} {client id} {timestamp_ms}"))
```

Sign each attempt at the moment you send it. The timestamp has to land inside the API's clock-skew window, so a signature reused across a retry after a slow first attempt can fall outside it.

The response wraps one report:

```json
{ "report": { "feedID": "0x0003…", "validFromTimestamp": 1786461747,
              "observationsTimestamp": 1786461747, "fullReport": "0x…" } }
```

`fullReport` is the only field the chain cares about. Hex-decode it and pass the bytes straight through as the `price` argument on the fill. It is the ABI-encoded signed envelope, so do not unwrap it, re-encode it, or trim it to the report body: the verifier checks the signatures over the envelope as delivered.

## Minimum working proxy

If your client is a browser, front the API with a small backend proxy so the HMAC secret never reaches the client. A Cloudflare Worker using [Hono](https://hono.dev/) gets you there in about thirty lines, and the same shape works on any Node-style runtime.

```typescript
import { Hono } from 'hono';

const HOST = 'https://api.dataengine.chain.link';
const enc = new TextEncoder();
const hex = (b: ArrayBuffer) =>
  [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');

const app = new Hono<{ Bindings: { DS_CLIENT_ID: string; DS_HMAC_SECRET: string } }>();

app.get('/reports/:feedId', async (c) => {
  const path = `/api/v1/reports/latest?feedID=${c.req.param('feedId')}`;
  const ts = Date.now();
  const bodyHash = hex(await crypto.subtle.digest('SHA-256', enc.encode('')));
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(c.env.DS_HMAC_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const canonical = `GET ${path} ${bodyHash} ${c.env.DS_CLIENT_ID} ${ts}`;
  const signature = hex(await crypto.subtle.sign('HMAC', key, enc.encode(canonical)));

  const res = await fetch(`${HOST}${path}`, {
    headers: {
      Authorization: c.env.DS_CLIENT_ID,
      'X-Authorization-Timestamp': String(ts),
      'X-Authorization-Signature-SHA256': signature,
    },
  });
  if (!res.ok) return c.json({ error: 'data streams request failed' }, 502);

  const json = await res.json() as { report?: { fullReport?: string; observationsTimestamp?: number } };
  const report = json.report;
  if (!report?.fullReport) return c.json({ error: 'no report' }, 502);
  return c.json({ data: report.fullReport, timestamp: report.observationsTimestamp ?? 0 });
});

export default app;
```

Your keeper (or `create_and_fill` flow) hits `GET /reports/0x0003…`, decodes `data` from hex into a `Uint8Array`, and passes that as the `price` argument on the fill:

```typescript
const { data } = await (await fetch(`${PROXY}/reports/${feedId}`)).json();
const report = Uint8Array.from(Buffer.from(data.replace(/^0x/, ''), 'hex'));

const fillOp = market.executeOrder(keeper, user, orderId, report);
```

## Previewing a verified price off-chain

To inspect what the oracle would accept without submitting a fill, simulate `OracleContract.verifyPrice`. It returns the verified `OraclePriceData` (`bid`, `ask`, `publish_time`), which is handy for showing an expected fill price or checking staleness before a keeper commits gas. For the expected fill price, read the execution side: the `ask` for a long increase, the `bid` for a short increase. The `feedId` argument must equal the market's `getFeed` anchor, and `protective` should match the class of the call you are previewing (`false` for a fill, `true` for a liquidation, ADL, or accrual).

```typescript
import { OracleContract, simulateAndParse } from '@zenith-protocols/zenex-sdk';

const oracle = new OracleContract(ORACLE_ADDRESS);
const { result } = await simulateAndParse(
  network,
  oracle.verifyPrice(report, feedId, false),
  OracleContract.parsers.verifyPrice,
);
```

`verifyPrice` is not a view: the verifier authorizes the oracle as its caller and both contracts bump storage TTLs, so simulate it rather than expecting a free read.

## Caching

A short in-memory cache per stream (a second or so, matching the upstream publish cadence) absorbs rapid polling without ever serving a report outside the strict staleness window. Key the cache by stream id, store the observation timestamp alongside the blob, and drop an entry once its age passes the window you are filling under. On Cloudflare Workers the map persists across requests inside a single isolate.

## When to skip the proxy

If your integration is a backend service (a keeper, a market maker, an automation) you can call the API directly with your client id and HMAC secret. The proxy pattern exists to keep the secret server-side when the client is a browser. Choose accordingly.
