---
sidebar_position: 2
title: Quickstart
---

# Quickstart

The fastest path to trading Zenex perpetuals from your own application. You will install the SDK, point a `TradingContract` at a market, approve the collateral allowance, create a price-free market order, have a keeper fill it at a verified price, and read the resulting position back from the chain.

## 1. Install the SDK

```bash
npm install @zenith-protocols/zenex-sdk @stellar/stellar-sdk
```

`@stellar/stellar-sdk` is a peer dependency and supplies transaction building, RPC, and key handling. Every builder in the Zenex SDK returns a base64 XDR operation string. Builders never make RPC calls and never sign, so you assemble, simulate, and submit with `@stellar/stellar-sdk` exactly as you would for any Soroban contract.

## 2. Point the SDK at a market

A trading contract instance is a single market, identified by its contract address: construct one `TradingContract` per market address. The published market addresses are in [Contract Addresses](/deployments/contract-addresses).

```typescript
import { TradingContract } from '@zenith-protocols/zenex-sdk';
import {
  rpc, Contract, Address, TransactionBuilder, BASE_FEE, xdr, nativeToScVal, Networks,
} from '@stellar/stellar-sdk';

const network = {
  rpc: 'https://soroban-testnet.stellar.org',
  passphrase: Networks.TESTNET,
};

const server = new rpc.Server(network.rpc);
const trading = new TradingContract(TRADING_ADDRESS);
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

## 3. Approve the collateral allowance

An increase order draws its collateral from the trader's token allowance at fill time, not at creation. Before the first order, approve the trading contract as a spender on the settlement token (a standard SEP-41 `approve`). Set `live_until_ledger` far enough ahead to cover the fill.

```typescript
const token = new Contract(COLLATERAL_TOKEN_ADDRESS);
const { sequence } = await server.getLatestLedger();
const liveUntil = sequence + 200_000; // ~11 days on testnet

const approveOp = token
  .call(
    'approve',
    Address.fromString(userPublicKey).toScVal(),
    Address.fromString(TRADING_ADDRESS).toScVal(),
    nativeToScVal(10_000_0000000n, { type: 'i128' }),
    xdr.ScVal.scvU32(liveUntil),
  )
  .toXDR('base64');

await submit(await sign(await prepare(userPublicKey, approveOp)));
```

The [trading router](./sdk#tradingroutercontract) can set this allowance for you as part of an atomic open; see step 5.

## 4. Create a market order

`openMarket` is a semantic helper over `create_order`. It builds an `Increase` order with no trigger, so a keeper can fill it at the next verified price. The order carries no price of its own: only `priceBound` (a one-sided slippage limit, `0n` to opt out) and `expiration` (a ledger sequence the order stays fillable through).

```typescript
const { sequence: seq } = await server.getLatestLedger();

const openOp = trading.openMarket({
  user: userPublicKey,
  isLong: true,
  notional: 10_000_0000000n, // size in quote, token-dec
  collateral: 1_000_0000000n, // margin posted at fill, token-dec
  priceBound: 0n,             // no slippage cap
  expiration: seq + 60,       // fillable for ~60 ledgers
});

const prepared = await prepare(userPublicKey, openOp);
const sent = await submit(await sign(prepared));
```

`create_order` returns the allocated order id. Parse it from the transaction's return value with the contract's parser, or read it from the emitted `create_order` event.

```typescript
import { parseResult } from '@zenith-protocols/zenex-sdk';

const confirmed = await server.getTransaction(sent.hash);
const orderId = parseResult(confirmed, TradingContract.parsers.createOrder);
```

All i128 amounts are `bigint`. To place a resting limit instead of a market order, use `openLimit` with a `triggerPrice`; to attach exits, use `placeTakeProfit` / `placeStopLoss`. Every helper is listed in the [SDK reference](./sdk#semantic-helpers).

## 5. Fill the order

Filling is permissionless and price-bearing. A keeper (your own backend, a public keeper, or the router) fetches a fresh serialized Pyth Lazer price update and calls `execute_order`. The `keeper` argument is only the reward recipient; the trader already consented through the allowance. See [Price feed](./price-feed) for fetching the price update.

```typescript
const priceUpdate = await fetchPriceUpdate(FEED_ID); // Uint8Array, see Price feed

const fillOp = trading.executeOrder(
  keeperPublicKey, // reward recipient
  userPublicKey,   // order owner
  orderId,
  priceUpdate,
);

await submit(await sign(await prepare(keeperPublicKey, fillOp)));
```

The verified price must not predate the order (`publish_time >= order.created_at`), with one exception: a market order filling in its own creation ledger is an atomic create-and-fill and accepts any verifier-accepted price. That is exactly what the router's `create_and_fill` does, setting the allowance, creating the order, and filling it in one fill-or-kill transaction:

```typescript
import { TradingRouterContract, OrderKind } from '@zenith-protocols/zenex-sdk';

const router = new TradingRouterContract(ROUTER_ADDRESS);

const atomicOpen = router.createAndFill(
  TRADING_ADDRESS,
  userPublicKey,   // keeper = user: the fill reward round-trips to the trader
  userPublicKey,
  1_000_0000000n,  // approveAmount: sets the collateral allowance first (0n to skip)
  true,            // isLong
  OrderKind.Increase,
  10_000_0000000n, // notional
  1_000_0000000n,  // collateral
  0n,              // triggerPrice (0 = market)
  false,           // triggerAbove
  0n,              // priceBound
  seq + 60,        // expiration
  priceUpdate,
);

await submit(await sign(await prepare(userPublicKey, atomicOpen)));
```

## 6. Read the position back

Reads are operation builders too: simulate them instead of submitting. `getPosition` looks up the netted position for `(user, isLong)`, and the matching parser decodes the return value into a typed `Position`.

```typescript
import { simulateAndParse } from '@zenith-protocols/zenex-sdk';

const { result: position } = await simulateAndParse(
  network,
  trading.getPosition(userPublicKey, true),
  TradingContract.parsers.getPosition,
);

console.log({
  notional: position.notional,   // size in quote, token-dec
  tokens: position.tokens,       // size in base, base-dec (entry = notional / tokens)
  collateral: position.collateral,
});
```

A zeroed `notional` means no open position on that side. To compute display values (PnL, equity, liquidation price) from the loaded state, use the `PositionView` and `MarketView` loaders described in the [SDK reference](./sdk#state-loaders-and-math).

## What's next

- [Price feed](./price-feed) for serving Pyth Lazer price updates to your keeper or `create_and_fill` flow.
- [SDK](./sdk) for every operation builder, parser, loader, and event decoder.
- [Indexing](./indexing) for tracking positions and fills off the event stream.
