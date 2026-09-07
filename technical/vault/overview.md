---
sidebar_position: 1
title: Vault Overview
---

# Vault Overview

The strategy vault is a strategy-gated tokenized vault whose share token and virtual-share inflation-attack mitigation come from [OpenZeppelin Stellar Contracts](https://github.com/OpenZeppelin/stellar-contracts) (`stellar-tokens::vault` internals). It holds a single collateral token (e.g., USDC) and issues share tokens to liquidity providers. The vault is the counterparty to every position in its market: it absorbs trader losses and pays trader profits.

The exchange rate is Zenex-specific: shares are priced against a PnL-marked backing, documented under [Share Pricing](#share-pricing) below. For the decimals offset and the virtual-share inflation-attack structure, refer to the [OpenZeppelin Fungible Token Vault documentation](https://docs.openzeppelin.com/stellar-contracts/tokens/vault/vault). This page documents the Zenex-specific wiring.

## One Vault Per Market, Gated to the Market Contract

Each market is a market contract paired with exactly one vault, deployed together by the factory. The vault registers the market contract as its immutable **strategy** at construction.

The vault's mutating surface is three strategy-gated functions: `strategy_deposit(assets, receiver, from, net_pnl)`, `strategy_redeem(shares, receiver, owner, net_pnl)`, and `strategy_withdraw(amount)`, each requiring the registered strategy to authorize the call. Alongside them sit the unauthenticated views `preview_deposit` and `preview_redeem` (both take an explicit `net_pnl` argument), `query_asset`, `total_assets`, and `get_strategy`, plus the share token's nine fungible entry points (`total_supply`, `balance`, `allowance`, `transfer`, `transfer_from`, `approve`, `decimals`, `name`, `symbol`). The OpenZeppelin `Vault` trait is the contract type backing that share token, not an entry-point set: this contract exposes no `deposit`, `mint`, `withdraw`, `redeem`, `convert_to_shares`, `convert_to_assets`, or `max_*` function, and the only previews on the wire are the two-argument ones that take `net_pnl`. LPs do not call the vault directly. They route through the market contract's **vault orders**, and the market contract is the sole caller of the vault's share-accounting entry points. This makes the trading engine the sole writer of the vault's asset and share-supply state (share transfers between holders remain unrestricted), so LP entry and exit obey the trading-side rules that protect the pool: the vault fee and the per-order `min_out` slippage floor on both flows, the deposit size floor and vault balance cap on deposits, and the redeem cooldown and exit gates on redeems.

## Deposits and Redeems Are Vault Orders

An LP deposit or redeem is a two-step, keeper-filled flow, exactly like a trade:

1. The LP calls `create_vault_order` on the **trading** contract. A deposit escrows its assets plus the flat keeper `exec_fee` in the market contract. A redeem escrows its shares plus the `exec_fee` in the settlement token. The order records its creation time. A redeem becomes fillable once `redeem_lock` seconds (read from config at fill time) have elapsed since creation. Deposits have no cooldown.
2. A keeper calls `execute_vault_order`, which prices the fill, checks the redeem cooldown and exit gates, deducts the vault fill fee, enforces the order's `min_out` floor on the net amount received, and calls into the vault to mint or burn shares. A vault order fills whole in a single keeper transaction.

The full escrow, cooldown, exit-gate, and balance-cap semantics live on the [vault order lifecycle page](./deposit-lock.md). The sizing rules (`min_deposit`, `deposit_fee`, `redeem_fee`, `exec_fee`, `redeem_lock`, the redeem exit gates `max_util_withdraw` and `max_pnl_withdraw`, `max_vault_balance`) are fields on the market contract's `Config`, not on the vault. The `min_out` floor is set per order.

There is one shortcut: on a `Retired` market a redeem executes instantly at creation. The shares transfer to the market contract and `strategy_redeem` pays the assets straight to the user at the raw share price (`net_pnl = 0`). No keeper fill, no `exec_fee`, returns order id `0`. Deposits on a retired market are rejected.

## Interaction with the Market Contract

| Direction | When | Mechanism |
|---|---|---|
| Fees (trade, impact, liquidation, borrowing) and trader losses to vault | Every settlement | `token.transfer(trading -> vault, amount)` |
| Vault to trading | Trader profit payout | `strategy_withdraw` |
| Shares minted / burned | Vault-order fill | `strategy_deposit` / `strategy_redeem`, strategy-gated |

Outside a pending redeem's escrow window, the market contract holds no vault shares of its own: a redeem order transfers the LP's shares into the market contract at creation, held there until a keeper burns them at fill or the LP cancels and reclaims them. The market contract moves collateral by direct token transfer and pulls trader profit through `strategy_withdraw`, the one privileged path documented on [Strategy Withdraw](./strategy-withdraw.md).

## Share Pricing

Shares are priced against `effective_assets = total_assets - net_pnl`, where `net_pnl` is the market contract's capped net pending trader PnL, supplied as an argument on both share-converting mutations (`strategy_deposit`, `strategy_redeem`) and both previews. The vault never computes pending PnL itself, and its public `total_assets` view stays the raw token balance. A positive `net_pnl` (profit the vault still owes traders) reduces the effective backing, a negative one (pending trader losses) raises it above the raw balance. A mark whose pending profit exceeds the raw balance panics with `PnlExceedsAssets` (801). Both conversions round down against `effective_assets + 1` with the library's virtual-share offset, always in the standing shareholders' favor.

The market contract supplies `net_pnl` from the fill's verified bid and ask: deposit fills mark pending PnL minimized (long side at bid, short at ask) and redeem fills mark it maximized (long at ask, short at bid). Each mark is adverse to the entering or exiting LP, so the bid/ask spread accrues to standing shareholders in both directions. Each side's pending profit is capped at `max_pnl_trader` of half the vault balance before it enters the mark. Trader losses and fees still raise the raw balance and lift the share price, and a `strategy_withdraw` for a winning trader lowers both.

## Storage

The vault stores its underlying asset, share metadata, decimals offset, and the immutable strategy address. Share balances, allowances, and metadata live in the OpenZeppelin token library's own storage namespace. Cooldown and minimum-deposit rules live entirely in the market contract's `Config` and vault-order logic.
