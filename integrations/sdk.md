---
sidebar_position: 4
title: SDK
---

# SDK

`@zenith-protocols/zenex-sdk` (v3) is the TypeScript SDK for Zenex v2. It has two layers:

- the **Market tier**: a loaded chain **snapshot** (`Market`, `MarketUser`, `MarketPosition`) with exact `bigint` math mirrored from the contracts, plus float **estimates** for display, **order intents** that build the exact parameters you sign, and a **preview** that runs the same fill engine the chain runs
- the **contract bindings**: 1:1 typed operation builders for every contract (market, market router, factory, oracle, treasury, vault, governance), each with matching return-value parsers

On top of both sit **typed event interfaces** for indexing and a single typed error, `ZenexError`, parsed out of any failed simulation or submission.

The SDK is exact-math and chain-only: every protocol amount is a `bigint`, the mirrored math matches the contracts bit for bit, estimates convert to `number` only at the display boundary, and nothing in the SDK fetches from anything but Stellar RPC — there is no backend dependency and no submit helper. The [Quickstart](./quickstart) walks the minimal flow end to end. This page is a flat reference for the parts an integrator touches.

## Install

```bash
npm install github:zenith-protocols/zenex-sdk-js#main @stellar/stellar-sdk
```

`@stellar/stellar-sdk` is a peer dependency and supplies transaction building, RPC, and key handling. The SDK ships ESM and CJS builds and works in Node.js, Bun, Deno, and browser bundlers.

## The Market tier: the estimate is the snapshot

Everything display-facing derives from one loaded snapshot. `Market.load` pulls a whole market in a single `getLedgerEntries` round trip (the market instance, the market data singleton, the vault instance, and the vault balance), verifies the wiring, and returns a plain object of exact fields. There is no cache and no subscription: refreshing is calling `load` again.

```typescript
import { Market, Price, estimateMarket } from '@zenith-protocols/zenex-sdk';

const network = { rpc: SOROBAN_RPC_URL, passphrase: NETWORK_PASSPHRASE };

const contracts = await Market.resolveContracts(network, MARKET_ID); // { market, vault, token }
const market = await Market.load(network, contracts);

// Estimates are a pure projection of the snapshot at a price.
const price = new Price(bid, ask, publishTime); // or Price.from(mid) for zero-spread
const view = estimateMarket(market, price);
```

| Loader | Returns |
|---|---|
| `Market.resolveContracts(network, marketId)` | The `{ market, vault, token }` contract triple, read from the market instance. |
| `Market.load(network, contracts)` | The `Market` snapshot: `config`, `data`, `adl`, `status`, `feedId`, the wired addresses, `vaultAssets`, `vaultShares`, `assetDecimals`, and more. |
| `Market.loadWithUser(network, contracts, user)` | `{ market, user }` in one round trip: the snapshot plus the user's two positions, order counter, and claimable credit. |
| `market.loadUser(user)` | A `MarketUser` against an already-loaded market. |
| `loadTreasuryRate(network, treasury)` | The live treasury rate; attach with `market.withTreasuryRate(rate)` for the exact fee split. |

