---
title: Share pricing
sidebar_position: 3
---

# Share pricing

This page covers how the vault prices its shares and the four calls that use the price. The vault converts between assets and shares at a price the caller marks with `net_pnl` on each call. `strategy_deposit` mints shares against assets, and `strategy_redeem` burns shares for assets. `preview_deposit` and `preview_redeem` quote the same two conversions and move nothing. Every conversion rounds down, in the vault's favor.

## The vault reads its asset balance live

```rust
fn total_assets(e: Env) -> i128
```

Any caller can call this view. It returns the asset token's `balance` of the vault contract address (token-dec), before any mark. That balance is the whole of the vault's asset accounting, so a plain transfer of the asset to the vault raises `total_assets` and the share price. The [strategy withdraw](./strategy-withdraw.md) page covers the entry that lowers it. If `VaultStorageKey::AssetAddress` is unset, the read traps `VaultTokenError::VaultAssetAddressNotSet` (400).

## The caller supplies the mark

`net_pnl` is the strategy's pending trader PnL (profit and loss), marked against the vault (token-dec, signed). A positive value is profit the vault still owes. A negative value is loss the vault still collects. The market holds the open book, so the market computes the mark and the vault takes it as an argument. The [vault orders](../market/vault-orders.md) page covers the mark the market passes.

The vault stores no `net_pnl` and no last share price. Two calls in the same ledger with different marks therefore get different prices. The only contract bound on the value is `PnlExceedsAssets` (801), raised when `total_assets - net_pnl` is negative. A mark large enough to overflow that subtraction traps without a contract error code.

## Conversion formulas

```rust
fn assets_to_shares(e: &Env, assets: i128, net_pnl: i128) -> i128
fn shares_to_assets(e: &Env, shares: i128, net_pnl: i128) -> i128
fn exchange_basis(e: &Env, net_pnl: i128) -> (i128, i128)
fn effective_assets(e: &Env, net_pnl: i128) -> i128
```

`StrategyVault` is the vault's own strategy-facing core. `Vault` and `Base` are the OpenZeppelin vault and fungible-token types it builds on. `StrategyVault::assets_to_shares` and `StrategyVault::shares_to_assets` are the two conversions, and each traps `InvalidAmount` (800) on a negative input. Both build their divisor and multiplier through `StrategyVault::exchange_basis`, which returns the supply and the basis assets from `StrategyVault::effective_assets`. The formulas take these inputs.

| Variable | Unit | Source |
| --- | --- | --- |
| `assets` | token-dec | The `assets` argument. |
| `shares` | share-dec | The `shares` argument. |
| `total_assets` | token-dec | `Vault::total_assets`, the vault's live asset balance. |
| `net_pnl` | token-dec, signed | The `net_pnl` argument. |
| `total_supply` | share-dec | `Base::total_supply`, from `FungibleStorageKey::TotalSupply`. |
| `decimals_offset` | Decimal places, 0 to 10 | `Vault::get_decimals_offset`, from `VaultStorageKey::VirtualDecimalsOffset`. |

The [units and scales](../units.md) page defines token-dec and share-dec. F1 is `effective_assets` (token-dec), the backing available to shareholders. If it is negative, the call traps `PnlExceedsAssets` (801).

```
F1: effective_assets = total_assets - net_pnl
```

F2 is the exchange basis. `supply` is share-dec and `basis_assets` is token-dec. The `10^decimals_offset` term (share-dec) is the virtual shares.

```
F2: supply       = total_supply + 10^decimals_offset
    basis_assets = effective_assets + 1
```

The virtual shares and the `+1` floor defend against an inflation attack. In that attack, a depositor donates assets straight to the vault. The donation raises `basis_assets` while `total_supply` stays small, so F3 floors a later deposit to zero or too few shares. The virtual shares enlarge `supply`, so a donation must be about `10^decimals_offset` times larger to round a victim's shares down to zero. The `+1` keeps `basis_assets` at 1 or more, so neither F3 nor F4 divides by zero. `supply` is at least 1 because the virtual shares are at least 1.

F3 prices a deposit and F4 prices a redemption.

```
F3: shares = floor(assets * supply / basis_assets)
F4: assets = floor(shares * basis_assets / supply)
```

Both are `SorobanFixedPoint::fixed_mul_floor` on `i128`. The helper tries the product at 128 bits and redoes the whole expression at 256 bits on overflow. A result outside `i128` traps, and that trap carries no contract error code. Every input is non-negative, so the floor equals truncation and the result is never negative.

