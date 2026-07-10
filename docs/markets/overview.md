---
sidebar_position: 1
title: Overview
---

# Markets Overview

A **market** on Zenex is a single leveraged trading pair, for example BTC or XLM, priced in the market's settlement token. If that token is USDC, then every position, fee, and PnL figure in the market is denominated and settled in USDC.

In Zenex each market is its **own** trading contract, paired with its **own** strategy vault. To add a market, the [factory](../governance/overview.md) deploys a fresh trading contract and vault together as an isolated pair, so the contract address itself is the market rather than an identifier selecting a pair inside a shared registry. That isolation is deliberate: the risk of one market never touches the liquidity of another.

### Oracle Price Feed

Each market is bound to a single **oracle price feed** at deployment. The feed is identified by a Pyth Lazer `feed_id` and a price `exponent`, and both are **immutable** for the life of the contract. Keepers submit signed Pyth Lazer price updates, which the contract's price verifier checks against these fixed anchors before any fill, liquidation, or borrowing accrual runs. The one exception is a delisted market with a terminal settlement price in place, described under Market Lifecycle below. The feed cannot be swapped after deployment, so a market always prices the asset it was created for.

### Per-Market Configuration

Every market carries its own **Config**: the fees, margin requirements, leverage cap, utilization caps, and the borrowing and funding curves that govern its behavior. Each value is a per-market parameter, tuned to the liquidity and volatility of the underlying asset, and can be adjusted over time through the protocol's [parameter-change process](../governance/parameter-changes.md). See [Market Parameters](./market-parameters.md) for the full list of what is configurable.

### Open Interest and Balance

Each market tracks **open interest**, the total size of open positions, separately for longs and shorts. This long/short split drives both the [funding rate](../trading/funding-rate.md) and the [borrowing interest](../trading/borrowing-interest.md). When one side dominates, funding shifts to reward the lighter side and pull the book back toward balance, while borrowing interest rises with utilization to compensate the vault for the liquidity that open positions reserve.

### Market Lifecycle

A market moves through a small set of operational states:

- **Active**: normal trading. This is the only state that accepts new position openings.
- **OnIce**: openings are paused, but everything else keeps working. Traders can still close, reduce, add or remove collateral, place vault orders, and claim funding.
- **Frozen**: an emergency halt. Fills and liquidations, new orders, funding claims, and vault-order cancels all stop until the market is unfrozen. You can still cancel a resting trade order and recover its escrowed funds.
- **Delisted**: a wind-down. Openings stop. For a short grace window the delist can be reversed. After the window, a flat terminal settlement price can be set and refreshed over time. From the moment one is set, every close and accrual in the market prices at that value instead of the oracle. Once a 7-day force-close deadline passes, keepers may close any remaining position regardless of its health, at the terminal price if one has been set or at the verified oracle price otherwise.
- **Retired**: the market is defunct and final. Traders can still claim funding, cancel pending orders and vault orders (recovering any escrowed assets), and redeem vault shares directly.

For how these transitions are triggered and what each one does, see [Governance Overview](../governance/overview.md).

### Adding New Markets

New markets are created by deploying a new trading and vault pair through the factory. Because each market is a standalone contract with its own owner and its own configuration, the set of available markets grows by deployment rather than by editing a list inside one shared contract. See [Supported Assets](./supported-assets.md) for how markets are listed and which assets are currently available.
