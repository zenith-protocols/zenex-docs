---
title: Constructor and share token
sidebar_position: 2
---

# Constructor and share token

The vault issues shares as an OpenZeppelin fungible token with `ContractType = Vault`. The constructor fixes the underlying asset, the decimals offset, the share metadata, and the strategy address. The nine share token entries below are the library defaults, and only `decimals` carries a vault-specific body. A share amount is share-dec, which is the asset's own decimals plus the decimals offset.

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

The constructor runs once at deployment and needs no authorization. `name` and `symbol` are the share token metadata. `asset` is the underlying collateral token. `decimals_offset` is a count of extra decimal places, from 0 to 10. `strategy` is the market contract. `strategy_deposit`, `strategy_redeem`, and `strategy_withdraw` each need authorization from that address.

The order of effects is fixed:

1. `Vault::set_asset` writes `VaultStorageKey::AssetAddress`.
2. `Vault::set_decimals_offset` writes `VaultStorageKey::VirtualDecimalsOffset`.
3. `Base::set_metadata` writes `FungibleStorageKey::Meta` with `Vault::decimals`, `name`, and `symbol`. Step 3 makes a cross-contract `decimals` call on `asset`, so `asset` must already be a live token contract.
4. `storage::set_strategy` writes `StrategyStorageKey::Strategy`.
5. `storage::extend_instance` extends the instance TTL.

The four keys the constructor writes are instance storage. `StrategyStorageKey::Strategy` is never rewritten, because `storage::set_strategy` has no other caller.

| Error | Code | Condition |
|---|---|---|
| `VaultTokenError::VaultMaxDecimalsOffsetExceeded` | 409 | `decimals_offset` is above `MAX_DECIMALS_OFFSET`. |
| `VaultTokenError::MathOverflow` | 410 | The sum of the asset decimals and `decimals_offset` overflows u32. |
| `VaultTokenError::VaultAssetAddressAlreadySet` | 401 | `AssetAddress` already holds a value. |
| `VaultTokenError::VaultVirtualDecimalsOffsetAlreadySet` | 402 | `VirtualDecimalsOffset` already holds a value. |

Codes 401 and 402 guard the two setters against a second write. The constructor runs once per contract, so a deployed vault does not raise them.

## Share decimals

`Vault::decimals` computes the share decimals:

```text
share_decimals = asset_decimals + decimals_offset
```

- `asset_decimals`: u32, in decimal places. The result of the `decimals` call on the underlying asset contract, read live on every call. Symbol `Vault::get_underlying_asset_decimals`.
- `decimals_offset`: u32, in decimal places, from 0 to 10. The value under `VaultStorageKey::VirtualDecimalsOffset`, or 0 when the key is unset. Symbol `Vault::get_decimals_offset`.

The addition is checked and traps with code 410 on overflow. The constructor stores the sum in `Metadata.decimals`. The exported `decimals` entry recomputes the sum on every call.

## The underlying asset

```rust
fn query_asset(e: Env) -> Address
```

A view that any caller can call. It returns the address under `VaultStorageKey::AssetAddress`. When the key is unset, it traps with `VaultTokenError::VaultAssetAddressNotSet` (400).

## Share token entries

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

Every `i128` amount above is share-dec. `live_until_ledger` is a ledger sequence number.

`total_supply` returns `FungibleStorageKey::TotalSupply`, or 0 when the key is unset. `balance` returns `FungibleStorageKey::Balance(account)`, or 0 when the entry is absent. `allowance` returns the amount under `FungibleStorageKey::Allowance(AllowanceKey)`. An absent entry reads 0. An entry whose `live_until_ledger` is below the current ledger sequence also reads 0. Any caller can call `total_supply`, `balance`, `allowance`, `decimals`, `name`, and `symbol`.

`transfer` needs authorization from `from`. It moves `amount` from `from` to the address inside `to`. `transfer_from` needs authorization from `spender`. It spends the allowance from `from` to `spender` first, then moves `amount` from `from` to `to`. The allowance write inside `transfer_from` emits no `Approve` event.

`approve` needs authorization from `owner`, and it replaces any allowance that `owner` already granted to `spender`. It writes the temporary allowance entry. The stored `live_until_ledger` is the last ledger sequence on which `allowance` still reads the stored amount. When `amount` is above 0 and the remaining TTL is below `live_until_ledger` minus the current ledger sequence, `approve` raises the entry TTL to that difference.

`name` and `symbol` read `Metadata`. `decimals` is described under Share decimals above.

