---
title: Constructor and share token
description: Vault constructor, share decimals, token methods, allowances, events, and storage.
sidebar_position: 2
---

# Constructor and share token

This page covers how `StrategyVaultContract` is initialized and how its shares behave as a token. The constructor fixes the underlying asset, the decimals offset, the share metadata, and the strategy address. The vault issues shares as an OpenZeppelin fungible token with `ContractType = Vault`. The nine share token entries below are the library defaults, and only `decimals` carries a vault-specific body. A share amount is share-dec, the asset's own decimals plus the decimals offset.

## Constructor

```rust
fn __constructor(
    e: Env,
    name: String,
    symbol: String,
    asset: Address,
    decimals_offset: u32,
    strategy: Address,
)
```

The constructor runs once at deployment and needs no authorization. `name` and `symbol` are the share token metadata. `asset` is the underlying collateral token. `decimals_offset` is a count of extra decimal places, from 0 to `MAX_DECIMALS_OFFSET` (10). `strategy` is the market contract, and `strategy_deposit`, `strategy_redeem`, and `strategy_withdraw` each need its authorization.

The factory deploys the vault before the market, so `strategy` is the derived market address. The constructor makes no call to it. The [factory deploy](../factory/deploy.md) page gives the deployment order.

The effects run in a fixed order.

1. `Vault::set_asset` writes `VaultStorageKey::AssetAddress`.
2. `Vault::set_decimals_offset` writes `VaultStorageKey::VirtualDecimalsOffset`.
3. `Base::set_metadata` writes `FungibleStorageKey::Meta` with `Vault::decimals`, `name`, and `symbol`.
4. `storage::set_strategy` writes `StrategyStorageKey::Strategy`.
5. `storage::extend_instance` extends the instance time to live (TTL).

Step 3 makes a cross-contract `decimals` call on `asset`, so `asset` must already be a live token contract. If that call fails, the constructor traps with the error of the asset contract. The four keys the constructor writes are instance storage. The constructor is the only caller of `storage::set_strategy`, so `StrategyStorageKey::Strategy` holds the same address for the life of the vault.

| Step | Error | Code | Condition |
|---|---|---|---|
| 1 | `VaultTokenError::VaultAssetAddressAlreadySet` | 401 | `AssetAddress` already holds a value. |
| 2 | `VaultTokenError::VaultMaxDecimalsOffsetExceeded` | 409 | `decimals_offset` is above `MAX_DECIMALS_OFFSET`. |
| 2 | `VaultTokenError::VaultVirtualDecimalsOffsetAlreadySet` | 402 | `VirtualDecimalsOffset` already holds a value. |
| 3 | `VaultTokenError::MathOverflow` | 410 | The sum of the asset decimals and `decimals_offset` overflows `u32`. |

Step 2 checks the bound before it checks for a second write. A deployed vault never raises 401 or 402, because the constructor runs once per contract and starts from empty instance storage.

## Share decimals add the offset to the asset decimals

`Vault::decimals` computes the share decimals.

```text
share_decimals = asset_decimals + decimals_offset
```

Where:

- `asset_decimals` is a `u32` count of decimal places. It is the result of the `decimals` call on the underlying asset contract, read live on every call. The symbol is `Vault::get_underlying_asset_decimals`.
- `decimals_offset` is a `u32` count of decimal places, from 0 to 10. It is the value under `VaultStorageKey::VirtualDecimalsOffset`, or 0 when the key is unset. The symbol is `Vault::get_decimals_offset`.

The share token carries the asset's decimals plus the offset, so each offset step adds one decimal place to every share amount. The addition is checked and traps with code 410 on overflow. The constructor stores the sum in `Metadata.decimals`. The exported `decimals` entry recomputes the sum on every call and does not read that stored field.

| `asset_decimals` | `decimals_offset` | `share_decimals` |
|---|---|---|
| 7 | 0 | 7 |
| 7 | 3 | 10 |
| 6 | 10 | 16 |
| 4294967295 | 1 | Traps with 410. |

The offset also enters the share price as a count of virtual shares. The [share pricing](./share-pricing.md) page gives that formula.

## The underlying asset

