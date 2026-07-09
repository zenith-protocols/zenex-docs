---
sidebar_position: 4
title: SDK
---

# SDK

[`@zenith-protocols/zenex-sdk`](https://www.npmjs.com/package/@zenith-protocols/zenex-sdk) is the TypeScript SDK for Zenex v2. It exposes:

- typed **operation builders** for the trading contract, the trading router, the factory, the price verifier, and the strategy vault
- **1:1 contract bindings** plus **semantic helpers** that compose the common trader flows
- **view parsers** and **state loaders** that decode on-chain reads, with client-side math for PnL, equity, and liquidation price
- **event decoders** for the 14 trading events across RPC, Mercury, and Goldsky payloads
- **error parsing** that turns a failed simulation or submission into a typed `ContractError`

The [Quickstart](./quickstart) walks the minimal flow end to end. This page is a flat reference for the parts an integrator touches.

## Install

```bash
npm install @zenith-protocols/zenex-sdk @stellar/stellar-sdk
```

`@stellar/stellar-sdk` is a peer dependency and supplies transaction building, RPC, and key handling. The SDK ships ESM and CJS builds and works in Node.js, Bun, Deno, and browser bundlers.

## Operation builders

Builders return a base64 XDR `Operation` string ready to add to a transaction. They never make RPC calls and never sign. Wrap the result with `xdr.Operation.fromXDR(op, 'base64')` and add it to a `TransactionBuilder`. Every `i128` argument is a `bigint`. A serialized Pyth Lazer price update is a `Buffer` or `Uint8Array`.

## TradingContract

```typescript
import { TradingContract } from '@zenith-protocols/zenex-sdk';

const trading = new TradingContract(TRADING_ADDRESS);
```

One instance is one market. The class mirrors the contract trait 1:1, then adds semantic helpers on top of `createOrder` / `createVaultOrder`.

### Trader entry points (price-free, authed by the user)

| Method | Purpose |
|---|---|
| `createOrder(user, isLong, kind, notional, collateral, triggerPrice, triggerAbove, priceBound, expiration)` | Create an order for a keeper to fill. `kind` is `OrderKind.Increase` or `OrderKind.Decrease`. Returns the order id. |
| `cancelOrder(user, id)` | Cancel a resting order the caller owns. |
| `createVaultOrder(user, kind, amount, maxAdversePnl)` | Escrow a vault deposit or redeem for a keeper to fill. `kind` is `VaultOrderKind.Deposit` or `VaultOrderKind.Redeem`. Returns the vault order id. |
| `cancelVaultOrder(user, id)` | Cancel a pending vault order and refund the escrow. |
| `claimFunding(user)` | Pay out the user's accrued claimable funding balance. |

`notional` and `collateral` are non-negative magnitudes in token decimals. `kind` sets their direction. `triggerPrice` and `priceBound` are in the feed's price scalar (`10^-exponent`), and `0n` disables each. `expiration` is a ledger sequence, and the order stays fillable while the current ledger is at or below it.

### Keeper entry points (permissionless, price-bearing)

| Method | Purpose |
|---|---|
| `executeOrder(keeper, user, id, price)` | Fill a resting order at a verified price. Returns the keeper payout. |
| `executeLiquidation(keeper, user, isLong, price)` | Force-close a position that has fallen below maintenance margin (or any position past a delisted market's deadline). |
| `updateAdlState(price)` | Recompute both sides' pending PnL and set or clear the ADL flags. |
| `executeAdl(keeper, user, isLong, amount, price)` | Deleverage a winning position on a flagged side. `amount` at or above the position's notional requests a full close. The close must reduce the side's pending PnL and stay at or above the re-measured clear target, or the call traps (`AdlOvershoot` on an oversized close, `NotionalLocked` on a lock-aged full close). |
| `executeVaultOrder(keeper, user, id, amount, price)` | Fill up to `amount` of a pending vault order. |

The `keeper` argument is only the reward recipient. It is not authenticated, and anyone may call these paths.

### Maintenance (permissionless, no auth)

| Method | Purpose |
|---|---|
| `accrueFunding()` | Advance the funding index to now. Price-free. |
| `accrue(price)` | Advance both the borrowing and funding indices at a verified price. |

### Admin (owner only)

| Method | Purpose |
|---|---|
| `setConfig(config)` | Replace the global `TradingConfig`. A borrowing-param change needs a same-ledger `accrue`. |
| `setStatus(status)` | Move through the status lifecycle (`Active`, `OnIce`, `Frozen`, `Delisted`, `Retired`). |
| `setTerminalPrice(price)` | Set or refresh the flat settlement price of a delisted market once its grace window has passed. |

The trading contract is immutable: there is no upgrade entry point. A logic change ships a fresh trading and vault pair through the factory. The Ownable surface (`getOwner`, `transferOwnership`, `acceptOwnership`, `renounceOwnership`) is also present.

### Views

| Method | Returns |
|---|---|
| `getConfig()` | The global `TradingConfig`. |
| `getMarketData()` | The market singleton `MarketData` (per-side open interest, indices, funding rate, pool). |
| `getPosition(user, isLong)` | The netted `Position` for `(user, isLong)`, zeroed if none. |
| `getOrder(user, id)` / `getVaultOrder(user, id)` | The stored `Order` / `VaultOrder`. |
| `getStatus()` | The `Status` discriminant (`u32`). |
| `getAdl()` | The `AdlState` per-side flags. |
| `getClaimableFunding(user)` | The user's claimable funding balance. |
| `getToken()` / `getVault()` / `getTreasury()` / `getPriceVerifier()` | The wired contract addresses. |
| `getRetirement()` | `[terminalPrice, delistedAt]`, or `undefined` if never delisted. |
| `getFeed()` | The immutable `[feedId, exponent]` oracle anchor. |

Reads are operation builders too: simulate them rather than submitting. See [Decoding view reads](#decoding-view-reads).

### Semantic helpers

Each helper takes a single args object and composes `createOrder` / `createVaultOrder` with the right `kind`, trigger, and sentinel. `FULL_CLOSE` (exported, equal to `i128::MAX`) is the full-close notional.

| Helper | Builds |
|---|---|
| `openMarket({ user, isLong, notional, collateral, priceBound, expiration })` | An `Increase` with no trigger. |
| `openLimit({ user, isLong, notional, collateral, triggerPrice, priceBound, expiration })` | An `Increase` with a trigger. Sets `triggerAbove = !isLong` (longs buy at or below the trigger, shorts sell at or above). |
| `closePosition({ user, isLong, priceBound, expiration })` | A `Decrease` with `FULL_CLOSE` notional and no collateral withdrawal. |
| `decreasePosition({ user, isLong, notional, collateral, priceBound, expiration })` | A partial `Decrease`, optionally withdrawing collateral. |
| `addCollateral({ user, isLong, amount, expiration })` | A collateral-only `Increase` (notional 0). |
| `withdrawCollateral({ user, isLong, amount, expiration })` | A collateral-only `Decrease` (notional 0). |
| `placeTakeProfit({ user, isLong, triggerPrice, notional?, priceBound, expiration })` | A full-close (or sized) `Decrease`. Sets `triggerAbove = isLong` (fires as profits grow). |
| `placeStopLoss({ user, isLong, triggerPrice, notional?, priceBound, expiration })` | A `Decrease`. Sets `triggerAbove = !isLong` (fires on the losing side). |
| `depositVault({ user, amount, maxAdversePnl })` | A `Deposit` vault order. |
| `redeemVault({ user, shares, maxAdversePnl })` | A `Redeem` vault order. |

```typescript
import { TradingContract, FULL_CLOSE } from '@zenith-protocols/zenex-sdk';

const trading = new TradingContract(TRADING_ADDRESS);

// Open a 3x long, filled by a keeper at the next verified price.
const openOp = trading.openMarket({
  user, isLong: true, notional: 3_000_0000000n, collateral: 1_000_0000000n,
  priceBound: 0n, expiration: ledgerSeq + 60,
});

// Attach a stop-loss on that long. triggerAbove is false: it fires when the
// exit price falls to or below the trigger.
const slOp = trading.placeStopLoss({
  user, isLong: true, triggerPrice: 58_000_00000000n,
  priceBound: 0n, expiration: ledgerSeq + 200_000,
});

// Fully close it at market.
const closeOp = trading.closePosition({
  user, isLong: true, priceBound: 0n, expiration: ledgerSeq + 60,
});
```

### Deploying a market directly

`TradingContract.deploy(deployer, wasmHash, args, salt?, format?)` builds the create-contract operation for a standalone trading contract. In practice you deploy through the [factory](#factorycontract), which atomically pairs a trading contract with its strategy vault.

## TradingRouterContract

```typescript
import { TradingRouterContract, OrderKind } from '@zenith-protocols/zenex-sdk';

const router = new TradingRouterContract(ROUTER_ADDRESS);
```

A stateless batching contract for keepers and integrators.

| Method | Purpose |
|---|---|
| `multicall(calls)` | Run `Call[]` in order. Any failure traps the whole batch (all or nothing). |
| `multicallTry(calls)` | Run `Call[]` in order, isolating each failure. Returns a `CallOutcome[]`. |
| `createAndFill(trading, keeper, user, approveAmount, isLong, kind, notional, collateral, triggerPrice, triggerAbove, priceBound, expiration, price)` | Set the allowance, create an order, and fill it fill-or-kill. Returns the fill payout. With `keeper = user` the reward round-trips to the trader. |
| `createAndTryFill(...same args...)` | Create strictly, then attempt an isolated fill. A failed fill leaves the order resting with its allowance in place. Returns a `FillAttempt`. |
| `createAndTryFillVaultOrder(trading, keeper, user, kind, amount, maxAdversePnl, price)` | Create a vault order and attempt an isolated fill. Returns a `FillAttempt`. |
| `adlSweep(trading, keeper, targets, price)` | Deleverage `AdlTarget[]` back to back, isolated. Stops once a side reaches its clear target. Returns a `CallOutcome[]`. |

`approveAmount` is the collateral allowance set for `trading` before the creation, and `0n` skips it. A router-set allowance rides the user-tier TTL horizon (roughly 120 days).

Types:

- `Call { contract, func, args }` where `args` is `xdr.ScVal[]`. `TradingRouterContract.buildCall(contract, func, args)` composes one.
- `CallOutcome { ok, value, error }`: `value` carries an `i128` return (keeper payouts) or `0n`. `error` is `0` on success, the contract error code on a contract failure, and `u32::MAX` for any other failure. `FillAttempt.error` follows the same convention.
- `FillAttempt { id, filled, payout, error }`: the created order `id`, whether the immediate fill landed, the payout when it did, and the fill's error code otherwise.
- `AdlTarget { user, isLong, amount }`: `amount` at or above the position's notional requests a full close. The contract does not size the close. A close that lands the side's pending PnL under the clear target re-measured on the settled vault balance fails with `AdlOvershoot`, reported in that target's `CallOutcome`, so size `amount` to the reduction still needed.

```typescript
const target = { user: winner, isLong: true, amount: FULL_CLOSE };
const sweepOp = router.adlSweep(TRADING_ADDRESS, keeper, [target], priceUpdate);
```

## Decoding view reads

Every builder ships a matching parser under `TradingContract.parsers` (and `TradingRouterContract.parsers`, `FactoryContract.parsers`, `PriceVerifierContract.parsers`). A parser turns the base64 XDR return value into a typed object. Two helpers wire simulation to parsing:

- `simulateAndParse(network, operation, parser)` simulates a read and returns `{ result, latestLedger }`.
- `parseResult(response, parser)` parses the return value out of a simulation or a fetched transaction.

```typescript
import { simulateAndParse, TradingContract } from '@zenith-protocols/zenex-sdk';

const network = { rpc: SOROBAN_RPC_URL, passphrase: NETWORK_PASSPHRASE };

const { result: config } = await simulateAndParse(
  network, trading.getConfig(), TradingContract.parsers.getConfig,
);
const { result: market } = await simulateAndParse(
  network, trading.getMarketData(), TradingContract.parsers.getMarketData,
);
const { result: position } = await simulateAndParse(
  network, trading.getPosition(user, true), TradingContract.parsers.getPosition,
);
```

Parsers decode into the SDK's typed mirrors: `Order`, `VaultOrder`, `Position`, `MarketData`, `AdlState`, and `TradingConfig`. Numeric keeper returns (`executeOrder`, `executeAdl`, `claimFunding`, and the like) parse to `bigint`.

## State loaders and math

For reads that skip simulation, `PositionView` and `MarketView` load persistent storage directly with `getLedgerEntries` and expose the client-side math ported from the contract. Both return `null` when the entry is absent.

```typescript
import { PositionView, MarketView } from '@zenith-protocols/zenex-sdk';

const market = await MarketView.load(network, TRADING_ADDRESS);
const view = await PositionView.load(network, TRADING_ADDRESS, user, true);

if (view && market) {
  const price = 60_000_00000000n; // exit price in price_scalar units
  const pnl = view.pnl(price);
  const equity = view.equity(market.data, price);
  const liqPrice = view.liquidationPrice(config, market.data);
  const unlocked = view.unlockedNotional(BigInt(Math.floor(Date.now() / 1000)));
}
```

`PositionView` exposes `pnl`, `pendingFunding`, `pendingBorrowing`, `equity`, `liquidationPrice`, and `unlockedNotional`. `MarketView` exposes `sidePnl`, `netPnl`, `utilization`, and `skewSplitFees`. The same math is available as free functions (`positionPnl`, `positionEquity`, `pendingFunding`, `pendingBorrowing`, `liquidationPrice`, `unlockedNotional`, `sidePnl`, `netPnl`, `utilization`, `skewSplitFees`) if you already hold the raw structs. `validateTradingConfig` mirrors the contract's config bounds for pre-flight checks.

## Decoding events

`decodeEvent` accepts an event from any of the three sources you might watch (Soroban RPC `getEvents`, Mercury, Goldsky) and returns a typed union across the trading, vault, and governance contracts.

```typescript
import { decodeEvent, ZenexContractType, TradingEventType } from '@zenith-protocols/zenex-sdk';

const decoded = decodeEvent(rawEvent);

if (decoded?.contractType === ZenexContractType.Trading
    && decoded.eventType === TradingEventType.IncreaseFill) {
  console.log(decoded.user, decoded.orderId, decoded.notional, decoded.baseFee);
}
```

To decode only trading events, call `decodeTradingEvent(normalizedEvent)` after normalizing with `normalizeRpc`, `normalizeMercury`, or `normalizeGoldsky`. The full catalog of 14 trading events, their topic layouts, and their fields is in [Indexing](./indexing).

## FactoryContract

```typescript
import { FactoryContract } from '@zenith-protocols/zenex-sdk';

const factory = new FactoryContract(FACTORY_ADDRESS);
```

| Method | Purpose |
|---|---|
| `deployMarket(admin, salt, token, priceVerifier, feedId, exponent, config, vaultName, vaultSymbol, vaultDecimalsOffset)` | Deploy a trading and strategy-vault pair atomically. Returns the trading address. |
| `isDeployed(tradingId)` | Whether an address was deployed by this factory. |

The factory deploys the vault first, then the trading contract, wiring the vault as the trading contract's collateral vault and the trading contract as the vault's immutable strategy. Both addresses derive from `admin` and the salts, so a salt alone cannot be front-run. The constructor takes a `FactoryInitMeta { trading_hash, vault_hash, treasury }` of compiled WASM hashes plus the treasury address. Config values are set per market by governance. Always review [`deploy.json`](/deployments/contract-addresses) before deploying.

## Parsing errors

`parseError` turns the raw error from a failed simulation, send, or get-transaction call into a typed `ContractError` carrying a numeric `type` and a human-readable `message`. Match on the code to render specific copy.

```typescript
import { parseError } from '@zenith-protocols/zenex-sdk';
import { rpc } from '@stellar/stellar-sdk';

const sim = await server.simulateTransaction(tx);
if (rpc.Api.isSimulationError(sim)) {
  const err = parseError(sim);
  showToast(err.message); // e.g. the trigger has not been crossed, or the fill price broke the bound
}
```

The trading contract's own error codes (for example `StalePrice`, `TriggerNotMet`, `PriceBoundExceeded`, `NotionalLocked`, `IncreaseHalted`) map to the numeric codes described in the protocol's error reference. Use `err.type` to branch on a specific failure and `err.message` for a fallback.
