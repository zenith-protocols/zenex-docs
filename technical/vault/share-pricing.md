---
title: Share pricing
sidebar_position: 3
---

# Share pricing

The vault converts between assets and shares at a price the caller marks with `net_pnl` on each call. `strategy_deposit` mints shares against assets, and `strategy_redeem` burns shares for assets. `preview_deposit` and `preview_redeem` quote the same two conversions and move nothing. Every conversion rounds down, in the vault's favor.

## The asset balance

```rust
fn total_assets(e: Env) -> i128
```

A view. Nobody signs. It returns the asset token's `balance` of the vault contract address (token-dec). The value is the live balance, before any mark. The balance is the whole of the vault's asset accounting. A plain transfer of the asset to the vault raises `total_assets` and raises the share price. The [strategy withdraw](./strategy-withdraw.md) page covers the entry that lowers it.

## The `net_pnl` mark

`net_pnl` is the strategy's pending trader PnL, marked against the vault (token-dec, signed). A positive value is profit the vault still owes. A negative value is loss the vault still collects. The caller supplies it on every call that prices shares, and the vault neither computes nor stores it. The vault check is `PnlExceedsAssets` (801). A mark large enough to overflow `total_assets - net_pnl` traps without a contract error code. The [vault orders](../market/vault-orders.md) page covers the mark the market passes.

## Conversion formulas

```rust
fn assets_to_shares(e: &Env, assets: i128, net_pnl: i128) -> i128
fn shares_to_assets(e: &Env, shares: i128, net_pnl: i128) -> i128
fn exchange_basis(e: &Env, net_pnl: i128) -> (i128, i128)
fn effective_assets(e: &Env, net_pnl: i128) -> i128
```

`StrategyVault::assets_to_shares` and `StrategyVault::shares_to_assets` are the conversions, and each traps `InvalidAmount` (800) on a negative input. Both build their divisor and multiplier through `StrategyVault::exchange_basis`, which returns the supply and the basis assets from `StrategyVault::effective_assets`. `StrategyVault` is the vault's own strategy-facing core. `Vault` and `Base` are the vault and fungible-token types it builds on. The formulas take these inputs, and F1 and F2 define the three derived terms.

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

F2 is the exchange basis. `supply` is share-dec and `basis_assets` is token-dec. The `10^decimals_offset` term (share-dec) is the virtual shares, and together with the `+1` floor it is the inflation mitigation. `supply` and `basis_assets` are each at least 1, so neither F3 nor F4 can divide by zero.

```
F2: supply       = total_supply + 10^decimals_offset
    basis_assets = effective_assets + 1
```

F3 prices a deposit and F4 prices a redemption.

```
F3: shares = floor(assets * supply / basis_assets)
F4: assets = floor(shares * basis_assets / supply)
```

Both are `SorobanFixedPoint::fixed_mul_floor` on `i128`. The helper tries the product at 128 bits and redoes the whole expression at 256 bits on overflow. A result outside `i128` traps, and that trap carries no contract error code. Every input is non-negative, so the floor equals truncation and the result is never negative.

The bootstrap case is an empty vault at a zero mark, where `total_supply` and `total_assets` are `0` and the caller passes a `net_pnl` of `0`. There `basis_assets` is `1`, and F3 reduces to a multiplication by the virtual shares. With a `decimals_offset` of `0`, the first deposit mints one share per asset unit.

```
shares = assets * 10^decimals_offset
```

## `strategy_deposit`

```rust
fn strategy_deposit(e: Env, assets: i128, receiver: Address, from: Address, net_pnl: i128) -> i128
```

The registered strategy must sign, through `StrategyVault::require_strategy`. The vault needs no other signature on the entry. `assets` is token-dec and must be positive. The return is the shares minted to `receiver` (share-dec), from F3.

`StrategyVault::deposit` runs these steps in order.

1. If `assets` is not positive, the call traps `InvalidAmount` (800).
2. F3 prices the shares. The price is taken before the assets land, so the deposit does not count itself as backing.
3. The vault pulls the assets. If `from` is the strategy, the vault calls the asset token's `transfer`. The strategy must authorize that sub-invocation on the asset token. Otherwise the vault calls `transfer_from` with the strategy as the spender, so `from` must first approve the strategy on the asset token. The market always passes itself as `from`.
4. `Base::update` raises `FungibleStorageKey::TotalSupply` and `FungibleStorageKey::Balance(receiver)` by the shares.
5. `emit_deposit` publishes `Deposit`.

The entry reads `StrategyStorageKey::Strategy`, `VaultStorageKey::AssetAddress`, `VaultStorageKey::VirtualDecimalsOffset`, `FungibleStorageKey::TotalSupply`, and `FungibleStorageKey::Balance(receiver)`, and it calls `balance` on the asset token. It writes `TotalSupply` and `Balance(receiver)`, then extends the instance lease.

## `strategy_redeem`

```rust
fn strategy_redeem(e: Env, shares: i128, receiver: Address, owner: Address, net_pnl: i128) -> i128
```

The registered strategy must sign, through `StrategyVault::require_strategy`. The vault needs no other signature on the entry. `shares` is share-dec and must be positive. The return is the assets paid to `receiver` (token-dec), from F4.

