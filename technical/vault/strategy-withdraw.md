---
sidebar_position: 4
title: Strategy withdraw
---

# Strategy withdraw

The market takes assets out of the vault with `strategy_withdraw`. The market is the vault's registered strategy. It calls the entry when the vault leg of a settlement is negative. The entry runs before the market pays the keeper, the treasury, and the trader.

## The entry

```rust
fn strategy_withdraw(e: Env, amount: i128);
```

`amount` is in the asset's own decimals (token-dec) and must be above zero. The entry returns nothing. It runs `StrategyVault::require_strategy`, then `StrategyVault::withdraw`. `StrategyVault::withdraw` reads `StrategyStorageKey::Strategy` and `VaultStorageKey::AssetAddress`. It then transfers `amount` from the vault to the strategy through the asset token. The entry then calls `storage::extend_instance`. [Constructor and share token](./share-token.md) gives the instance lease and the entries that renew it.

The asset token holds the vault's balance and traps with its own error if `amount` is above it. The vault runs no balance check of its own. The market checks `amount` against its tracked vault balance before it calls the entry. [Fees and settlement](../market/fee-system.md) gives that check and the settlement leg that sets `amount`.

The transfer leaves `Base::total_supply` and every share balance unchanged.

## Authorization

`StrategyVault::require_strategy` runs first on every strategy entry. It reads `StrategyStorageKey::Strategy` and calls `require_auth` on that address. A call without that authorization fails at the host as an authorization error, not as a contract error code.

The registered strategy is the market contract. [Constructor and share token](./share-token.md) covers the constructor write that fixes it. `strategy_deposit`, `strategy_redeem`, and `strategy_withdraw` run the same gate. The market is therefore the only caller that moves assets through a vault entry. It is also the only caller that changes the share supply.

## The registered strategy

```rust
fn get_strategy(e: Env) -> Address;
```

`get_strategy` is a view that any caller reads without authorization. It returns `StrategyStorageKey::Strategy`. On an instance whose constructor never ran, the read traps as a host error and not as a contract error code.

## Errors

`strategy_withdraw` raises two contract error codes. `get_strategy` raises none.

| Code | Variant | Condition |
| --- | --- | --- |
| 800 | `StrategyVaultError::InvalidAmount` | `amount` is zero or negative. |
| 400 | `VaultTokenError::VaultAssetAddressNotSet` | `VaultStorageKey::AssetAddress` is unset on the `Vault::query_asset` read. The constructor sets it, so a deployed vault does not raise it. |

A failed asset transfer carries the asset token's own error code.

## Event

| Event | Topics | Data map |
| --- | --- | --- |
| `StrategyWithdraw` | `"strategy_withdraw"`, `strategy: Address` | `amount: i128` (token-dec) |

The data is a map keyed by field name. The event is published after the transfer. `strategy` is the registered strategy, which is also the recipient of the assets. The asset token publishes its own transfer event on `strategy_withdraw`.

## Effect on the backing per share

A redemption prices against `StrategyVault::effective_assets`. That value is `Vault::total_assets`, the vault's live asset balance in token-dec, less the `net_pnl` mark the market supplies (token-dec, signed). `StrategyVault::shares_to_assets` converts shares to assets against that backing. [Share pricing](./share-pricing.md) gives the conversion and every variable in it.

`strategy_withdraw` lowers `Vault::total_assets` by `amount` and leaves the share supply at its previous value. At a fixed `net_pnl` the backing falls by `amount`. `StrategyVault::shares_to_assets` then returns fewer assets for the same shares, and it floors the result.

The market recomputes `net_pnl` from the open book with `Market::capped_net_pnl` on each call that prices shares, so the mark moves across a settlement. `Market::capped_net_pnl` caps each side's pending profit at `max_pnl_trader`, a `SCALAR_18` fraction, of half the vault balance. `Config::check_valid` holds `max_pnl_trader` below `SCALAR_18`, so each side's capped mark stays below half the vault balance. The backing per share after a settlement follows both terms, the balance the withdrawal lowers and the mark the market recomputes. [Fees and settlement](../market/fee-system.md) gives the legs that set them.
