---
sidebar_position: 1
title: Vault Overview
---

# Vault Overview

The strategy vault is an ERC-4626 style tokenized vault built on [OpenZeppelin Stellar Contracts](https://github.com/OpenZeppelin/stellar-contracts) (`stellar-tokens::vault`). It holds a single collateral token (e.g., USDC) and issues share tokens to liquidity providers. The vault is the counterparty to every position in its market: it absorbs trader losses and pays trader profits.

For standard vault behavior (share-price math, decimals offset, inflation-attack protection), refer to the [OpenZeppelin Fungible Token Vault documentation](https://docs.openzeppelin.com/stellar-contracts/tokens/vault/vault). This page documents only the Zenex-specific wiring.

## One Vault Per Market, Gated to the Trading Contract

Each market is a trading contract paired with exactly one vault, deployed together by the factory. The vault registers the trading contract as its immutable **strategy** at construction.

Every ERC-4626 mutation (`deposit`, `mint`, `withdraw`, `redeem`) requires the registered strategy to authorize the call. LPs do not call the vault directly. They route through the trading contract's **vault orders**, and the trading contract is the sole caller of the vault's share-accounting entry points. This makes the trading engine the single writer of vault state, so LP entry and exit obey the same pending-PnL gates, cooldowns, and fees that protect the pool, all enforced on the trading side. The ERC-4626 methods also take an `operator` argument (the strategy), threaded through from the trading contract.

## Deposits and Redeems Are Vault Orders

An LP deposit or redeem is a two-step, keeper-filled flow, exactly like a trade:

1. The LP calls `create_vault_order` on the **trading** contract. A deposit escrows its assets in the trading contract; a redeem escrows its shares. The order records a cooldown deadline at creation.
2. A keeper calls `execute_vault_order`, which prices the fill, checks the LP gates and cooldowns, deducts the vault fill fee, and calls into the vault to mint or burn shares.

The full escrow, cooldown, snipe/withdraw gate, and balance-cap semantics live on [Deposit Lock](./deposit-lock.md). The sizing rules (`min_deposit`, `vault_fee`, `redeem_lock`, `deposit_lock`, the PnL gates, `max_vault_balance`) are fields on the trading contract's `Config`, not on the vault.

There is one shortcut: on a `Retired` market a redeem forwards straight to `vault.redeem` and pays out at creation (no keeper fill, returns order id `0`). Deposits on a retired market are rejected.

## Interaction with Trading

| Direction | When | Mechanism |
|---|---|---|
| Fees, losses, forfeits to vault | Every settlement | `token.transfer(trading -> vault, amount)` |
| Vault to trading | Trader profit payout | `strategy_withdraw(strategy, amount)` |
| Shares minted / burned | Vault-order fill | `deposit` / `mint` / `redeem`, strategy-gated |

The trading contract never holds vault shares of its own. It moves collateral by direct token transfer and pulls trader profit through `strategy_withdraw`, the one privileged path documented on [Strategy Withdraw](./strategy-withdraw.md).

## Share Pricing

Share price is standard ERC-4626: shares are priced against the vault's `total_assets` (its token balance). Trader losses and fees raise `total_assets` and lift the share price; a `strategy_withdraw` for a winning trader lowers `total_assets` and the share price. Because the trading contract's pending PnL is not yet reflected in the token balance, the LP gates on the trading side (snipe and withdraw PnL gates) exist to stop deposits and redeems from front-running that unrealized flow. See [Deposit Lock](./deposit-lock.md).

## Storage

The vault stores its underlying asset, share metadata, decimals offset, and the immutable strategy address. Share balances, allowances, and metadata live in the OpenZeppelin token library's own storage namespace. Lock and minimum-deposit rules live entirely in the trading contract's `Config` and vault-order logic.
