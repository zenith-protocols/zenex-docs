---
sidebar_position: 1
title: Vault Overview
---

# Vault Overview

The vault is an [ERC-4626](https://eips.ethereum.org/EIPS/eip-4626) tokenized vault built on [OpenZeppelin Stellar Contracts](https://github.com/OpenZeppelin/stellar-contracts) (`stellar-tokens::vault`). It holds a single collateral token (e.g., USDC) and issues share tokens to liquidity providers. The vault acts as the counterparty to all trading positions: it absorbs losses from traders and pays out profits.

For standard ERC-4626 behavior (deposit, withdraw, mint, redeem, share price math), refer to the [OpenZeppelin Stellar Tokens documentation](https://github.com/OpenZeppelin/stellar-contracts/tree/main/contracts/token). This page documents only Zenex-specific extensions and design decisions.

## Share Price

Share price reflects the vault's total asset value relative to outstanding shares:

$$
\text{share\_price} = \frac{\text{total\_assets}}{\text{total\_supply}}
$$

Share price **increases** when the vault receives fees from trades or collateral from losing positions. Share price **decreases** when the trading contract withdraws funds to pay profitable traders.

## Decimals Offset

The vault constructor accepts a `decimals_offset: u32` parameter that provides inflation-attack protection via the OpenZeppelin virtual shares mechanism. This adds "dead shares" to the initial supply, preventing the first depositor from manipulating the share price through donation attacks. Zenex forwards the value directly to OpenZeppelin's `Vault::set_decimals_offset` without any additional bound check; in practice 0 through 10 is the recommended range.

## Interaction with Trading

### Token Flow

| Direction | When | Mechanism |
|---|---|---|
| Fees to Vault | Every trade (open/close/fill) | `token.transfer(trading, vault, fee_amount)` |
| Collateral to Vault | Trader loss | `token.transfer(trading, vault, collateral_remainder)` |
| Vault to Trading | Trader profit | `strategy_withdraw(trading, payout_amount)` |

The trading contract never holds vault shares. It interacts purely through `strategy_withdraw` and direct token transfers.

### Vault Interface

The trading contract uses a minimal vault client:

```rust
pub trait VaultInterface {
    fn query_asset(e: Env) -> Address;
    fn total_assets(e: Env) -> i128;
    fn strategy_withdraw(e: Env, strategy: Address, amount: i128);
}
```

`total_assets()` is called by the circuit breaker and ADL system to determine vault capacity. `query_asset()` returns the underlying collateral token address. `strategy_withdraw()` is the sole mechanism for the trading contract to pull funds from the vault.

## Storage Layout

### Instance Storage

| Key | Type | Description |
|---|---|---|
| `LockTime` | `u64` | Global lock duration in seconds |
| `Strategy` | `Address` | Authorized trading contract |

### Persistent Storage

| Key | Type | Description |
|---|---|---|
| `DepositLock(Address)` | `DepositLock { timestamp: u64, shares: i128 }` | Per-user deposit lock tracking the most recent deposit timestamp and the number of shares locked within that window |

OpenZeppelin's token library manages share balances, allowances, and metadata in its own storage namespace.
