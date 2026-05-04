---
sidebar_position: 4
title: SDK Quickstart
---

# SDK Quickstart

The [`@zenith-protocols/zenex-sdk`](https://www.npmjs.com/package/@zenith-protocols/zenex-sdk) package is the official JavaScript SDK for Zenex. It provides typed operation builders for the trading contract, the strategy vault, the price verifier, the treasury, and the factory, along with helpers for parsing positions, decoding events, and deriving on-chain ledger keys.

This page covers the common integration flow — opening a position through your trading wrapper, closing it, and reading position state. The SDK is designed so that swapping the contract address is sufficient to switch between the wrapper path and the direct path; nothing else in your code needs to change.

## Installation

```bash
npm install @zenith-protocols/zenex-sdk @stellar/stellar-sdk
```

The SDK has a peer dependency on `@stellar/stellar-sdk`, which provides the underlying transaction building, RPC client, and key handling primitives. Both packages should be on compatible versions; if the SDK refuses to build, check that your `@stellar/stellar-sdk` version is recent enough.

The SDK ships both ESM and CommonJS builds, so it works in any modern Node.js, Bun, Deno, or browser bundler setup.

## Pointing the SDK at Your Wrapper

The SDK exposes a `TradingContract` class that wraps the trading contract's ABI. The constructor takes a contract address. To use your wrapper, instantiate `TradingContract` with the wrapper address instead of the trading contract address:

```typescript
import { TradingContract } from '@zenith-protocols/zenex-sdk';

// Direct path: trades go straight to the trading contract, no integrator fee
const direct = new TradingContract('CCTRADING...');

// Wrapper path: trades go through your wrapper, you collect a fee on each trade
const wrapper = new TradingContract('CCWRAPPER...');
```

`TradingContract` is an operation builder. Every trading method returns a base64-encoded XDR `Operation` ready to be added to a Stellar transaction, signed, and submitted. The SDK does not assume a specific RPC client or signing flow, which keeps it usable from frontends, backends, and bots without forcing a particular stack.

## Opening a Market Order

```typescript
import { TradingContract } from '@zenith-protocols/zenex-sdk';
import { TransactionBuilder, Networks, rpc, Account } from '@stellar/stellar-sdk';

const wrapper = new TradingContract(WRAPPER_ADDRESS);
const server = new rpc.Server(SOROBAN_RPC_URL);

const userAccount = await server.getAccount(userPublicKey);

const operation = wrapper.openMarket({
  user: userPublicKey,
  market_id: 1,                       // BTC market in this example
  collateral: 1000_0000000n,          // 1000 USDC, 7-decimal
  notional_size: 10_000_0000000n,     // 10x leverage
  is_long: true,
  take_profit: 0n,                    // 0 = unset
  stop_loss: 0n,
  price: signedPythLazerPayload,      // verified by price-verifier
});

const tx = new TransactionBuilder(userAccount, {
  fee: '10000000',
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(xdr.Operation.fromXDR(operation, 'base64'))
  .setTimeout(60)
  .build();

const prepared = await server.prepareTransaction(tx);
prepared.sign(userKeypair);

const result = await server.sendTransaction(prepared);
```

The arguments are identical for the wrapper path and the direct path because the wrapper's `open_market` signature mirrors the trading contract's `open_market` signature. The only difference is the contract address and that the user's wallet pays an additional integrator fee on top of the collateral.

To preview the integrator fee before showing a quote, call `preview_fee` against the wrapper:

```typescript
const previewOperation = wrapper.previewFee(10_000_0000000n);
// Simulate the operation; the result is the fee in token-decimal units.
```

For a `0.1%` wrapper rate and a `10,000` USDC notional, the user will pay an additional `10` USDC on top of their `1,000` USDC collateral.

## Closing a Position

```typescript
const operation = wrapper.closePosition(
  userPublicKey,
  positionId,           // u32, returned by openMarket / placeLimit
  signedPythLazerPayload,
);
```

The trading contract returns the user's payout (`i128`) as the result of the call. The payout is sent to the user's wallet as part of the transaction; the wrapper does not mediate the payout. The user pays the close-side integrator fee separately, on top of any other costs.

If you want to read the position before closing — for example, to display a confirmation dialog with PnL — call `getPosition` against the **trading contract**, not the wrapper. The wrapper does not proxy reads:

```typescript
const trading = new TradingContract(TRADING_ADDRESS);
const op = trading.getPosition(userPublicKey, positionId);
// Simulate to read; this does not require user signature.
```

If you do not know the trading contract address at runtime — for example, a generic frontend that supports multiple wrappers — read it from the wrapper itself with `get_trading`. The SDK exposes this via the operation builder pattern, but since `get_trading` is a view, the typical approach is to simulate the operation against any account.

## Placing a Limit Order

Limit orders are placed through the wrapper exactly the same way market orders are, except that no price payload is needed (the order will be filled later by a keeper using a price at fill time):

```typescript
const operation = wrapper.placeLimit({
  user: userPublicKey,
  market_id: 1,
  collateral: 500_0000000n,
  notional_size: 5_000_0000000n,
  is_long: false,
  entry_price: 45000_00000000n,       // SCALAR_8 price units
  take_profit: 0n,
  stop_loss: 0n,
});
```

The integrator fee is charged at placement time, not at fill time. If a user places a limit order through your wrapper and the order is later canceled by the user via the trading contract's `cancel_position` (which is not proxied by the wrapper), the user receives their collateral back from the trading contract but does not receive the integrator fee back from the wrapper. This is intentional: the wrapper has provided the service of placing the order. Users should understand this before placing.

## Operations the Wrapper Does Not Proxy

The wrapper proxies only `open_market`, `place_limit`, and `close_position`. For everything else, point the SDK at the trading contract address directly:

| Operation | Where to call it |
|---|---|
| `cancelPosition` | Trading contract |
| `modifyCollateral` | Trading contract |
| `setTriggers` | Trading contract |
| `getPosition`, `getUserCounter`, `getMarketConfig`, `getMarketData`, `getMarkets`, `getConfig`, `getStatus`, `getVault`, `getPriceVerifier`, `getToken`, `getTreasury` | Trading contract |
| `applyFunding`, `updateStatus`, `execute` | Trading contract (permissionless or keeper) |

Mixing the wrapper and the trading contract in the same application is normal. A typical frontend will instantiate one `TradingContract` for the wrapper (used for `openMarket`, `placeLimit`, `closePosition`) and another for the trading contract (used for everything else).

## Reading Events

The SDK includes helpers for decoding events emitted by the trading, vault, treasury, and factory contracts. The `decodeEvent` function takes a normalized event payload (from your indexer of choice — Mercury, Goldsky, or directly from the RPC's `getEvents`) and returns a typed event matching the contract's event schema.

```typescript
import { decodeEvent, ZenexContractType } from '@zenith-protocols/zenex-sdk';

const decoded = decodeEvent({
  contractType: ZenexContractType.Trading,
  rawEvent,
});

if (decoded.type === 'OpenPosition') {
  console.log(decoded.user, decoded.id, decoded.notional);
}
```

The SDK does not currently include built-in decoders for wrapper events (`IntegratorFeeCharged`, `CloseFeeCharged`, `FeeRateUpdated`, `FeesWithdrawn`). If you want to track your own integrator revenue from events, you can decode them manually using `scValToNative` from `@stellar/stellar-sdk`. We are tracking adding wrapper event decoders to the SDK as a follow-up.

## Where to Go from Here

To deploy the wrapper that the SDK will call, see [Deploying Your Wrapper](./deploying-a-wrapper). To understand the wrapper's behavior in more detail, see [The Trading Wrapper](./trading-wrapper). For the underlying trading contract's full API surface, see the [Trading](/technical/trading/overview) section.
