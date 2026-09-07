---
sidebar_position: 2
title: Quickstart
---

# Quickstart

The fastest path to trading Zenex perpetuals from your own application. You will install the SDK, load a market snapshot, build and preview a price-free market order, have a keeper fill it at a verified price, and read the resulting position back from the chain.

## 1. Install the SDK

```bash
npm install github:zenith-protocols/zenex-sdk-js#main @stellar/stellar-sdk
```

`@stellar/stellar-sdk` is a peer dependency and supplies transaction building, RPC, and key handling. Every contract builder in the Zenex SDK returns a base64 XDR operation string. Builders never make RPC calls and never sign, so you assemble, simulate, and submit with `@stellar/stellar-sdk` exactly as you would for any Soroban contract.

## 2. Load the market snapshot

A market contract instance is a single market, identified by its contract address. The published market addresses are in [Contract Addresses](/deployments/contract-addresses). `Market.load` pulls the whole market in one `getLedgerEntries` round trip; `loadWithUser` adds your user's positions and counters to the same trip. The snapshot is plain data — refreshing is calling `load` again.

```typescript
import { Market } from '@zenith-protocols/zenex-sdk';
import { rpc, TransactionBuilder, BASE_FEE, xdr, Networks } from '@stellar/stellar-sdk';

const network = {
  rpc: 'https://soroban-testnet.stellar.org',
  passphrase: Networks.TESTNET,
};

const server = new rpc.Server(network.rpc);
const contracts = await Market.resolveContracts(network, MARKET_ADDRESS); // { market, vault, token }
const { market, user } = await Market.loadWithUser(network, contracts, userPublicKey);
```

Throughout, `sign` is whatever wallet adapter you already use and `submit` sends an assembled transaction to the network (directly, or through a relayer). A small helper simulates and assembles a single operation:

```typescript
async function prepare(source: string, opXdr: string) {
  const account = await server.getAccount(source);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: network.passphrase,
  })
    .addOperation(xdr.Operation.fromXDR(opXdr, 'base64'))
    .setTimeout(30)
    .build();
  return server.prepareTransaction(tx); // simulate + assemble
}
```

## 3. Build, preview, and create a market order

`OrderIntent` builds the exact `OrderParams` you will sign: a `MarketIncrease` with no trigger, so a keeper can fill it at the next verified price. The order carries no price of its own — the intent's `slippageBps` derives a one-sided `priceBound` from the price you pass, and `ttlLedgers` sets the expiration. `previewOrder` then pre-flights that identical object through the exact fill engine, catching orders the chain would accept at creation but never fill.

```typescript
import { OrderIntent, previewOrder, parseAtomic, Price, MarketContract } from '@zenith-protocols/zenex-sdk';

const price = Price.from(displayPrice); // zero-spread; use new Price(bid, ask, t) from a verified report

const intent = new OrderIntent(market, userPublicKey, /* isLong */ true, /* ttlLedgers */ 60, /* slippageBps */ 100n);
const order = intent.openMarket({
  notional: parseAtomic('1000', market.assetDecimals), // size in quote, token-dec
  margin: parseAtomic('100', market.assetDecimals),    // margin posted with the order
  price,                                               // required because slippageBps != 0
});

const check = previewOrder(market, user.long, order, price);
if (check.outcome === 'gate') throw check.gate; // ZenexError, e.g. InsufficientMargin (713)
// 'fills' projects fees, execution price, and the resulting position; 'rests' just waits for a keeper.
```

The create escrows `margin` plus the market's flat execution fee in the settlement token on the trader's own signature, so no standing allowance to the market is needed. Build the operation from the same `OrderParams` and submit it:

```typescript
const marketContract = new MarketContract(order.market);
const openOp = marketContract.createOrder(
  order.user, order.isLong, order.kind, order.notional,
  order.margin, order.triggerPrice, order.priceBound, order.expiration,
);

const prepared = await prepare(userPublicKey, openOp);
const sent = await submit(await sign(prepared));
```

`create_order` returns the allocated order id. Parse it from the transaction's return value with the contract's parser, or read it from the emitted `create_order` event.

```typescript
import { parseResult } from '@zenith-protocols/zenex-sdk';

const confirmed = await server.getTransaction(sent.hash);
const orderId = parseResult(confirmed, MarketContract.parsers.createOrder);
```

All i128 amounts are `bigint`; parse user input with `parseAtomic`, never floats. To place a resting limit instead, use `intent.openLimit` with a `triggerPrice`. To attach exits, use `intent.takeProfit` / `intent.stopLoss`. Every intent method is listed in the [SDK reference](./sdk#order-intents-and-the-preview).

## 4. Fill the order

Filling is permissionless and price-bearing. A keeper (your own backend, a public keeper, or the router) fetches a signed Chainlink Data Streams report for the market's stream and calls `execute_order`. The `keeper` argument is only the reward recipient. The trader already consented by signing the create. The report is the raw `fullReport` envelope from the Data Streams API, hex-decoded, and the contract hands it to the oracle verbatim. The stream id to request is the market's own anchor, readable with `getFeed` (or `market.feedId` on the snapshot). See [Price feed](./price-feed) for the fetch itself.

```typescript
const report = await fetchReport(FEED_ID); // Uint8Array, see Price feed

const fillOp = marketContract.executeOrder(
  keeperPublicKey, // reward recipient
  userPublicKey,   // order owner
  orderId,
  report,
);

await submit(await sign(await prepare(keeperPublicKey, fillOp)));
```

The report's observation time must not predate the order (`publish_time >= order.created_at`), with one exception: a market order filling in its own creation ledger is an atomic create-and-fill and accepts any verified report. That is what the router's `create_and_fill` does, running the create and the fill in one fill-or-kill transaction. `calls[0]` is the order the fill targets, and any further calls (a resting take-profit, a cancel) just ride the batch.

```typescript
import { MarketRouterContract, createOrderCall } from '@zenith-protocols/zenex-sdk';

const router = new MarketRouterContract(ROUTER_ADDRESS);

const atomicOpen = router.createAndFill(
  [createOrderCall(order)], // the same OrderParams from step 3
  userPublicKey,            // order owner
  userPublicKey,            // keeper = user: the fill reward round-trips to the trader
  report,
);

await submit(await sign(await prepare(userPublicKey, atomicOpen)));
```

## 5. Read the position back

Reload the user against the snapshot and estimate for display. Estimates are floats computed from the exact mirrors — plain data for your UI, never to be fed back into a transaction.

```typescript
const after = await market.loadUser(userPublicKey);
const position = after.long; // MarketPosition: exact bigint fields and math

console.log({
  notional: position.notional, // size in quote, token-dec
  tokens: position.tokens,     // size in base
  margin: position.margin,
  equity: position.equity(market, price),           // exact bigint
  liquidationPrice: position.liquidationPrice(market),
});

const est = position.estimate(market, price); // PositionEstimate: floats for display
console.log(est.leverage, est.netPnlPercent, est.healthFactor);
```

A zeroed `notional` means no open position on that side. For a whole-market view (share price, per-side rates in percent per hour, open capacity), use `estimateMarket(market, price)` — see [the SDK reference](./sdk#estimates-floats-display-only).

## What's next

- [Price feed](./price-feed) for serving signed price reports to your keeper or `create_and_fill` flow.
- [SDK](./sdk) for the Market tier, every contract binding, parsers, and event types.
- [Indexing](./indexing) for tracking positions and fills off the event stream.
