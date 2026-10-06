---
title: Use the SDK
sidebar_label: State and order builders
description: Read current state, preserve atomic amounts, build order intents, and display estimates.
---

# Use the SDK

The SDK provides state readers, order builders, display estimates, and contract bindings. Start with [Quickstart](./quickstart) for installation and network setup. Examples reuse its `network`, `contracts`, and loaded `market`. Set `userId` to the owner's address.

:::info Browser bundles need a Buffer shim
This pinned SDK expects the `Buffer` global. Configure your bundler's shim before importing it, then test the built browser bundle.
:::

## Keep amounts exact

Use `bigint` for transaction amounts. Parse user input from decimal text.

```ts
import { parseAtomic, formatAtomic } from "@zenith-protocols/zenex-sdk";

const margin = parseAtomic("25", market.assetDecimals);
const notional = parseAtomic("100", market.assetDecimals);
console.log(formatAtomic(margin, market.assetDecimals));
```

| Value | Unit |
| --- | --- |
| Margin, notional, fees, payouts | Settlement-token atomic units |
| Vault deposit amount | Settlement-token atomic units |
| Vault redeem amount | Share atomic units |
| Prices and trigger prices | 18 decimal places |
| Rates | 18 decimal places |
| Slippage | Basis points, where 10,000 means 100% |
| Order expiration | Ledger sequence |
| Price observation and locks | Unix seconds |

Share decimals equal asset decimals plus `market.vaultDecimalsOffset`. Read both from the loaded market. `parseAtomic` rejects excess decimal places and scientific notation. It also rejects numeric input. Contracts validate the allowed amount for each action.

:::warning Estimates contain display numbers
Keep the original atomic values for signatures. Do not convert a floating-point estimate back into a transaction amount.
:::

## Load a user

Use the owner address for `userId`. A position belongs to one owner and side within one market.

```ts
const loaded = await Market.loadWithUser(network, contracts, userId);
const currentMarket = loaded.market;
const user = loaded.user;
console.log(user.long.isOpen(), user.short.isOpen());
console.log(formatAtomic(user.claimableCredit, currentMarket.assetDecimals));
```

`Market.loadWithUser` reads the market and user in one RPC request. Pair their state when you calculate estimates.

| Need | Use |
| --- | --- |
| Market state | `Market.load` |
| Market wiring | `Market.resolveContracts` |
| User positions and credit | `Market.loadWithUser` or `market.loadUser` |
| Recent pending orders from chain | `user.loadOrders` |
| Complete open-order lists and history | [Public data API](./data-api) |
| Credit payable from the current pool | `user.claimable` |

`user.loadOrders` probes recent order IDs. Its default window is 50 IDs and its maximum is 90. Older pending orders need another discovery method.

State failures use `MarketStateError`. Its `code` is `INVALID_INPUT`, `MISSING_STATE`, or `IDENTITY_MISMATCH`. Keep RPC transport errors separate.

:::warning Missing state needs context
The reader can represent an omitted position as flat. Archived storage can also be omitted by RPC. Restore known archived entries before treating absence as a closed position.
:::

## Build and preview an order

Use the loaded market to choose the expiration and fee settings. Supply an effective bid and ask from [the price guide](./price-feed).

```ts
import { OrderIntent, createOrderCall } from "@zenith-protocols/zenex-sdk";

const intent = new OrderIntent(currentMarket, user.userId, true, 60, 50n);
const order = intent.openMarket({
  margin: parseAtomic("25", currentMarket.assetDecimals),
  notional: parseAtomic("100", currentMarket.assetDecimals),
  price,
});
const estimate = user.long.preview(currentMarket, order, price);
const call = createOrderCall(order);
```

This example selects a long, a lifetime of 60 ledgers, and a price bound of 50 basis points. These are example choices.

| Intent method | Purpose |
| --- | --- |
| `openMarket` | Open or increase at market |
| `openLimit` | Open or increase at a trigger price |
| `closePosition` | Close the full side |
| `decrease` | Reduce size and optionally withdraw margin |
| `addMargin` | Add margin without changing size |
| `withdrawMargin` | Withdraw margin without changing size |
| `takeProfit` | Decrease at a favorable trigger |
| `stopLoss` | Decrease at an adverse trigger |

`OrderParams` contains `market`, `user`, `isLong`, `kind`, `notional`, `margin`, `triggerPrice`, `priceBound`, and `expiration`.

The preview returns `outcome` as `fills`, `rests`, or `gate`. Show its `reason` or `gate` before signing. The preview does not reserve liquidity or guarantee execution. Use `MarketPosition.estimate` for a position display and `Market.estimate` for market totals. Accrue the snapshot with `market.accrue` for elapsed funding and borrowing. Attach `loadTreasuryRate` through `market.withTreasuryRate` when a preview needs the exact treasury fee split.

:::warning Set a price bound deliberately
The default `slippageBps` is zero, which produces an unbounded price. A positive bound needs a price when the builder derives it.
:::

## Build a vault order

`VaultOrderIntent` creates a deposit or redeem operation. A deposit spends assets and returns shares. A redeem spends shares and returns assets.

```ts
import { VaultOrderIntent, VaultOrderKind } from "@zenith-protocols/zenex-sdk";

const deposit = VaultOrderIntent.create(
  currentMarket, user.userId, VaultOrderKind.Deposit,
  parseAtomic("25", currentMarket.assetDecimals), 50n, price,
);
const quotedShares = deposit.expectedOut(currentMarket, price);
const operation = deposit.toOperation();
```

`expectedOut` returns the quote after the vault fee. `fills` predicts a fill, a rejection, or a gate that leaves the order pending. For execution rules, read [vault orders](/technical/market/vault-orders).

:::warning A minimum output can reject a vault order
A keeper attempt below `minOut` removes the order and returns its principal. The keeper receives its execution fee.
:::

## Use contract bindings when needed

Each binding method returns a base64 XDR operation. It does not sign or submit. Use the matching static `parsers` method to decode its return. For a read method, pass its operation and parser to `simulateAndParse`. For a wallet write, use the [transaction guide](./agent-wallet).

Find complete entrypoints, authorization, and errors in the [technical reference](/technical). The SDK's public TypeScript types provide the callable interface.