```rust
fn query_asset(e: Env) -> Address
```

A view that any caller can call. It returns the address under `VaultStorageKey::AssetAddress`. When the key is unset, it traps with `VaultTokenError::VaultAssetAddressNotSet` (400).

## Share token entries follow the library defaults

```rust
fn total_supply(e: Env) -> i128
fn balance(e: Env, account: Address) -> i128
fn allowance(e: Env, owner: Address, spender: Address) -> i128
fn transfer(e: Env, from: Address, to: MuxedAddress, amount: i128)
fn transfer_from(e: Env, spender: Address, from: Address, to: Address, amount: i128)
fn approve(e: Env, owner: Address, spender: Address, amount: i128, live_until_ledger: u32)
fn decimals(e: Env) -> u32
fn name(e: Env) -> String
fn symbol(e: Env) -> String
```

Every `i128` amount above is share-dec. `live_until_ledger` is a ledger sequence number. The contract implements `FungibleToken` and not `FungibleVault`. The supply therefore changes only through `strategy_deposit` and `strategy_redeem`, described on [Share pricing](./share-pricing.md).

Any caller can call `total_supply`, `balance`, `allowance`, `decimals`, `name`, and `symbol`.

- `total_supply` returns `FungibleStorageKey::TotalSupply`, or 0 when the key is unset.
- `balance` returns `FungibleStorageKey::Balance(account)`, or 0 when the entry is absent.
- `allowance` returns the amount under `FungibleStorageKey::Allowance(AllowanceKey)`. An absent entry reads 0. An entry whose `live_until_ledger` is below the current ledger sequence also reads 0.
- `name` and `symbol` read `Metadata`. `decimals` is described under share decimals above.

`transfer` needs authorization from `from`. It moves `amount` from `from` to the address inside `to`. `transfer_from` needs authorization from `spender`. It spends the allowance from `from` to `spender` first, then moves `amount` from `from` to `to`. The allowance write inside `transfer_from` emits no `Approve` event.

`approve` needs authorization from `owner`, and it replaces any allowance that `owner` already granted to `spender`. It writes the temporary allowance entry. The stored `live_until_ledger` is the last ledger sequence on which `allowance` still reads the stored amount. A call without the required authorization fails at the host as an authorization error, not as a contract error code.

**Share transfers depend on authorization, balance, and allowance alone.** Any holder can move shares with `transfer` or `transfer_from` at any market status. The redeem lock is a market rule. `create_vault_order` moves the redeemed shares to the market, and `execute_vault_order` traps `VaultOrderLocked` (751) until the ledger timestamp reaches `created_at` plus `redeem_lock`. A share transfer changes neither value. The [Vault orders](../market/vault-orders.md) page gives the lock.

### Gate order and errors

Each call checks its gates in the order below. The first failure traps.

1. `transfer` checks the authorization of `from`, then `amount` below 0, then the balance of `from`.
2. `transfer_from` checks the authorization of `spender`, then `amount` below 0, then the allowance, then the balance of `from`.
3. `approve` checks the authorization of `owner`, then `amount` below 0, then `live_until_ledger`.

| Error | Code | Where |
|---|---|---|
| `FungibleTokenError::InsufficientBalance` | 100 | `transfer` and `transfer_from`, when the balance of `from` is below `amount`. |
| `FungibleTokenError::InsufficientAllowance` | 101 | `transfer_from`, when the allowance from `from` to `spender` is below `amount`. |
| `FungibleTokenError::InvalidLiveUntilLedger` | 102 | `approve`, when `live_until_ledger` is above the `max_live_until_ledger` of the ledger, a sequence bound that moves with each ledger. Also when `amount` is above 0 and `live_until_ledger` is below the current ledger sequence. |
| `FungibleTokenError::LessThanZero` | 103 | `transfer`, `transfer_from`, and `approve`, when `amount` is below 0. |
| `FungibleTokenError::UnsetMetadata` | 105 | `name` and `symbol`, when `Meta` is unset. The constructor sets it, so a deployed vault does not raise it. |
| `VaultTokenError::VaultAssetAddressNotSet` | 400 | `decimals`, when `AssetAddress` is unset. The constructor sets it, so a deployed vault does not raise it. |
| `VaultTokenError::MathOverflow` | 410 | `decimals`, when the sum of the asset decimals and the decimals offset overflows `u32`. |

