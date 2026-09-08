---
sidebar_position: 1
title: Strategy vault
---

# Strategy vault

`StrategyVaultContract` holds the liquidity that backs one market. The liquidity is denominated in the market's settlement token. The vault issues shares against that liquidity as an OpenZeppelin fungible token. The factory deploys the vault and its market together. The vault registers the market as its immutable strategy. Only the strategy can deposit, redeem, or withdraw. A liquidity provider mints and burns shares through the market's vault orders, described on [Vault orders](../market/vault-orders.md). The pages below hold the contract surface.

| Page | What it holds |
| --- | --- |
| [Constructor and share token](./share-token.md) | `__constructor` and its five arguments, the share token entries with the errors and events they carry, the `query_asset` view, the share decimals rule, the storage keys with their time to live rules, and the constants. |
| [Share pricing](./share-pricing.md) | `strategy_deposit`, `strategy_redeem`, `preview_deposit`, `preview_redeem`, the `total_assets` view, the `net_pnl` argument these calls price against, the conversion formulas and their rounding, the `Deposit` and `Withdraw` events, and the errors these calls raise. |
| [Strategy withdraw](./strategy-withdraw.md) | `strategy_withdraw` and the errors it raises, the strategy authorization gate, the `get_strategy` view, the transfer the entry makes to the strategy, its effect on the share price, and the `StrategyWithdraw` event. |