`StrategyVault::redeem` runs these steps in order.

1. If `shares` is not positive, the call traps `InvalidAmount` (800).
2. F4 prices the assets. The price is taken before the burn, so the redemption does not count itself.
3. If `owner` is not the strategy, `Base::spend_allowance` spends the share allowance from `owner` to the strategy. An allowance whose `live_until_ledger` is below the current ledger sequence counts as `0`. A spend writes the allowance and publishes no `Approve` event.
4. `Base::update` lowers `FungibleStorageKey::Balance(owner)` and `FungibleStorageKey::TotalSupply` by the shares.
5. The vault calls the asset token's `transfer` to send the assets to `receiver`.
6. `emit_withdraw` publishes `Withdraw`.

The market always passes itself as `owner`, after it moves the shares to itself.

The entry reads the same keys `strategy_deposit` reads, with `FungibleStorageKey::Balance(owner)` in place of `Balance(receiver)`. When `owner` is not the strategy, it also reads `FungibleStorageKey::Allowance(AllowanceKey { owner, spender })`. It writes `Balance(owner)` and `TotalSupply`, and it writes the spent allowance under the same condition. It then extends the instance lease.

A balance lease is extended on a read of an entry that already exists. A spent allowance keeps a lease only when the amount left after the spend is above `0`. The [Constructor and share token](./share-token.md) page gives the thresholds.

A negative `net_pnl` raises `effective_assets` above the live balance. The asset token's `transfer` then fails with the asset contract's own error when a large part of the supply redeems at that mark.

## `preview_deposit` and `preview_redeem`

```rust
fn preview_deposit(e: Env, assets: i128, net_pnl: i128) -> i128
fn preview_redeem(e: Env, shares: i128, net_pnl: i128) -> i128
```

Views. Nobody signs. `preview_deposit` returns F3 and `preview_redeem` returns F4, at the same mark and the same rounding as the two entries above. Both accept a zero input and return `0`, so `preview_deposit` with `assets` of `0` returns `0` while `strategy_deposit` with the same value traps. A negative input traps `InvalidAmount` (800), and `PnlExceedsAssets` (801) applies to both. `preview_redeem` does not check that any account holds the shares.

Both read `VaultStorageKey::AssetAddress`, `VaultStorageKey::VirtualDecimalsOffset`, and `FungibleStorageKey::TotalSupply`, and both call `balance` on the asset token. Neither writes storage, emits an event, or extends the instance lease.

## Events

The supply change goes through `Base::update`, so `Deposit` and `Withdraw` are the only events the vault contract publishes on these entries. The asset token publishes its own transfer event on `strategy_deposit` and `strategy_redeem`. The `operator` topic is the registered strategy on both.

| Event | Entry | Topics, in order | Data map |
| --- | --- | --- | --- |
| `Deposit` | `strategy_deposit` | `"deposit"`, `operator: Address`, `from: Address`, `receiver: Address` | `assets: i128` (token-dec), `shares: i128` (share-dec) |
| `Withdraw` | `strategy_redeem` | `"withdraw"`, `operator: Address`, `receiver: Address`, `owner: Address` | `assets: i128` (token-dec), `shares: i128` (share-dec) |

## Errors

| Code | Error | Condition | Raised by |
| --- | --- | --- | --- |
| 800 | `StrategyVaultError::InvalidAmount` | `assets` or `shares` is not positive on an entry, and negative on a preview. | `strategy_deposit`, `strategy_redeem`, `preview_deposit`, `preview_redeem` |
| 801 | `StrategyVaultError::PnlExceedsAssets` | `total_assets - net_pnl` is negative. Equality passes and prices on the `+1` floor. | `strategy_deposit`, `strategy_redeem`, `preview_deposit`, `preview_redeem` |
| 100 | `FungibleTokenError::InsufficientBalance` | `Balance(owner)` is below `shares`. | `strategy_redeem` |
| 101 | `FungibleTokenError::InsufficientAllowance` | `owner` is not the strategy and the share allowance from `owner` to the strategy is below `shares`. | `strategy_redeem` |
| 104 | `FungibleTokenError::MathOverflow` | `TotalSupply` plus the minted shares overflows `i128`. | `strategy_deposit` |

A failed strategy authorization is a host auth error, not a contract error code. A failure inside the asset token, such as a short balance or a short allowance on the asset, carries the asset contract's own code.

## Invariants

The mark is an argument, not state. The vault stores no `net_pnl` and no last share price. Two calls in the same ledger with different marks get different prices. The 801 check is the only contract bound on the value.

Neither entry counts its own movement. `strategy_deposit` prices the shares before the assets land, and `strategy_redeem` prices the assets before the burn. Each conversion therefore reads the balance and the supply as they stood before the call.

A zero output is a valid result. `strategy_deposit` mints `0` shares and still takes the assets when `assets * supply` is below `basis_assets`. `strategy_redeem` burns the shares and pays `0` assets when `shares * basis_assets` is below `supply`. Neither case is rejected.

Every conversion rounds down. A deposit and then a redemption at the same mark returns at most the deposited assets.