## Events

| Event | Emitted by | Topics | Data |
|---|---|---|---|
| `Transfer` | `transfer` with a plain `to`, and `transfer_from` | `"transfer"`, `from: Address`, `to: Address` | `amount: i128` share-dec, as a bare value |
| `MuxedTransfer` | `transfer` when `to` carries a muxed id | `"transfer"`, `from: Address`, `to: Address` | `to_muxed_id: Option<u64>`, `amount: i128` share-dec |
| `Approve` | `approve` | `"approve"`, `owner: Address`, `spender: Address` | `amount: i128` share-dec, `live_until_ledger: u32` ledger sequence |

Both transfer variants publish the same first topic. `Transfer` serializes its data as a single value. `MuxedTransfer` and `Approve` serialize theirs as a map keyed by field name.

A change of supply runs through `Base::update`. It reaches the log as the `Deposit` or `Withdraw` event described on [Share pricing](./share-pricing.md). No `Mint` event and no burn event is published.

## Storage

| Key | Type | Class | TTL |
|---|---|---|---|
| `StrategyStorageKey::Strategy` | `Address` | instance | instance TTL |
| `VaultStorageKey::AssetAddress` | `Address` | instance | instance TTL |
| `VaultStorageKey::VirtualDecimalsOffset` | `u32` | instance | instance TTL |
| `FungibleStorageKey::Meta` | `Metadata` | instance | instance TTL |
| `FungibleStorageKey::TotalSupply` | `i128` share-dec | instance | instance TTL |
| `FungibleStorageKey::Balance(Address)` | `i128` share-dec | persistent | extended to `BALANCE_EXTEND_AMOUNT` on a read of an existing entry, once the remaining TTL falls below `BALANCE_TTL_THRESHOLD`. A first write of an entry carries no extension, so the entry starts on the network's minimum TTL for a persistent entry |
| `FungibleStorageKey::Allowance(AllowanceKey)` | `AllowanceData` | temporary | set on `approve`. Rewritten with the remaining amount when `transfer_from` spends more than 0, and when `strategy_redeem` runs with an `owner` that is not the strategy. When the stored amount is above 0 and the remaining TTL is below `live_until_ledger` minus the current ledger sequence, the TTL is raised to that difference. An amount of 0 is written without an extension |

`storage::extend_instance` extends the instance TTL to `LEDGER_BUMP_INSTANCE` once the remaining TTL falls below `LEDGER_THRESHOLD_INSTANCE`. Only `__constructor`, `strategy_deposit`, `strategy_redeem`, and `strategy_withdraw` call it. The five instance keys in the table share one instance TTL, so one extension covers all five. The views, the share token entries, and the allowance entries leave the instance TTL unchanged.

The instance constants match the 31-day tier of the market. `Market::load` reads the `total_assets` of the vault on every price-bearing entry. The instance TTL of the vault therefore must last as long as the instance TTL of the market.

## Constants

The vault defines the instance TTL constants.

| Symbol | Value | Unit |
|---|---|---|
| `ONE_DAY_LEDGERS` | 17280 | ledgers, about 5 seconds each |
| `LEDGER_THRESHOLD_INSTANCE` | 518400, or 30 days | ledgers |
| `LEDGER_BUMP_INSTANCE` | 535680, or 31 days | ledgers |

The share token library defines the rest.

| Symbol | Value | Unit |
|---|---|---|
| `MAX_DECIMALS_OFFSET` | 10 | decimal places |
| `BALANCE_EXTEND_AMOUNT` | 518400, or 30 days | ledgers |
| `BALANCE_TTL_THRESHOLD` | 501120, or 29 days | ledgers |

## Types

| Type | Fields |
|---|---|
| `Metadata` | `decimals: u32`, `name: String`, `symbol: String` |
| `AllowanceKey` | `owner: Address`, `spender: Address` |
| `AllowanceData` | `amount: i128` share-dec, `live_until_ledger: u32` ledger sequence |
