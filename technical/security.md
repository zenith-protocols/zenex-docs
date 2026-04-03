---
sidebar_position: 9
title: Security Considerations
---

# Security Considerations

This page documents design decisions, trade-offs, and areas of interest for security auditors.

## Arithmetic and Precision

### Fixed-Point Math

All financial computations use `soroban-fixed-point-math` with explicit floor or ceiling rounding. Floor rounding (`fixed_mul_floor`, `fixed_div_floor`) is used for PnL calculations and slightly favors the vault on rounding errors. Ceiling rounding (`fixed_div_ceil`) is used for impact fee calculation and rounds up in favor of the protocol.

Two precision scales are used throughout: SCALAR_7 (`10^7`) for token amounts and fee rates, and SCALAR_18 (`10^18`) for funding and ADL indices. The higher precision for funding prevents rounding drift over long accrual periods.

### Overflow Protection

`overflow-checks = true` in the release profile ensures all arithmetic operations panic on overflow rather than wrapping. This provides implicit bounds checking but means extreme parameter combinations could cause unexpected panics.

## Access Control

### Permissionless Keeper Network

The `execute` function requires no authentication. Any address can submit keeper requests and earn the `caller_rate` fee. This is intentional and creates a competitive market for position management. Keeper bots can front-run each other; the first transaction to execute a liquidation or trigger captures the fee.

### Treasury Rate Bounded to 50%

The treasury's `set_rate` function validates that the rate is in `[0, SCALAR_7/2]` (0% to 50%). This prevents a compromised treasury owner from extracting more than half of protocol revenue. The treasury owner should still be a multi-sig or governance contract for defense in depth.

### Factory Immutability

WASM hashes and the treasury address in the factory are immutable post-deployment. This prevents unauthorized contract upgrades but means security fixes require deploying a new factory.

## Position Management

### ADL Lazy Application

ADL modifies market-level aggregates only. Individual position records retain their original `notional`. The effective notional is computed on-the-fly via `effective_notional()`. A position's stored `notional` is unreliable post-ADL without also checking the ADL index. External systems reading position data directly from storage must compute `effective_notional = notional * current_adl_idx / adl_idx`.

### Liquidation Ignores MIN_OPEN_TIME

Liquidation does not enforce `MIN_OPEN_TIME`. A position can be liquidated in the same block it was opened if the entry parameters are at extreme values (e.g., maximum leverage with a volatile market). This is intentional because protecting the vault from insolvency takes priority over the minimum hold time.

## Cross-Contract Interactions

### Settlement Ordering

In keeper batch execution, the trading contract follows a specific ordering. The vault pays first (if it owes money), then all outbound transfers (users, keepers, treasury) are processed, and finally the vault receives last (if it gains). This prevents intra-batch balance shortfalls. If this ordering were reversed, the trading contract might lack sufficient token balance to pay users mid-batch.

### Strategy Withdraw Authorization

The vault's `strategy_withdraw` has two independent authorization layers: Soroban runtime auth (`strategy.require_auth()`) and a contract-level address check (`get_strategy(env) == strategy`). Both must pass. This defense-in-depth approach prevents unauthorized withdrawals even if one layer is compromised.

### Treasury Cross-Contract Call

Every trade makes a cross-contract call to `TreasuryClient::get_rate()`. If the treasury contract is upgraded to a malicious version that reverts or returns extreme values, it could DOS the trading contract or extract excess fees. The treasury address is immutable in the trading contract, and the treasury contract is upgradeable only by its owner.

## Storage TTL Risks

### Position Expiry

Position records use a 45-day TTL. If a position is not accessed for 45+ days, its storage entry could be pruned by the Soroban runtime, making the position unrecoverable. The `UserPositions` entry (100-day TTL) would also need to expire for the position to be fully orphaned. Any interaction with the user's position list bumps the TTL.

### Timelock Queue Expiry

The `GovernanceContract` stores queued updates in temporary storage with a TTL of twice the delay period (minimum 1 day). If the update is not executed before the TTL expires, it is silently lost.

## Circuit Breaker Design

### Hysteresis Band

The 5% gap between `UTIL_ONICE` (95%) and `UTIL_ACTIVE` (90%) prevents rapid oscillation between Active and OnIce states. Without this gap, a market near the threshold could alternate between states on every price update.

### OnIce Restrictions

When `OnIce`, new positions cannot be opened but existing ones can be managed (closed, collateral modified). This allows organic de-risking. Users can close winning positions to reduce the vault's exposure without requiring admin intervention.

## Dependency Considerations

### OpenZeppelin Stellar Contracts

All OZ dependencies use `git = "..."` without pinned revisions or tags:

```toml
stellar-access = { git = "https://github.com/OpenZeppelin/stellar-contracts" }
```

A `cargo update` could incorporate upstream changes. Production deployments should pin to specific commit hashes.

### Soroban SDK

The project uses `soroban-sdk = "25.3.0"` (Stellar Protocol v25). Upgrading the SDK version could affect storage layout, cryptographic primitives, or runtime behavior.
