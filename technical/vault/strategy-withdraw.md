---
sidebar_position: 3
title: Strategy Withdraw
---

# Strategy Withdraw

The vault exposes a privileged withdrawal function exclusively for the trading contract:

```rust
fn strategy_withdraw(e: Env, strategy: Address, amount: i128);
```

This is the only mechanism by which the trading contract can pull funds from the vault when paying profitable traders. Unlike standard ERC-4626 withdrawals, `strategy_withdraw` bypasses share accounting entirely. It transfers the raw collateral token amount directly to the caller without burning any vault shares.

## Two-Layer Authorization

Every call to `strategy_withdraw` must pass two independent authorization checks.

**Soroban auth** is the first layer. The function calls `strategy.require_auth()`, which requires the calling contract to provide a valid Soroban authorization entry. This proves the caller is who they claim to be.

**Contract check** is the second layer. The function reads the registered strategy address from storage and compares it against the provided `strategy` argument: `storage::get_strategy(env) == strategy`. Even if a contract authenticates successfully, the call is rejected unless that contract is the specific trading contract registered at deployment time.

Both checks must pass. A contract that is authenticated but not the registered strategy is rejected. A call that claims to be the registered strategy but lacks authentication is also rejected.

## Immutable Strategy Address

The strategy address is set at construction time and cannot be changed. There is no setter function, no admin override, and no migration path. If the trading contract needs to be replaced, a new vault must be deployed alongside it. This immutability eliminates an entire class of privilege-escalation attacks where an admin or governance process redirects vault withdrawals to a malicious contract.

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
