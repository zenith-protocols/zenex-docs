---
sidebar_position: 4
title: SDK
---

# SDK

[`@zenith-protocols/zenex-sdk`](https://www.npmjs.com/package/@zenith-protocols/zenex-sdk) is the JavaScript SDK for Zenex. It exposes:

- typed **operation builders** for the trading contract, the wrapper, and the strategy vault
- **state loaders** for trading config, market state, and individual positions, plus computed properties for liquidation price, equity, and PnL
- a unified **event decoder**
- **error parsing** that turns simulation/send failures into typed `ContractError` instances

The [Quickstart](./quickstart) walks the minimal flow end to end. This page is a flat reference for the parts an integrator actually touches. The rest of the package (price verifier, treasury, factory, governance, smart account) is deploy-time or admin tooling and is documented in the [package README](https://github.com/zenith-protocols/zenex-sdk-js).

## Install

```bash
npm install @zenith-protocols/zenex-sdk
```

`@stellar/stellar-sdk` is a peer dependency and supplies transaction building, RPC, and key handling. The SDK ships ESM and CJS builds and works in Node.js, Bun, Deno, and browser bundlers.

## Operation builders

Builders return base64-encoded XDR `Operation` strings ready to add to a transaction. They never make RPC calls and never sign. Wrap the result in `xdr.Operation.fromXDR(op, 'base64')` and add it to a `TransactionBuilder`.

### TradingContract

```typescript
import { TradingContract } from '@zenith-protocols/zenex-sdk';

const wrapper = new TradingContract(WRAPPER_ADDRESS);
const trading = new TradingContract(TRADING_ADDRESS);
```

Use the wrapper for the three fee-charging methods. Send everything else straight to the trading contract; routing reads or modifications through the wrapper will fail.

| Method | Target | Purpose |
|---|---|---|
| `openMarket(args)` | wrapper | Open a market order. `args.price` is a signed Pyth Lazer payload. |
| `placeLimit(args)` | wrapper | Place a limit order. No price arg; a keeper fills it. |
| `closePosition(user, id, price)` | wrapper | Close a filled position. |
| `cancelPosition(user, id)` | trading | Cancel an unfilled limit, or clean up a filled position whose market was deleted. |
| `modifyCollateral(args)` | trading | Add or remove collateral on a filled position. |
| `setTriggers(args)` | trading | Update take-profit / stop-loss on a filled position. |
| `applyFunding()` | trading | Permissionless funding tick. Any account can call it. |
| `updateStatus(price)` | trading | Permissionless circuit-breaker poke. |
| `execute(caller, marketId, users, ids, price)` | trading | Keeper batch-fill / batch-liquidate entry point. |
| `getPosition(user, id)` | trading | Read a single position. |
| `getUserCounter(user)` | trading | Number of positions ever created by a user. |
| `getMarketConfig(id)` / `getMarketData(id)` | trading | Market state lookups. |
| `getMarkets()` | trading | List of active market IDs. |
| `getConfig()` / `getStatus()` | trading | Top-level instance state. |
| `getVault()` / `getPriceVerifier()` / `getToken()` / `getTreasury()` | trading | Address lookups. |

Reads are operation builders too: simulate them rather than submitting. Submission requires no user signature.

### VaultContract

```typescript
import { VaultContract } from '@zenith-protocols/zenex-sdk';

const vault = new VaultContract(VAULT_ADDRESS);
```

The vault implements the SEP-41 token interface (the share token) plus a SEP-4626-style deposit/redeem surface for the strategy assets.

| Method | Purpose |
|---|---|
| `deposit(caller, assets, receiver)` | Deposit assets, mint shares to `receiver`. |
| `mint(caller, shares, receiver)` | Mint exactly `shares`, pulling whatever assets that costs from `caller`. |
| `withdraw(caller, assets, receiver, owner)` | Burn shares to withdraw exactly `assets`. |
| `redeem(caller, shares, receiver, owner)` | Burn exactly `shares` and receive their proportional assets. |
| `previewDeposit/Mint/Withdraw/Redeem(...)` | Pure conversion preview. No state change. |
| `maxDeposit/Mint/Withdraw/Redeem(account)` | Per-account caps (lock-time, available shares, etc.). |
| `convertToShares(assets)` / `convertToAssets(shares)` | Round-trip conversion at the current exchange rate. |
| `totalAssets()` / `totalSupply()` | Vault aggregates. |
| `balance(account)` / `allowance(owner, spender)` | SEP-41 reads. |
| `transfer / transferFrom / approve` | SEP-41 writes on the share token. |
| `availableShares(user)` / `lockTime()` | Withdrawal-cooldown helpers. |
| `name()` / `symbol()` / `decimals()` / `queryAsset()` | SEP-41 metadata + the underlying asset address. |

## Position state

Three loader classes pull on-chain state via `getLedgerEntries` and decode it into typed objects. None of them require a signed transaction or a simulation.

```typescript
import { TradingConfig, Market, Position } from '@zenith-protocols/zenex-sdk';

const network = { rpc: SOROBAN_RPC_URL, passphrase: NETWORK_PASSPHRASE };

const config = await TradingConfig.load(network, TRADING_ADDRESS);
const market = await Market.load(network, TRADING_ADDRESS, marketId);
const position = await Position.load(network, TRADING_ADDRESS, user, positionId, 8);
```

| Loader | Returns |
|---|---|
| `TradingConfig.load(network, contract)` | Instance state: status, vault/token/treasury/priceVerifier addresses, fee/funding/borrow params, position counter, totals, market IDs. |
| `Market.load(network, contract, marketId)` / `Market.loadMultiple(network, contract, ids)` | Per-market config + dynamic state (open notional per side, funding/borrowing/ADL indices, last-update timestamp). |
| `Position.load(network, contract, user, id, priceDecimals)` / `Position.loadMultiple(...)` | Decoded position with descaled price/notional/collateral. Returns `null` if closed or liquidated. |
| `Position.loadUserCounter(network, contract, user)` | Highest position ID ever created by `user`. Combine with `loadMultiple` to fetch every position in one RPC call. |
| `Position.loadRaw(...)` / `Position.loadMultipleRaw(...)` | Same as above but preserves `bigint` fidelity for indexers and reconcilers. |

The fifth arg to `Position.load` is the feed exponent magnitude. Pyth Lazer feeds use `8`.

### Computed properties on `Position`

Once loaded, the `Position` instance exposes pure functions that compute display values from the position state, current market state, and the trading config. Pass the same `Market` and `TradingConfig.config` you loaded above.

| Method | Returns |
|---|---|
| `getDirection()` | `'long'` / `'short'`. |
| `isOpen()` | True if filled and not yet closed. |
| `getFeeBreakdown(market, tradingConfig)` | `{ baseFee, priceImpact, funding, borrowingFee, total }`, in token units. |
| `calculatePnL(currentPrice, market?, tradingConfig?)` | `{ pnl, fee, netPnl }`. Drops the fee components if `market` is omitted. |
| `getBreakdown(currentPrice, market, tradingConfig)` | Full display breakdown: `pnl`, fee components, `equity`, `netPnl`, `returnPct`. Mirrors the contract's `settle()` math. |
| `getLiquidationPrice(market, tradingConfig)` | Mark price at which `equity <= liq_fee × notional`. Computed in fixed-point to match the contract. |

### Order validation and fee-adjusted collateral

Both are static helpers on the `Position` class for use *before* you build the trade.

| Method | Purpose |
|---|---|
| `Position.validateOrder(params)` | Returns `null` if the order is valid, or an `OrderValidationError` enum value if it would be rejected on-chain (notional below/above bounds, leverage too high, market disabled, invalid TP/SL). |
| `Position.grossCollateral(params)` | Given a desired *post-fee* collateral, returns the gross collateral to send and the estimated opening fee. Useful for "I want exactly $X of working margin" UX. |

## Decoding events

`decodeEvent` accepts events from any of the three sources you might watch (Soroban RPC `getEvents`, Mercury, Goldsky) and returns a typed event matching the contract's schema.

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

`ZenexContractType.Trading`, `ZenexContractType.Vault`, and `ZenexContractType.Governance` are decoded out of the box. Wrapper-emitted events (`IntegratorFeeCharged`, `CloseFeeCharged`, `FeeRateUpdated`) are not yet covered; decode them with `scValToNative` from `@stellar/stellar-sdk`, or watch inbound transfers to your fee recipient.

## Parsing errors

`parseError` turns the raw error response from a failed simulation, send, or get-transaction call into a typed `ContractError`. The error type maps to the contract's enum so you can render specific copy for known failures.

```typescript
import { parseError, ContractErrorType, simulateAndParse } from '@zenith-protocols/zenex-sdk';

const sim = await server.simulateTransaction(tx);
if (rpc.Api.isSimulationError(sim)) {
  const err = parseError(sim);
  if (err.type === ContractErrorType.NotionalAboveMaximum) {
    showToast('Position size exceeds the market cap.');
  } else {
    showToast(err.message);
  }
}
```

`ContractErrorType` covers every numeric error code the trading contract emits (`MarketDisabled`, `LeverageAboveMaximum`, `NotionalBelowMinimum`, etc.); see [`errors.ts`](https://github.com/zenith-protocols/zenex-sdk-js/blob/main/src/errors.ts) for the full enum. `parseResult` is the success-path counterpart for read-only simulations: pass it the simulation response and a parser callback.
