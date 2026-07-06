---
sidebar_position: 2
title: Supported Assets
---

# Supported Assets

Zenex does not keep a list of assets inside a single shared contract. Instead, each asset is its own market: a dedicated trading contract paired with its own strategy vault, deployed together by the [factory](../governance/overview.md). The set of supported assets is therefore the set of deployed pairs, and it grows by deploying new ones rather than by editing an entry in a central registry.

## How an Asset Becomes a Market

To list a new asset, the factory deploys a fresh trading and vault pair for a chosen **oracle price feed**. The feed is a Pyth Lazer `feed_id` with a fixed price `exponent`, and both are immutable for the life of the market. Whoever deploys the pair also picks its **settlement token**: the token used as collateral and for every fee and PnL figure in that market. A market that settles in USDC takes USDC as collateral, denominates positions in USDC, and pays out in USDC.

Each new market ships with its own [Config](./market-parameters.md), set at deployment and adjustable afterward by that market's owner through [governance](../governance/parameter-changes.md). Because markets are isolated contracts, one market's parameters and liquidity never affect another.

## Currently Available Markets

The initial Zenex deployment lists markets for **XLM**, **BTC**, and **ETH**, each settled in USDC. Every market has parameters tuned to the asset's liquidity and volatility profile, set per market by governance. See [Market Parameters](./market-parameters.md) for what those parameters control, and read a market's contract directly for its live values.

Because deployment is permissionless through the factory, other operators can list additional assets by deploying their own trading and vault pairs. Those external markets choose their own oracle feeds, settlement tokens, owners, and configurations.