In words, a share is worth the marked backing plus one unit, divided by the supply plus the virtual shares. A profit mark lowers the backing, so a deposit mints more shares and a redemption pays less. A loss mark does the opposite. The rows below are illustrative inputs. They use an asset of 7 decimals and a `decimals_offset` of 3. Every row after the first uses a vault that holds 10,000,000 assets against 10,000,000,000 shares.

| Call | `net_pnl` | Input | `basis_assets` | Result |
| --- | --- | --- | --- | --- |
| F3, empty vault (`total_assets` and `total_supply` are 0) | 0 | 10,000,000 assets | 1 | 10,000,000,000 shares |
| F3 | 0 | 5,000,000 assets | 10,000,001 | 5,000,000,000 shares |
| F3 | 2,000,000 | 5,000,000 assets | 8,000,001 | 6,249,999,843 shares |
| F3 | -2,000,000 | 5,000,000 assets | 12,000,001 | 4,166,666,736 shares |
| F4 | 0 | 5,000,000,000 shares | 10,000,001 | 5,000,000 assets |
| F4 | 2,000,000 | 5,000,000,000 shares | 8,000,001 | 4,000,000 assets |
| F4 | -2,000,000 | 5,000,000,000 shares | 12,000,001 | 5,999,999 assets |

In the empty case `basis_assets` is 1 and F3 reduces to a multiplication by the virtual shares. With a `decimals_offset` of 0, the first deposit mints one share per asset unit.

```
shares = assets * 10^decimals_offset
```

## `strategy_deposit`

```rust
fn strategy_deposit(e: Env, assets: i128, receiver: Address, from: Address, net_pnl: i128) -> i128
```

The registered strategy must authorize the call through `StrategyVault::require_strategy`, described on the [strategy withdraw](./strategy-withdraw.md) page. `assets` is token-dec and must be positive. The return is the shares minted to `receiver` (share-dec), from F3.

`StrategyVault::deposit` runs these steps in order.

1. If `assets` is not positive, the call traps `InvalidAmount` (800).
2. F3 prices the shares. If F1 is negative, the call traps `PnlExceedsAssets` (801).
3. The vault pulls the assets. If `from` is the strategy, the vault calls the asset token's `transfer`, and the strategy must authorize that sub-invocation on the asset token. Otherwise the vault calls `transfer_from` with the strategy as the spender, so `from` must first approve the strategy on the asset token. The market always passes itself as `from`.
4. `Base::update` raises `FungibleStorageKey::TotalSupply` and `FungibleStorageKey::Balance(receiver)` by the shares. If the new supply overflows `i128`, the call traps `FungibleTokenError::MathOverflow` (104).
5. `emit_deposit` publishes `Deposit`.

The entry reads `StrategyStorageKey::Strategy`, `VaultStorageKey::AssetAddress`, `VaultStorageKey::VirtualDecimalsOffset`, `FungibleStorageKey::TotalSupply`, and `FungibleStorageKey::Balance(receiver)`, and it calls `balance` on the asset token. It writes `TotalSupply` and `Balance(receiver)`, then extends the instance TTL.

## `strategy_redeem`

```rust
fn strategy_redeem(e: Env, shares: i128, receiver: Address, owner: Address, net_pnl: i128) -> i128
```

The registered strategy must authorize the call through `StrategyVault::require_strategy`, described on the [strategy withdraw](./strategy-withdraw.md) page. `shares` is share-dec and must be positive. The return is the assets paid to `receiver` (token-dec), from F4.

`StrategyVault::redeem` runs these steps in order.

1. If `shares` is not positive, the call traps `InvalidAmount` (800).
2. F4 prices the assets. If F1 is negative, the call traps `PnlExceedsAssets` (801).
3. If `owner` is not the strategy, `Base::spend_allowance` spends the share allowance from `owner` to the strategy. If the allowance is below `shares`, the call traps `FungibleTokenError::InsufficientAllowance` (101). The [Constructor and share token](./share-token.md) page gives the allowance semantics.
4. `Base::update` lowers `FungibleStorageKey::Balance(owner)` and `FungibleStorageKey::TotalSupply` by the shares. If `Balance(owner)` is below `shares`, the call traps `FungibleTokenError::InsufficientBalance` (100).
5. The vault calls the asset token's `transfer` to send the assets to `receiver`.
6. `emit_withdraw` publishes `Withdraw`.

The market always passes itself as `owner`, after it moves the shares to itself, so step 3 is skipped on the market's own calls.

The entry reads the same keys `strategy_deposit` reads, with `FungibleStorageKey::Balance(owner)` in place of `Balance(receiver)`. When `owner` is not the strategy, it also reads and writes `FungibleStorageKey::Allowance(AllowanceKey { owner, spender })`. It writes `Balance(owner)` and `TotalSupply`, then extends the instance TTL. The [Constructor and share token](./share-token.md) page gives the balance and allowance TTL rules and their thresholds.