`Market` also carries the exact mirrored math as methods returning `bigint`: `accrue(price)` (the snapshot advanced to now, mirroring the contract's on-load accrual), `utilization`, `openCapacity`, `sidePnl`, `netPnl`, `borrowingRate`, `fundingRate`, `adlState`, and the share conversions `assetsToShares` / `sharesToAssets`.

### Estimates (floats, display only)

`estimateMarket(market, price)` and `estimatePosition(market, position, price)` compute every figure with the exact mirrors and convert to `number` at that boundary only. The results are plain data: they serialize, spread into props, and survive a query cache. Never feed an estimate back into a transaction — parse user input with `parseAtomic` instead.

A `MarketEstimate` is self-describing: alongside the derived figures (`sharePrice`, per-side `SideRatesEstimate` with `utilizationPercent`, `borrowRatePercent1h`, `fundingRatePercent1h`, `netRatePercent1h`, open interest and capacity, `maxLeverage`, `longPnl` / `shortPnl` / `netPnl`, `maxRedeemableShares`) it carries the snapshot facts it was computed from: `vaultAssets`, `vaultSupply`, and a price echo (`bid`, `ask`, `publishTime`). A stored estimate therefore explains itself without the snapshot that produced it. All rates quote in **percent per hour**, matching how the contract's indices accrue; `formatAnnualPercent` exists for APR displays.

A `PositionEstimate` (from `estimatePosition` or `position.estimate(market, price)`) carries `notional`, `tokens`, `positionValue`, `margin`, `pnl`, `equity`, `pendingFunding`, `pendingBorrowing`, `leverage`, `entryPrice`, `liquidationPrice`, `healthFactor`, `liquidationDistancePercent`, `closeFee`, `netPnl`, `netPnlPercent`, `unlockedNotional`, and `maxWithdrawableMargin`.

Pass `market.accrue(price)` instead of `market` to either estimate for numbers advanced to the current moment rather than the snapshot's last accrual.

### Positions and users

`MarketPosition` wraps one stored position (`margin`, `notional`, `tokens`, the accrual indices, `lockedNotional`, `pricedAt`) with exact methods: `isOpen`, `pnl(price)`, `equity(market, price)`, `pendingFunding` / `pendingBorrowing`, `entryPrice`, `maintenanceMargin`, `liquidationPrice`, `isLiquidatable`, `unlockedNotional`, plus `estimate` and `preview`. `MarketPosition.from(row, isLong)` wraps a parsed storage row from your own indexer.

`MarketUser` holds `long` and `short` positions, the `orderCounter`, and `claimableCredit`. `user.loadOrders(network)` lists resting orders as a chain-only fallback (the official frontend lists open orders through the indexer).

### Order intents and the preview

`OrderIntent` builds the exact `OrderParams` you will sign; `previewOrder` then pre-flights that identical object through the exact fill engine — what you preview is what the chain would do. This catches what creation does not: the chain accepts orders that can never fill, such as a decrease that would break the margin gate.

```typescript
import { OrderIntent, previewOrder, parseAtomic, MarketContract } from '@zenith-protocols/zenex-sdk';

const intent = new OrderIntent(market, user, /* isLong */ true, /* ttlLedgers */ 60, /* slippageBps */ 100n);
const order = intent.openMarket({
  notional: parseAtomic('1000', market.assetDecimals),
  margin: parseAtomic('100', market.assetDecimals),
  price, // required whenever slippageBps is nonzero: the bound derives from it
});

const check = previewOrder(market, marketUser.long, order, price);
if (check.outcome === 'gate') throw check.gate; // a ZenexError, e.g. InsufficientMargin (713)
// 'rests' is legitimate: the order creates and waits for a keeper. 'fills' carries
// the projected fees, execution price, payout, and the resulting PositionEstimate.
```

| `OrderIntent` method | Builds |
|---|---|
| `openMarket({ notional, margin, price? })` | A `MarketIncrease` with no trigger. |
| `openLimit({ notional, margin, triggerPrice })` | A `LimitIncrease`: a long buys at or below the trigger, a short sells at or above it. |
| `closePosition(price?)` | A `MarketDecrease` with the `FULL_CLOSE` sentinel notional. |
| `decrease({ notional, margin, price? })` | A partial `MarketDecrease`, optionally withdrawing margin. |
| `addMargin(amount)` / `withdrawMargin(amount)` | Margin-only orders (notional `0n`). |
| `takeProfit({ triggerPrice, notional? })` | A full-close (or sized) `LimitDecrease`: fires when the price crosses the trigger favorably. |
| `stopLoss({ triggerPrice, notional? })` | A full-close (or sized) `StopDecrease`: fires when the price crosses the trigger adversely. |

An `OrderParams` maps 1:1 onto `create_order`: build the operation with `MarketContract`'s `createOrder`, or batch it with the router's `createOrderCall`. `VaultOrderIntent.create(market, user, kind, amount, slippageBps?, price?)` is the vault-order analogue — it derives `minOut` from the snapshot's share price, `expectedOut` / `fills` preview a fill, and `toOperation()` returns the signable `create_vault_order` operation directly.

Two standalone helpers: `orderPriceBound(price, isLong, kind, maxSlippageBps)` derives a bound by hand, and `maxMarginForBalance(market, isLong, balance, leverage, price)` sizes a "Max" button so the result round-trips through `parseAtomic`.

### Fixed-point utilities

`parseAtomic(text, decimals)` is the one correct path from user input to protocol amounts. The formatting family (`formatToken`, `formatPrice`, `formatPercent`, `formatHourlyPercent`, `formatAnnualPercent`, and friends) is exported flat and under the `FixedMath` namespace, along with `SCALAR_18`, checked `i128` arithmetic, and `BPS_DENOMINATOR`. `toFixed` is deprecated: a JavaScript number cannot represent every decimal exactly, so never use it for a value that goes into a transaction.

## Contract bindings

Builders return a base64 XDR `Operation` string ready to add to a transaction. They never make RPC calls and never sign. Wrap the result with `xdr.Operation.fromXDR(op, 'base64')` and add it to a `TransactionBuilder`. Every `i128` argument is a `bigint`. A signed price report is a `Buffer` or `Uint8Array` carrying the raw Data Streams envelope. Every class exposes `static parsers` (one per method, decoding the base64 return value) and the trader-side builders also come in `*Call` variants returning a router `Call`.

## MarketContract

```typescript
import { MarketContract } from '@zenith-protocols/zenex-sdk';

const market = new MarketContract(MARKET_ADDRESS);
```

One instance is one market. The class mirrors the contract trait 1:1; the higher-level flows live in the [Market tier](#the-market-tier-the-estimate-is-the-snapshot) above.

### Trader entry points (price-free, authed by the user)

| Method | Purpose |
|---|---|
| `createOrder(user, isLong, kind, notional, margin, triggerPrice, priceBound, expiration)` | Create an order for a keeper to fill. `kind` is one of the six `OrderKind` variants (market, limit, or stop, each as an increase or a decrease). Returns the order id. |
| `cancelOrder(user, id)` | Cancel a resting order the caller owns. |
| `createVaultOrder(user, kind, amount, minOut)` | Escrow a vault deposit or redeem for a keeper to fill. `kind` is `VaultOrderKind.Deposit` or `VaultOrderKind.Redeem`, `minOut` is the fill's floor (`0n` to opt out). Returns the vault order id, or `0` for a retired market's instant redeem. |
| `cancelVaultOrder(user, id)` | Cancel a pending vault order and refund the escrow. |
| `claimCredit(user)` | Pay out the user's accrued claimable credit balance. |

`notional` and `margin` are non-negative magnitudes in token decimals. `kind` sets their direction. `triggerPrice` and `priceBound` are in the feed's native price precision, and `0n` disables each. `expiration` is a ledger sequence, and the order stays fillable while the current ledger is at or below it. Every create escrows in the same transaction: an increase locks `margin` plus the config's flat `execFee`, a decrease locks the `execFee`, a deposit locks its assets, and a redeem locks its shares. `cancelOrder` and `cancelVaultOrder` return the refunded escrow. `FULL_CLOSE` (exported, equal to `i128::MAX`) is the full-close notional sentinel.

### Keeper entry points (permissionless, price-bearing)

| Method | Purpose |
|---|---|
| `executeOrder(keeper, user, id, price)` | Fill a resting order at a verified price. Returns the keeper payout. |
| `executeLiquidation(keeper, user, isLong, price)` | Force-close a position that has fallen below maintenance margin (or any position past a delisted market's deadline). |
| `updateAdlState(price)` | Recompute both sides' pending PnL and set or clear the ADL flags. |
| `executeAdl(keeper, user, isLong, amount, price)` | Deleverage a winning position on a flagged side. `amount` at or above the position's notional closes it in full, as does one whose remainder would fall below `minPositionNotional`. |
| `executeVaultOrder(keeper, user, id, price)` | Fill a pending vault deposit or redeem in full. |
| `accrue(price)` | Advance both the borrowing and funding indices to now under one clock. |

The `keeper` argument is only the reward recipient. It is not authenticated, and anyone may call these paths ([why](/keepers/why-permissionless)). Every one of them takes a price report: `executeOrder` and `executeVaultOrder` are verified against the oracle's strict fill window, the other four against its wider gap-closing window. The market contract picks the window per route, so a caller never selects it.

### Admin (owner only)

| Method | Purpose |
|---|---|
| `setConfig(config)` | Replace the global `MarketConfig`. A funding or borrowing parameter change needs a same-ledger `accrue`, else `MarketNotAccrued`. |
| `setStatus(status)` | Move through the status lifecycle (`Active`, `OnIce`, `Frozen`, `Delisted`, `Retired`). |
| `setTerminalPrice(price)` | Set or refresh the flat settlement price of a delisted market once its grace window has passed. |
| `upgrade(newWasmHash, operator)` | Replace the contract WASM in place, preserving storage. `operator` must be the owner. |

The Ownable surface (`getOwner`, `transferOwnership`, `acceptOwnership`, `renounceOwnership`) is also present, on this and every owned contract binding.

### Views

| Method | Returns |
|---|---|
| `getConfig()` | The global `MarketConfig`. |
| `getMarketData()` | The market singleton `MarketData` (per-side open interest, indices, funding rate, pool). |
| `getPosition(user, isLong)` | The netted `Position` for `(user, isLong)`, zeroed if none. |
| `getOrder(user, id)` / `getVaultOrder(user, id)` | The stored `Order` / `VaultOrder`. An absent row traps `OrderNotFound` / `VaultOrderNotFound` rather than returning empty. |
| `getOrderCounter(user)` | The user's next unallocated order id, shared by trade and vault orders. `1` means none yet. |
| `getStatus()` | The `Status` discriminant (`u32`). |
| `getAdl()` | The `AdlState` per-side flags. |
| `getClaimableCredit(user)` | The user's claimable credit balance. |
| `getToken()` / `getVault()` / `getTreasury()` / `getOracle()` | The wired contract addresses. |
| `getRetirement()` | `[terminalPrice, delistedAt]`, or `undefined` if never delisted. `terminalPrice` is `0` until one is set. |
| `getFeed()` | The immutable 32-byte price-stream anchor, as a `Buffer`. |

Reads are operation builders too: simulate them rather than submitting. See [Decoding view reads](#decoding-view-reads).

## MarketRouterContract

```typescript
import { MarketRouterContract, createOrderCall, OrderKind } from '@zenith-protocols/zenex-sdk';

const router = new MarketRouterContract(ROUTER_ADDRESS);
```

A stateless batching contract for keepers and integrators. Every entry point takes the same generic `Call[]`, and the create-and-fill flows fill `calls[0]`.

| Method | Purpose |
|---|---|
| `multicall(calls)` | Run `Call[]` in order. Any failure traps the whole batch (all or nothing). |
| `createAndFill(calls, user, keeper, price)` | Run the batch strictly, then fill `calls[0]` fill-or-kill. With `keeper = user` the reward round-trips to the trader. |
| `multicallWithFee(args)` / `createAndFillWithFee(args)` | The same flows, each collecting a relayer fee from `user` before the batch. |

The `try` variants (`multicallTry`, `createAndTryFill`, `createAndTryFillWithFee`) still exist for ABI compatibility but are deprecated in the SDK: prefer the strict flows, whose failure semantics are all-or-nothing.

Each entry point returns a `Vec<Val>`, one element per call. The create-and-fill flows append the fill payout, so `results[0]` is the created order id and the last element is the keeper payout.

The `_with_fee` builders take a single args object. The user's signature covers the prefix `(calls, feeToken, maxFeeAmount, feeExpiration)`, leaving `feeAmount`, `feeRecipient`, `keeper`, and `price` for the relay to fill in after signing. `feeAmount` of `0n` skips collection.

Types and helpers:

- `Call { contract, func, args }` where `args` is `xdr.ScVal[]`. `MarketRouterContract.buildCall(contract, func, args)` composes an arbitrary one, and `createOrderCall(params)` composes the `create_order` call that belongs at `calls[0]` — it takes the same `OrderParams` an `OrderIntent` produces.
- `parseCallOutcome` decodes a `try`-variant element into a `CallOutcome { ok, value, error }`, with `UNTYPED_FAILURE` (exported, `u32::MAX`) for a non-contract failure.

```typescript
const order = intent.openMarket({ notional, margin, price });
const atomicOpen = router.createAndFill([createOrderCall(order)], user, user, report);
```

## FactoryContract

```typescript
import { FactoryContract } from '@zenith-protocols/zenex-sdk';

const factory = new FactoryContract(FACTORY_ADDRESS);
```

| Method | Purpose |
|---|---|
| `deployMarket(admin, salt, token, oracle, feedId, config, vaultName, vaultSymbol, vaultDecimalsOffset)` | Deploy a market and strategy-vault pair atomically. Returns the `[market, vault]` address pair. |
| `isDeployed(marketId)` | Whether an address was deployed by this factory. |
| `getInitMeta()` / `setInitMeta(initMeta)` | Read or (owner-only) replace the `FactoryInitMeta { market_hash, vault_hash, treasury }` that future deploys install. |
| `upgrade(newWasmHash, operator)` | Owner-only WASM replacement for the factory itself. |

The factory deploys the vault first, then the market contract, wiring the vault as the market contract's collateral vault and the market contract as the vault's immutable strategy. Both addresses derive from `admin` and the salts, so a salt alone cannot be front-run. The `admin` argument becomes the new market contract's owner. `feedId` must be a 32-byte V3 stream id (its first two bytes `0x00 0x03`), else the market constructor traps `InvalidConfig`. Always review the [deployed addresses and parameters](/deployments/contract-addresses) before deploying.

## Other bindings

- **`OracleContract`**: `verifyPrice(report, feedId, protective = false)` plus the owner surface (`updateStaleness`, `updateSpreadReductionFactor`, `upgrade`) and the views `verifier`, `tradeStaleness`, `closeStaleness`, `spreadReductionFactor`.
- **`TreasuryContract`**: `setRate(rate)`, `withdraw(token, to, amount)`, `getRate()`.
- **`VaultContract`**: the SEP-41 share-token surface plus `totalAssets()`, `queryAsset()`, `getStrategy()`, and the previews `previewDeposit(assets, netPnl)` / `previewRedeem(shares, netPnl)`. The strategy-gated mutations exist on the binding but only the paired market contract can call them.
- **`GovernanceContract`**: `queue(target, fnName, args)`, `execute(nonce)`, `cancel(nonce)`, `setStatus(target, status)`, `setDelay(newDelay)`, `applyDelay()`, and the views `getDelay()` / `getQueued(nonce)`.

## Decoding view reads

Every builder ships a matching parser under its class's `parsers` (keyed by method name). A parser turns the base64 XDR return value into a typed object. Two helpers wire simulation to parsing:

- `simulateAndParse(network, operation, parser)` simulates a read and returns `{ result, latestLedger }`.
- `parseResult(response, parser)` parses the return value out of a simulation or a fetched transaction.

```typescript
import { simulateAndParse, MarketContract } from '@zenith-protocols/zenex-sdk';

const network = { rpc: SOROBAN_RPC_URL, passphrase: NETWORK_PASSPHRASE };

const { result: config } = await simulateAndParse(
  network, market.getConfig(), MarketContract.parsers.getConfig,
);
const { result: position } = await simulateAndParse(
  network, market.getPosition(user, true), MarketContract.parsers.getPosition,
);
```

Parsers decode into the SDK's typed mirrors: `Order`, `VaultOrder`, `Position`, `MarketData`, `AdlState`, and `MarketConfig`. Numeric keeper returns (`executeOrder`, `executeAdl`, `claimCredit`, and the like) parse to `bigint`. For bulk reads that skip simulation entirely, the ledger-key builders (`marketDataLedgerKey`, `marketPositionLedgerKey`, `marketOrderLedgerKey`, `tokenBalanceLedgerKey`, and friends) assemble your own `getLedgerEntries` key sets — which is exactly what `Market.load` does under the hood.

## Event types

The SDK ships the event shapes as types. `MarketEventType` enumerates the topic-0 symbols, and the `MarketEvent`, `VaultEvent`, `FactoryEvent`, and `GovernanceEvent` unions carry one interface per event, discriminated on `eventType` and tagged by `contractType` with `ZenexContractType`. The full catalog of 17 market events, their topic layouts, and their fields is in [Indexing](./indexing).

## Parsing errors

`parseError` turns the raw error from a failed simulation, send, or get-transaction call into a typed `ZenexError` carrying a numeric `code` (a `ZenexErrorCode`) and a canonical human-readable message. It never throws, so it is safe in any error path.

```typescript
import { parseError, ZenexErrorCode } from '@zenith-protocols/zenex-sdk';
import { rpc } from '@stellar/stellar-sdk';

const sim = await server.simulateTransaction(tx);
if (rpc.Api.isSimulationError(sim)) {
  const err = parseError(sim);
  if (err.code === ZenexErrorCode.TriggerNotMet) showToast('Trigger not crossed yet');
  else showToast(err.message);
}
```

`ZenexErrorCode` covers every domain in one flat enum: the Soroban host and transaction codes, the market's `7xx` range (`StalePrice`, `TriggerNotMet`, `PriceBoundExceeded`, `NotionalLocked`, `IncreaseHalted`, ...), the oracle, vault, treasury, and governance ranges, the shared `UpgradeNotOwner` (600), and negative SDK-side sentinels. The `@zenith-protocols/zenex-sdk/errors` subpath exports the same machinery for error-only consumers.
