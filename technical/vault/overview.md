---
sidebar_position: 1
title: Strategy vault
description: Find strategy-vault references for share tokens, conversion pricing, and market payout draws.
---

# Strategy vault

`StrategyVaultContract` holds liquidity for one market and issues transferable shares. Its constructor fixes the paired market as its strategy. Only that market can authorize strategy deposits, redemptions, and payout draws; shareholders can transfer shares without gaining strategy authority.

## Where each entry is documented

| Page | What it holds |
| --- | --- |
| [Constructor and share token](./share-token.md) | Constructor bindings, token entries, share decimals, storage, and token errors. |
| [Share pricing](./share-pricing.md) | Deposits, redemptions, previews, the `net_pnl` mark, conversion formulas, and receipts. |
| [Strategy withdraw](./strategy-withdraw.md) | Strategy authorization, market payout draws, and their effect on share backing. |

Liquidity providers act through the market's [vault orders](../market/vault-orders.md). The [factory](../factory/overview.md) deploys both contracts together.
