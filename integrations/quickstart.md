---
title: Read your first market
sidebar_label: Quickstart
description: Install a pinned SDK build and read a Zenex market without signing or sending a transaction.
---

# Read your first market

This example reads a market from Stellar mainnet. It sends no transaction and needs no wallet.

## Install the SDK

Use Node.js 22 or later. These examples target a fixed SDK commit and Stellar SDK 16.

```bash
npm install @stellar/stellar-sdk@16.2.0 "git+https://github.com/zenith-protocols/zenex-sdk-js.git#45f4d818af455528c850b16269ec5015440f3148"
npm install --save-dev tsx
```

The Git dependency builds during installation. Keep the lockfile. Check the [SDK repository](https://github.com/zenith-protocols/zenex-sdk-js) before you change the pin.

:::info Package distribution
Use the Git dependency above for this guide. The package name in imports is `@zenith-protocols/zenex-sdk`.
:::

## Select the network

Set `STELLAR_RPC_URL` to a mainnet RPC endpoint you can use. The public configuration selects the market. The RPC supplies its state.

```ts
import { Networks, rpc } from "@stellar/stellar-sdk";
import { Market, type Network } from "@zenith-protocols/zenex-sdk";

const rpcUrl = process.env.STELLAR_RPC_URL;
if (!rpcUrl) throw new Error("Set STELLAR_RPC_URL to a mainnet RPC endpoint");
const network: Network = { rpc: rpcUrl, passphrase: Networks.PUBLIC };
const server = new rpc.Server(network.rpc);
if ((await server.getNetwork()).passphrase !== network.passphrase) {
  throw new Error("RPC network does not match the selected deployment");
}
```

:::warning Keep network settings together
A mainnet address with a testnet RPC is a different integration. Verify the RPC passphrase before reads or signatures.
:::

## Load a market

Add this below the network setup:

```ts
type MarketConfig = { id: string; trading: string };
const response = await fetch("https://api.zenex.trade/v1/config");
if (!response.ok) throw new Error("Public configuration is unavailable");
const config = await response.json() as { markets: MarketConfig[] };
const selected = config.markets[0];
if (!selected) throw new Error("The configuration contains no markets");
const contracts = await Market.resolveContracts(network, selected.trading);
const market = await Market.load(network, contracts);
console.log({ market: selected.id, ledger: market.ledger, status: market.status });
```

Save both snippets in `read-market.mts`. Run `npx tsx read-market.mts`. The printed ledger identifies the read. Re-run `Market.load` to refresh.

`Market.resolveContracts` reads the vault and settlement token from the market itself. `Market.load` checks that wiring before it returns state. For current addresses and code hashes, consult [Deployments](/deployments).

## Next step

Use [the SDK guide](./sdk) to load a user and construct an order. Then choose [direct transactions](./agent-wallet) or [the hosted relay](./relay).
