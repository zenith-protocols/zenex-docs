---
sidebar_position: 2
title: Supported Assets
---

# Supported Assets

Each asset on Zenex is its own market: a dedicated trading contract paired with its own strategy vault, deployed together by the [factory](../governance/overview.md). The set of supported assets is the set of deployed pairs, and it grows by deploying new ones rather than by editing an entry in a central registry.

## How an Asset Becomes a Market

To list a new asset, the factory deploys a fresh trading and vault pair for a chosen **oracle price feed**. The feed is a Pyth Lazer `feed_id` with a fixed price `exponent`, and both are immutable for the life of the market. Whoever deploys the pair also picks its **settlement token**: the token used as collateral and for every fee and PnL figure in that market. A market that settles in USDC takes USDC as collateral, denominates positions in USDC, and pays out in USDC.

Each new market ships with its own [Config](./market-parameters.md), set at deployment and adjustable afterward by that market's owner through the [parameter-change process](../governance/parameter-changes.md). Because markets are isolated contracts, one market's parameters and liquidity never affect another.

## Currently Available Markets

The initial Zenex deployment lists markets for **XLM**, **BTC**, and **ETH**, each settled in USDC.

| Market | Oracle feed (Pyth Lazer) | Vault share token |
|---|---|---|
| XLM | feed 23, exponent -8 | vXLMUSDC |
| BTC | feed 1, exponent -8 | vBTCUSDC |
| ETH | feed 2, exponent -8 | vETHUSDC |

Because deployment is permissionless through the factory, other operators can list additional assets by deploying their own trading and vault pairs. Those external markets choose their own oracle feeds, settlement tokens, owners, and configurations.

## Testnet Market Parameters

All three markets launch on testnet with the same starting configuration. Every value below is a per-market parameter and can change through the [parameter-change process](../governance/parameter-changes.md), so the market's contract is always the source of truth. See [Market Parameters](./market-parameters.md) for what each one controls.

| Parameter | Value |
|---|---|
| Maximum leverage | 100x (1% initial margin) |
| Maintenance margin | 0.75% of notional |
| Liquidation fee rate | 0.5% of notional |
| Trade fee | 0.06% on the imbalance-worsening side, 0.04% on the improving side |
| Impact fee divisor | 1,000 |
| Keeper share of fees | 10% |
| Position size | 20 to 1,000,000 USDC notional |
| Per-side open interest cap | 10,000,000 USDC |
| Minimum order | 2 USDC notional and 2 USDC collateral |
| Fresh-size decrease lock | 30 seconds |
| Utilization caps | 80% for opens, 90% for vault withdrawals |
| Borrowing interest | about 2.5% per year at the 50% target utilization, rising to about 15% per year at full utilization |
| Funding rate cap | about 25% per year in either direction |
| ADL thresholds | arms at 50% of half the vault balance, deleverages back to 40% |
| Profit-haircut threshold | 90% on the same measure |
| Vault fill fee | 0.1% |
| Minimum vault deposit | 10 USDC |
| Redeem cooldown | 60 seconds |
| Withdraw PnL gate | 15% |
| Vault balance cap | 10,000,000 USDC |
| Order execution fee | flat per-order keeper fee, read from the market's contract |

One fee parameter lives outside the per-market table. The treasury's share of protocol fees is a single protocol-wide rate stored on the treasury contract shared by every market deployed through the factory, and that contract is the source of truth for its current value.
