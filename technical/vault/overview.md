---
sidebar_position: 1
title: Vault Overview
---

# Vault Overview

The vault is an ERC-4626 style tokenized vault built on [OpenZeppelin Stellar Contracts](https://github.com/OpenZeppelin/stellar-contracts) (`stellar-tokens::vault`). It is modeled on the ERC-4626 interface but ported to Soroban, not a direct implementation of the Ethereum standard. It holds a single collateral token (e.g., USDC) and issues share tokens to liquidity providers. The vault acts as the counterparty to all trading positions: it absorbs losses from traders and pays out profits.

For standard vault behavior (deposit, withdraw, mint, redeem, share-price math, decimals offset, inflation-attack protection), refer to the [OpenZeppelin Fungible Token Vault documentation](https://docs.openzeppelin.com/stellar-contracts/tokens/vault/vault). This page documents only Zenex-specific extensions and design decisions.

## Deposit Lock

Every deposit or mint adds a per-user lock that prevents the receiver from withdrawing, redeeming, or transferring their newly-minted shares until `lock_time` has elapsed. The lock duration is set globally at vault construction. See [Deposit Lock](./deposit-lock.md) for the full lock semantics, transfer-side behavior, and unlock-time computation.

## Minimum Deposit

A `min_deposit: i128` floor (in asset token decimals) is enforced on every `deposit` and `mint`, rejecting calls below it with `BelowMinDeposit`. It exists to prevent a hostage-taking attack on the deposit lock. Because `deposit` takes a separate `receiver` argument and each new deposit resets the receiver's lock timestamp, an attacker without a floor could repeatedly dust-deposit one token unit into a victim's address, perpetually extending the victim's lock and trapping their shares. Requiring each deposit to cross a meaningful floor makes the attack uneconomic. The floor is set at construction and is **not** mutable post-deployment. Setting it to `0` disables the check.

## Interaction with Trading

### Token Flow

| Direction | When | Mechanism |
|---|---|---|
| Fees to Vault | Every trade (open/close/fill) | `token.transfer(trading, vault, fee_amount)` |
| Collateral to Vault | Trader loss | `token.transfer(trading, vault, collateral_remainder)` |
| Vault to Trading | Trader profit | `strategy_withdraw(trading, payout_amount)` |

The trading contract never holds vault shares. It interacts purely through `strategy_withdraw` and direct token transfers.

### Strategy Withdraw

The only function added on top of the standard vault interface is `strategy_withdraw`, the privileged path the trading contract uses to pull collateral for profitable trader payouts. It bypasses share accounting (no shares are burned) and is gated to a single registered strategy address. See [Strategy Withdraw](./strategy-withdraw.md) for the authorization model and error codes.

## Storage Layout

### Instance Storage

| Key | Type | Description |
|---|---|---|
| `LockTime` | `u64` | Global lock duration in seconds |
| `Strategy` | `Address` | Authorized trading contract |
| `MinDeposit` | `i128` | Minimum asset amount per deposit/mint (token decimals); `0` disables the floor |

### Persistent Storage

| Key | Type | Description |
|---|---|---|
| `DepositLock(Address)` | `DepositLock { timestamp: u64, shares: i128 }` | Per-user deposit lock tracking the most recent deposit timestamp and the number of shares locked within that window |

OpenZeppelin's token library manages share balances, allowances, and metadata in its own storage namespace.