A negative `net_pnl` raises `effective_assets` above the live balance, so F4 can exceed `total_assets`. If the F4 result for the redeemed shares exceeds the vault's asset balance, the asset token's `transfer` fails with the asset contract's own error. That error carries no `StrategyVaultError` code. In the rows above, redeeming all 10,000,000,000 shares at a `net_pnl` of -2,000,000 prices 11,999,999 assets against a balance of 10,000,000.

## `preview_deposit` and `preview_redeem`

```rust
fn preview_deposit(e: Env, assets: i128, net_pnl: i128) -> i128
fn preview_redeem(e: Env, shares: i128, net_pnl: i128) -> i128
```

Any caller can call these views. `preview_deposit` returns F3 and `preview_redeem` returns F4, at the same mark and with the same rounding as the two entries above. Both accept a zero input and return `0`, so `preview_deposit` with `assets` of `0` returns `0` while `strategy_deposit` with the same value traps. A negative input traps `InvalidAmount` (800), and `PnlExceedsAssets` (801) applies to both. `preview_redeem` does not check that any account holds the shares.

Both previews only read storage. They read `VaultStorageKey::AssetAddress`, `VaultStorageKey::VirtualDecimalsOffset`, and `FungibleStorageKey::TotalSupply`, and they call `balance` on the asset token. They write no storage, publish no event, and leave the instance TTL as it is.

## Events

The supply change goes through `Base::update`, so each entry publishes one vault event, `Deposit` or `Withdraw`. The asset token publishes its own transfer event on `strategy_deposit` and `strategy_redeem`. The `operator` topic is the registered strategy on both events. The data is a map keyed by field name.

| Event | Entry | Topics, in order | Data map |
| --- | --- | --- | --- |
| `Deposit` | `strategy_deposit` | `"deposit"`, `operator: Address`, `from: Address`, `receiver: Address` | `assets: i128` (token-dec), `shares: i128` (share-dec) |
| `Withdraw` | `strategy_redeem` | `"withdraw"`, `operator: Address`, `receiver: Address`, `owner: Address` | `assets: i128` (token-dec), `shares: i128` (share-dec) |

## Errors

| Code | Error | Condition | Raised by |
| --- | --- | --- | --- |
| 800 | `StrategyVaultError::InvalidAmount` | `assets` or `shares` is not positive on an entry, and negative on a preview. | `strategy_deposit`, `strategy_redeem`, `preview_deposit`, `preview_redeem` |
| 801 | `StrategyVaultError::PnlExceedsAssets` | `total_assets - net_pnl` is negative. Equality passes and prices on the `+1` floor. | `strategy_deposit`, `strategy_redeem`, `preview_deposit`, `preview_redeem` |
| 400 | `VaultTokenError::VaultAssetAddressNotSet` | `VaultStorageKey::AssetAddress` is unset on the asset read. The constructor sets it, so a deployed vault does not raise it. | `total_assets`, `strategy_deposit`, `strategy_redeem`, `preview_deposit`, `preview_redeem` |
| 100 | `FungibleTokenError::InsufficientBalance` | `Balance(owner)` is below `shares`. | `strategy_redeem` |
| 101 | `FungibleTokenError::InsufficientAllowance` | `owner` is not the strategy and the share allowance from `owner` to the strategy is below `shares`. | `strategy_redeem` |
| 104 | `FungibleTokenError::MathOverflow` | `TotalSupply` plus the minted shares overflows `i128`. | `strategy_deposit` |

A failed strategy authorization is a host auth error, not a contract error code. A failure inside the asset token, such as a short balance or a short allowance on the asset, carries the asset contract's own code.

## Invariants

Each conversion reads the balance and the supply as they stood before the call. `strategy_deposit` prices the shares before the assets land, and `strategy_redeem` prices the assets before the burn. An entry therefore never counts its own movement in its own price.

A zero output is a valid result. `strategy_deposit` mints `0` shares and still takes the assets when `assets * supply` is below `basis_assets`. `strategy_redeem` burns the shares and pays `0` assets when `shares * basis_assets` is below `supply`. In the vault of the rows above at a `net_pnl` of 0, redeeming 999 shares pays `0` assets and redeeming 1,000 shares pays 1.

Because every conversion rounds down, a deposit and then a redemption at the same mark returns at most the deposited assets. The price of a call depends on three values read at call time, which are the live balance, the supply, and the mark. A preview at the same ledger state and the same mark returns the number the entry uses.
