---
sidebar_position: 3
title: Strategy Withdraw
---

# Strategy Withdraw

The vault exposes a single privileged withdrawal path for its trading contract:

```rust
fn strategy_withdraw(e: Env, amount: i128);
```

The vault resolves the registered strategy address from instance storage and transfers `amount` of the underlying asset to it. This is the only way the trading contract pulls tokens from the vault to pay winning traders: trading's settlement layer calls `strategy_withdraw` whenever the vault leg of a settlement is negative. The transfer burns no shares, and it is the only path by which assets leave the vault without a share burn. Because it lowers `total_assets` without changing the share supply, it lowers the share price, which is how trader profits are borne by LPs.

There is no deposit-side counterpart entry point. Assets flow back into the vault by plain token transfer from the trading contract (the vault's fee share and positive settlement legs), raising `total_assets` without minting shares.

## Authorization

The function loads the registered strategy address from instance storage and calls `require_auth` on it, so a call succeeds only when the registered strategy (the trading contract) authorizes it. An unauthorized caller fails Soroban authorization at the host level. There is no dedicated contract error code for it.

## The Trading Contract Is the Immutable Strategy

The strategy address is fixed permanently at construction, for the life of the contract. The vault's only state-mutating entry points are `strategy_deposit`, `strategy_redeem`, and `strategy_withdraw`, and each requires the registered strategy to authorize the call, so the trading contract is the vault's single writer for both share accounting and privileged withdrawals.

If the trading contract must be replaced, a new vault is deployed alongside it as a fresh pair through the factory. This eliminates the class of attacks where an admin or governance process redirects vault withdrawals to a different contract.

## Error Codes

| Error | Code | Trigger |
|---|---|---|
| `InvalidAmount` | 790 | `amount <= 0` |

## Event

Every successful call emits:

```text
StrategyWithdraw { strategy (topic), amount }
```

The `strategy` field is the registered strategy address that received the assets, indexed as a topic for efficient log filtering.
