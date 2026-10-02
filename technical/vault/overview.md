---
sidebar_position: 1
title: Strategy vault
---

# Strategy vault

This section covers `StrategyVaultContract`, the contract that holds the liquidity backing one market and issues shares against it. The liquidity is denominated in the settlement token, which [Units and scales](../units.md) defines. Shares are an OpenZeppelin fungible token, so any account can hold and transfer them.

The [factory deploy page](../factory/deploy.md) describes how the factory deploys the vault and its market together. The vault constructor registers the market as its strategy. A liquidity provider reaches the vault through the market's vault orders, described on [Vault orders](../market/vault-orders.md).

## Where each entry is documented

| Page | What it holds |
| --- | --- |
| [Constructor and share token](./share-token.md) | `__constructor` and its five arguments, the nine share token entries with the events they emit, the `query_asset` view, the share decimals rule, the storage keys with their time to live rules, the constants, and the errors of the `VaultTokenError` enum. |
| [Share pricing](./share-pricing.md) | `strategy_deposit`, `strategy_redeem`, `preview_deposit`, `preview_redeem`, the `total_assets` view, the `net_pnl` argument, the conversion formulas with their rounding, the `Deposit` and `Withdraw` events, and the errors of the `StrategyVaultError` enum that these calls raise. |
| [Strategy withdraw](./strategy-withdraw.md) | `strategy_withdraw`, the strategy authorization gate, the `get_strategy` view, the transfer to the strategy, its effect on the share price, the `StrategyWithdraw` event, and the errors it raises. |
