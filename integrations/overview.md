---
title: Build with Zenex
sidebar_label: Start here
description: Choose a path for a trading interface, wallet, bot, or data integration.
slug: /
---

# Build with Zenex

Use these guides to read markets, build orders, connect wallets, and follow execution. Contract details live in the [technical reference](/technical).

## Choose your task

| I want to… | Start with |
| --- | --- |
| Read a market from Stellar | [Quickstart](./quickstart.md) |
| Build a trade ticket or vault deposit | [Use the SDK](./sdk.md) |
| Sign and submit directly | [Wallets and direct transactions](./agent-wallet.md) |
| Submit through the hosted relayer | [Relayed transactions](./relay.md) |
| Show prices, open orders, or history | [Public data API](./data-api.md) |
| Fetch execution prices or run a keeper | [Signed price reports](./price-feed.md) |
| Build my own event index | [Index events](./indexing.md) |

## Choose a submission path

| Path | Your application provides | Who pays the Stellar fee |
| --- | --- | --- |
| Direct transaction | RPC connection, transaction source, wallet envelope signature | Transaction source, in XLM |
| Hosted relay | User authorization entries and a signed fee cap | Relayer, with a token fee charged to the user |

The SDK builds operations and reads state. Your wallet integration signs. The router batches calls. The fee forwarder collects relay fees. The backend connects public data and relay services.

Use [Deployments](/deployments) for current addresses and settings. Keep the network, market contracts, and public API environment together.

:::info Order creation and execution are separate
An immediate-fill transaction creates and fills the market order together. A create-only transaction leaves it pending for execution.
:::
