---
sidebar_position: 4
title: Strategy withdraw
description: Strategy authorization, vault payout draws, receipts, and effects on share backing.
---

# Strategy withdraw

This page covers `strategy_withdraw`, the entry that moves assets from the vault to its registered strategy. It also covers the authorization gate of the three strategy entries, the `get_strategy` view, and the effect of a withdrawal on the share price.

The registered strategy is the market. It calls the entry from `Settlement::settle` when the vault leg of a settlement is negative. That happens on a decrease fill through `execute_order`, on `execute_liquidation`, and on `execute_adl`. The draw runs before every payout, so the market holds the assets before it pays the keeper, the treasury, and the trader.

## The entry moves assets to the strategy

```rust
fn strategy_withdraw(e: Env, amount: i128)
```

`amount` is a token-dec value, the asset's own decimals as [Units and scales](../units.md) defines. It must be above zero. The entry returns nothing. `StrategyVault::withdraw` transfers `amount` from the vault contract to the strategy through `transfer` on the asset token, with the vault as `from`. The share supply and every share balance keep their values across the call.

The gates run in this order:

| Step | Action | Failure |
| --- | --- | --- |
| 1 | `StrategyVault::require_strategy` reads `StrategyStorageKey::Strategy` and calls `require_auth` on it. | Host authorization error. |
| 2 | `StrategyVault::withdraw` checks that `amount` is above zero. | `InvalidAmount` (800). |
| 3 | `Vault::query_asset` reads `VaultStorageKey::AssetAddress`. | `VaultAssetAddressNotSet` (400). |
| 4 | The asset token runs `transfer` from the vault to the strategy. | The asset token's own error code. |
| 5 | The vault publishes `StrategyWithdraw`. | None. |
| 6 | `storage::extend_instance` extends the instance time to live (TTL). | None. |

The entry writes no storage of its own. Step 6 raises the instance TTL to `LEDGER_BUMP_INSTANCE` once the remaining TTL falls below `LEDGER_THRESHOLD_INSTANCE`. [Constructor and share token](./share-token.md) gives both constants and the keys that share the TTL.

The asset token enforces the vault's balance. A draw above it traps at step 4 with the token's own error. The market compares the draw with its tracked vault balance before the call and traps `VaultInsolvent` (755) on an excess. [Fees and settlement](../market/fee-system.md) gives that check and the settlement leg that sets `amount`.

## The strategy signs every strategy entry

`StrategyVault::require_strategy` is the first line of `strategy_deposit`, `strategy_redeem`, and `strategy_withdraw`. A call without the strategy's authorization fails at the host as an authorization error, which carries no contract error code. The strategy is the market contract, fixed once by the constructor. [Constructor and share token](./share-token.md) covers that write. The market is therefore the only caller that moves assets through a vault entry and the only caller that mints or burns shares.

## The registered strategy is readable

```rust
fn get_strategy(e: Env) -> Address
```

`get_strategy` is a view. Nobody signs. It returns the address stored under `StrategyStorageKey::Strategy`, which is instance storage. On an instance whose constructor never ran, the read traps with no contract error code.

## Errors

`strategy_withdraw` raises two contract error codes. `get_strategy` raises none.

| Code | Variant | Condition |
| --- | --- | --- |
| 800 | `StrategyVaultError::InvalidAmount` | `amount` is zero or negative. |
| 400 | `VaultTokenError::VaultAssetAddressNotSet` | `VaultStorageKey::AssetAddress` is unset on the `Vault::query_asset` read. The constructor sets it, so a deployed vault does not raise it. |

A failed asset transfer carries the asset token's own error code. A missing strategy authorization is a host error.

## Event

| Event | Topics, in order | Data map |
| --- | --- | --- |
| `StrategyWithdraw` | `"strategy_withdraw"`, `strategy: Address` | `amount: i128` (token-dec) |

The data is a map keyed by field name. `strategy` is the registered strategy, which is also the recipient of the assets. The vault publishes the event after the transfer returns. The asset token publishes its own transfer event during the transfer, so that event comes first.

## The backing per share falls with the balance

A redemption prices against `StrategyVault::effective_assets`. That value is `Vault::total_assets`, the vault's live asset balance in token-dec, less the `net_pnl` mark the market supplies (token-dec, signed). `StrategyVault::shares_to_assets` converts shares to assets against that backing and floors the result. [Share pricing](./share-pricing.md) gives the conversion, its formulas F1 to F4, and every variable in them.

`strategy_withdraw` lowers `Vault::total_assets` by `amount` and leaves the share supply at its previous value. At a fixed `net_pnl` the backing falls by `amount`, so the same shares redeem for fewer assets.

The rows below use a vault with a `decimals_offset` of 0, so share-dec equals token-dec. The vault holds 1000.0 of the asset against 1000.0 shares, and a holder redeems 100.0 shares. The draw is 200.0.

| State | `total_assets` | `net_pnl` | Assets paid for 100.0 shares |
| --- | --- | --- | --- |
| Before the draw, mark at 0 | 1000.0 | 0 | 100.0 |
| Before the draw, 200.0 of pending profit in the mark | 1000.0 | 200.0 | 80.0 |
| After the draw, mark cleared | 800.0 | 0 | 80.0 |

The third row equals the second because the payout settles the profit that the mark already counted. The first row applies when the mark has not counted that profit. Then the draw lowers the redemption value from 100.0 to 80.0.

The market supplies `net_pnl` from `Market::capped_net_pnl`, and only two paths call it. `fill_deposit` calls it with `maximize` set to `false`, and `fill_redeem` calls it with `maximize` set to `true`. A redeem on a `Retired` market runs `instant_redeem` and passes a `net_pnl` of 0, so that path never calls `Market::capped_net_pnl`. `Market::capped_net_pnl` caps the mark that each side of the book adds to `net_pnl`, as [PnL and the profit cap](../market/pnl-calculation.md) defines. [Fees and settlement](../market/fee-system.md) gives the settlement legs that move the balance.

## What a withdrawal means for a shareholder

Each draw lowers the balance that backs the shares. The share price falls only if the mark has not already counted the profit that the draw pays out. A redemption after the draw prices against the lower balance and the mark of its own fill.
