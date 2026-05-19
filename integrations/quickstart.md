---
sidebar_position: 2
title: Quickstart
---

# Quickstart

The fastest path to taking a fee on Zenex perpetuals from your own application. You will install the SDK, deploy a trading wrapper, place a first market order against it, and read position state back from the chain.

## 1. Install the SDK

```bash
npm install @zenith-protocols/zenex-sdk
```

## 2. Deploy your wrapper

:::info Use the wrapper only for open, limit, and close
The wrapper exposes exactly three methods: **`openMarket`**, **`placeLimit`**, and **`closePosition`**. Those are the fee-charging entry points. Any other call routed at the wrapper address will fail. Send `cancelPosition`, `modifyCollateral`, `setTriggers`, all reads, and funding application straight to the trading contract.
:::

The wrapper is a small Soroban contract that charges a fee on every open, limit, and close that runs through it. The reference implementation lives at [`zenex-wrapper`](https://github.com/zenith-protocols/zenex-wrapper); build the WASM yourself or use the published hash. Deploy a new instance with your own constructor args:

```bash
stellar contract deploy \
  --source-account <YOUR_KEY> \
  --network testnet \
  --wasm-hash <ZENEX_WRAPPER_WASM_HASH> \
  -- \
  --admin <YOUR_ADMIN_ADDRESS> \
  --trading <ZENEX_TRADING_ADDRESS> \
  --fee_recipient <YOUR_FEE_RECIPIENT_ADDRESS> \
  --fee_rate 10000
```

`fee_rate` is in `SCALAR_7` units, capped at `1_000_000` (`10%`). The published WASM hash and the trading contract address are in [Contract Addresses](/deployments/contract-addresses).

For richer behavior (tiered rates, referral splits, custom routing), fork [`zenex-wrapper`](https://github.com/zenith-protocols/zenex-wrapper), build your own WASM, and deploy that instead.

## 3. Place a first trade

Trade calls require a signed Pyth Lazer price payload, and the contract rejects the call if the payload's timestamp is outside its staleness window. Signing is rarely instant: a traditional wallet may prompt the user for a password, a hardware key for a button press, a passkey for biometrics. Any payload baked in *before* that prompt risks going stale by the time the tx hits the network. The trading contract works around this by scoping user authorization with `require_auth_for_args` and **excluding the price arg from the auth scope**, so you can swap in a fresher payload *after* the user signs without invalidating their auth.

:::warning Requires a relayer
The post-sign swap invalidates the **envelope** signature, so a relayer (your backend, OpenZeppelin Relayer, etc.) has to re-sign and submit the tx with its own funded source account. The user's auth-entry signatures still hold across the swap. The user can sign the envelope too if they want (the relayer just discards that signature). If you submit via the user's wallet directly with no relayer in the path, skip the swap and fetch the freshest price possible *before* signing.
:::

```typescript
import { TradingContract } from '@zenith-protocols/zenex-sdk';
import { Transaction, xdr } from '@stellar/stellar-sdk';

const wrapper = new TradingContract(WRAPPER_ADDRESS);

// Replace the trailing `Bytes` arg (the Pyth price blob) in the
// invokeHostFunction op. Auth entries stay valid because the contract
// excludes `price` from `require_auth_for_args`.
function swapLastBlobArg(tx: Transaction, fresh: Uint8Array): Transaction {
  const env = tx.toEnvelope();
  for (const op of env.v1().tx().operations()) {
    if (op.body().switch().name !== 'invokeHostFunction') continue;
    const inv = op.body().invokeHostFunctionOp().hostFunction().invokeContract();
    const args = inv.args();
    if (args.length === 0 || args[args.length - 1].switch().name !== 'scvBytes') break;
    args[args.length - 1] = xdr.ScVal.scvBytes(Buffer.from(fresh));
    inv.args(args);
    break;
  }
  return new Transaction(env.toXDR('base64'), tx.networkPassphrase);
}

// 1. Build the op with the current price. This blob is what the user
//    simulates and authorizes against.
const initial = await fetchPriceBlob(feedId);
const op = wrapper.openMarket({
  user: userPublicKey,
  market_id: 1,
  collateral: 1000_0000000n,
  notional_size: 10_000_0000000n,
  is_long: true,
  take_profit: 0n,
  stop_loss: 0n,
  price: initial,
});

// 2. Build, simulate, assemble.
const tx = await prepareSorobanTx(op);

// 3. User signs.
const signedTx = await sign(tx);

// 4. Right before submit, swap in a fresher blob.
const fresh = await fetchPriceBlob(feedId);
const finalTx = swapLastBlobArg(signedTx, fresh);

// 5. Submit.
await submit(finalTx);
```

`fetchPriceBlob` is a one-liner over Pyth Lazer's REST API or your own backend proxy. `sign` is whatever wallet adapter you already use. `submit` hands the tx to a relayer that re-signs the envelope and broadcasts. A full reference implementation of all three lives in the [zenex-trade repo](https://github.com/zenith-protocols/zenex-trade).

The user's wallet pays the protocol's collateral plus your integrator fee. The fee is forwarded directly to the address you set as `fee_recipient`. There is no withdraw step.

## 4. Load position data

Once a position is open, you can read it directly from the chain to render it. The SDK ships static loaders for the trading config, market state, and individual positions. Pass them into `Position` helpers to compute liquidation price, equity, and PnL on the fly.

```typescript
import { TradingConfig, Market, Position } from '@zenith-protocols/zenex-sdk';

const network = {
  rpc: 'https://soroban-testnet.stellar.org',
  passphrase: 'Test SDF Network ; September 2015',
};

const PRICE_DECIMALS = 8; // Pyth Lazer feed exponent magnitude

const tradingConfig = await TradingConfig.load(network, TRADING_ADDRESS);
const market        = await Market.load(network, TRADING_ADDRESS, marketId);
const position      = await Position.load(
  network,
  TRADING_ADDRESS,
  userPublicKey,
  positionId,
  PRICE_DECIMALS,
);

if (!position || !market) throw new Error('position or market not found');

const liquidationPrice = position.getLiquidationPrice(market, tradingConfig.config);
const breakdown        = position.getBreakdown(currentPrice, market, tradingConfig.config);

console.log({
  entry: position.entryPrice,
  notional: position.notional,
  collateral: position.col,
  liquidationPrice,
  equity: breakdown.equity,
  netPnl: breakdown.netPnl,
  returnPct: breakdown.returnPct,
});
```

`TradingConfig.load` and `Market.load` read instance and persistent storage on the trading contract directly. No signed transaction or simulation is needed. `Position.load` returns `null` if the position has been closed or liquidated. `currentPrice` is the latest mark for the market's feed; pull it from your price feed (or the hosted backend) at display time.

For a list view, use `Position.loadMultiple` with the position IDs from `Position.loadUserCounter` (or from your indexer) to batch every position into a single RPC call.

## What's next

- [Price feed](./price-feed) for setting up a Pyth Lazer proxy that keeps your API token off the client.
- [SDK](./sdk) for every operation builder, event decoder, and helper the SDK exposes.