**Shares transfer freely.** Any holder can move them, and the vault applies no allowlist, lock, or cooldown to a transfer. The market holds the redeem lock, described on [Vault orders](../market/vault-orders.md).

| Error | Code | Where |
|---|---|---|
| `FungibleTokenError::InsufficientBalance` | 100 | `transfer` and `transfer_from`, when the balance of `from` is below `amount`. |
| `FungibleTokenError::InsufficientAllowance` | 101 | `transfer_from`, when the allowance from `from` to `spender` is below `amount`. |
| `FungibleTokenError::InvalidLiveUntilLedger` | 102 | `approve`, when `live_until_ledger` is above the ledger's `max_live_until_ledger`, a sequence bound that moves with each ledger, or when `amount` is above 0 and `live_until_ledger` is below the current ledger sequence. |
| `FungibleTokenError::LessThanZero` | 103 | `transfer`, `transfer_from`, and `approve`, when `amount` is below 0. |
| `FungibleTokenError::UnsetMetadata` | 105 | `name` and `symbol`, when `Meta` is unset. |
| `VaultTokenError::VaultAssetAddressNotSet` | 400 | `decimals`, when `AssetAddress` is unset. The constructor sets it, so a deployed vault does not raise it. |
| `VaultTokenError::MathOverflow` | 410 | `decimals`, when the sum of the asset decimals and the decimals offset overflows u32. |

## Events

| Event | Emitted by | Topics | Data |
|---|---|---|---|
| `Transfer` | `transfer` with a plain `to`, and `transfer_from` | `"transfer"`, `from: Address`, `to: Address` | `amount: i128` share-dec, as a bare value |
| `MuxedTransfer` | `transfer` when `to` carries a muxed id | `"transfer"`, `from: Address`, `to: Address` | `to_muxed_id: Option<u64>`, `amount: i128` share-dec |
| `Approve` | `approve` | `"approve"`, `owner: Address`, `spender: Address` | `amount: i128` share-dec, `live_until_ledger: u32` ledger sequence |

Both transfer variants publish the same first topic. `Transfer` serializes its data as a single value. `MuxedTransfer` and `Approve` serialize theirs as a map keyed by field name.

A change of supply runs through `Base::update`. It reaches the log as the `Deposit` or `Withdraw` event described on [Share pricing](./share-pricing.md). No `Mint` event and no `Burn` event is emitted.

## Storage

| Key | Type | Class | TTL |
|---|---|---|---|
| `StrategyStorageKey::Strategy` | `Address` | instance | instance TTL |
| `VaultStorageKey::AssetAddress` | `Address` | instance | instance TTL |
| `VaultStorageKey::VirtualDecimalsOffset` | `u32` | instance | instance TTL |
| `FungibleStorageKey::Meta` | `Metadata` | instance | instance TTL |
| `FungibleStorageKey::TotalSupply` | `i128` share-dec | instance | instance TTL |
| `FungibleStorageKey::Balance(Address)` | `i128` share-dec | persistent | extended to `BALANCE_EXTEND_AMOUNT` on a read of an existing entry, once the remaining TTL falls below `BALANCE_TTL_THRESHOLD`. A first write of an entry carries no extension, so the entry starts on the network's minimum TTL for a persistent entry |
| `FungibleStorageKey::Allowance(AllowanceKey)` | `AllowanceData` | temporary | set on `approve`. Rewritten with the remaining amount when `transfer_from` spends more than 0, and when `strategy_redeem` runs with an `owner` that is not the strategy. When the stored amount is above 0 and the remaining TTL is below `live_until_ledger` minus the current ledger sequence, the TTL is raised to that difference |

`storage::extend_instance` extends the instance TTL to `LEDGER_BUMP_INSTANCE` once the remaining TTL falls below `LEDGER_THRESHOLD_INSTANCE`. Only `__constructor`, `strategy_deposit`, `strategy_redeem`, and `strategy_withdraw` call it. The views and the share token entries do not. The five instance keys in the table share one instance lease, so one extension covers all five.

## Constants

The vault defines the instance TTL constants:

| Symbol | Value | Unit |
|---|---|---|
| `ONE_DAY_LEDGERS` | 17280 | ledgers, about 5 seconds each |
| `LEDGER_THRESHOLD_INSTANCE` | 518400, or 30 days | ledgers |
| `LEDGER_BUMP_INSTANCE` | 535680, or 31 days | ledgers |

The share token library defines the rest:

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
