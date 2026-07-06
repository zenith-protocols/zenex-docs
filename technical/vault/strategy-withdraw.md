---
sidebar_position: 3
title: Strategy Withdraw
---

# Strategy Withdraw

The vault exposes a single privileged withdrawal path for its trading contract:

```rust
fn strategy_withdraw(e: Env, strategy: Address, amount: i128);
```

This is the only way the trading contract pulls tokens from the vault to pay winning traders. Unlike an ERC-4626 `withdraw`, `strategy_withdraw` bypasses share accounting entirely: it transfers the raw collateral amount to the caller without burning any shares. Because it lowers `total_assets` without changing the share supply, it lowers the share price, which is how trader profits are borne by LPs.

## Two-Layer Authorization

Every call passes two independent checks:

- **Soroban auth.** The function calls `strategy.require_auth()`, so the caller must supply a valid authorization entry proving it is who it claims to be.
- **Registered-strategy check.** It compares the provided `strategy` against the address registered at construction. A contract that authenticates but is not the registered strategy is rejected with `UnauthorizedStrategy` (792).

Both must pass. An authenticated non-strategy is rejected, and a claim to be the strategy without authentication is rejected.

## The Trading Contract Is the Immutable Strategy

The strategy address is fixed permanently at construction, for the life of the contract. The same immutability applies to the vault's ERC-4626 mutations: `deposit`, `mint`, `withdraw`, and `redeem` all require the registered strategy to authorize the call (via the `operator` argument threaded from the trading contract), so the trading contract is the vault's single writer for both share accounting and privileged withdrawals.

If the trading contract must be replaced, a new vault is deployed alongside it as a fresh pair through the factory. This eliminates the class of attacks where an admin or governance process redirects vault withdrawals to a different contract.

## Error Codes

| Error | Code | Trigger |
|---|---|---|
| `InvalidAmount` | 790 | `amount <= 0` |
| `UnauthorizedStrategy` | 792 | Caller is not the registered strategy |

## Event

Every successful call emits:

```text
StrategyWithdraw { strategy (topic), amount }
```

The `strategy` field is indexed as a topic for efficient log filtering.
