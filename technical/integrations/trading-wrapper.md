---
sidebar_position: 2
title: The Trading Wrapper
---

# The Trading Wrapper

The `TradingWrapper` is a small Soroban contract that proxies a subset of trading operations on behalf of a user, charging an integrator fee on top of every proxied call. It is published as a separate codebase, deployed once per integrator, and intentionally minimal — the only state it holds is the trading contract address it proxies to, the collateral token address, and the current fee rate. It does not custody positions, does not manage margin, and does not duplicate any logic from the trading contract.

Source: [`zenex-wrapper`](https://github.com/zenith-protocols/zenex-wrapper) (testnet WASM and deployed addresses are listed in the [Contract Addresses](/technical/deployments/contract-addresses) section once a canonical deployment exists).

## Surface Area

The wrapper exposes nine functions. Three of them mirror the trading contract's write functions and are the reason the wrapper exists. The other six are administrative and informational.

| Function | Purpose | Caller |
|---|---|---|
| `open_market` | Opens a market order, charging an integrator fee on top | User |
| `place_limit` | Places a limit order, charging an integrator fee on top | User |
| `close_position` | Closes a position, charging an integrator fee on top | User |
| `set_fee_rate` | Updates the integrator fee rate | Owner |
| `withdraw` | Withdraws accumulated integrator fees | Owner |
| `upgrade` | Upgrades the contract's WASM | Owner |
| `get_fee_rate` | Returns the current integrator fee rate | Anyone |
| `get_trading` | Returns the address of the proxied trading contract | Anyone |
| `get_token` | Returns the collateral token address | Anyone |
| `preview_fee` | Computes the integrator fee for a given notional | Anyone |

The signatures of `open_market`, `place_limit`, and `close_position` exactly match the trading contract's signatures for those methods, so the JavaScript SDK's `placeLimit`, `openMarket`, and `closePosition` operations work against either the wrapper or the trading contract by simply changing the contract address passed to the operation builder.

The wrapper deliberately does **not** proxy `cancel_position`, `modify_collateral`, `set_triggers`, `execute`, `update_status`, or any read methods. Those calls go directly to the trading contract. There is no integrator fee on cancellation, collateral modification, or trigger updates, since charging on those flows would be punitive to users without adding value to the integrator. Reads are pointless to proxy.

## Fee Calculation

The wrapper's fee model is a single rate applied to the position's notional size, in `SCALAR_7` fixed-point units. A `fee_rate` of `10_000` is `0.1%` of notional; a `fee_rate` of `100_000` is `1%`; and so on. The fee is computed at three points: when a market order is opened, when a limit order is placed, and when a position is closed. In all three cases, the calculation is `fee = notional × fee_rate / SCALAR_7`, rounded up.

```rust
let fee = notional_size.fixed_mul_ceil(&e, &fee_rate, &SCALAR_7);
```

Notional was chosen as the basis rather than collateral because notional scales with the size of the user's exposure, which is the natural unit for charging an integrator fee. A user opening a `1,000` USDC position with `10x` leverage has the same notional exposure (`10,000` USDC) as a user opening a `2,000` USDC position with `5x` leverage, and charging both the same fee is the right outcome.

The fee is paid by the user **on top of** the collateral transfer. If the user opens a `1,000` USDC position with a wrapper fee of `1` USDC, the user's wallet is debited `1,001` USDC: `1,000` flows into the trading contract as collateral and `1` flows into the wrapper as the integrator fee. The trading contract is unaware of the integrator fee and treats the trade exactly as if the user had called it directly with `1,000` USDC of collateral.

On close, the fee is computed against the position's stored notional (the value at fill time, modified only by ADL), not against any payout amount. The user pays the close fee from their wallet on top of the collateral transfer, and the trading contract sends the user their full payout (collateral plus PnL net of protocol fees) directly. The wrapper does not intercept the payout.

## Position Identity and Per-User IDs

Position IDs in Zenex are per-user, not global. The trading contract assigns each user a counter, and every position the user opens gets the next sequential ID for that user. This means that across all users, position ID `1` is ambiguous — there is one position ID `1` per user. When the wrapper opens a position on behalf of a user, the trading contract returns the per-user ID for that user, and the wrapper returns it unchanged.

When a user later wants to close that position, they pass `(user, id)` to the wrapper's `close_position`. The wrapper forwards that exact pair to the trading contract, which looks up the position keyed by user. There is no way for one user to close another user's position via the wrapper, because the trading contract enforces per-user lookup at its own boundary. The wrapper does not need to perform an additional ownership check.

## Owner Responsibilities

The wrapper has a single owner, set at construction. The owner can update the fee rate, withdraw accumulated fees, and upgrade the contract. Ownership uses the standard `Ownable` pattern from `stellar-access` with two-step transfer (`transfer_ownership` and `accept_ownership`). The owner can also renounce ownership, which permanently disables `set_fee_rate`, `withdraw`, and `upgrade` — useful when a wrapper is intended to be a final, trust-minimized deployment.

A few practical operational concerns:

- **Withdrawing fees does not affect users.** The wrapper's balance is independent of the trading contract's balance. Users' collateral is never inside the wrapper.
- **The fee rate can be updated mid-flight.** A user who simulates a transaction at one fee rate and submits it after the rate is changed will pay the new rate. Frontends should re-simulate immediately before signing if the rate is volatile.
- **Upgrades preserve state.** The wrapper's storage (trading address, token address, fee rate) survives an upgrade. New WASM can change behavior but cannot retroactively alter accumulated fees or change the trading contract being proxied (because the trading address was set in the constructor and is not exposed via a setter; upgrading does not call the constructor).

## Events

The wrapper emits four events that an indexer can subscribe to:

| Event | Topics | Data | When |
|---|---|---|---|
| `IntegratorFeeCharged` | `user`, `position_id` | `fee`, `fee_rate` | On every `open_market` and `place_limit` |
| `CloseFeeCharged` | `user`, `position_id` | `fee`, `fee_rate` | On every `close_position` |
| `FeeRateUpdated` | (none) | `old_rate`, `new_rate` | When `set_fee_rate` is called |
| `FeesWithdrawn` | `to` | `amount` | When `withdraw` is called |

These events are emitted on top of the trading contract's own events. An integrator who wants to compute their lifetime revenue can sum `IntegratorFeeCharged.fee` and `CloseFeeCharged.fee` over the wrapper's address. Users do not need to subscribe to wrapper events; their position state is fully described by the trading contract's events.

## Limitations

The wrapper is a single-purpose contract. It does not:

- Offer per-user discounts, tiered fee rates, or referral splits. Implementing any of those would require additional logic and storage.
- Provide an on-chain registry of integrators. There is no way to discover the set of deployed wrappers without an off-chain index.
- Enforce a maximum fee rate. The owner can set any non-negative rate. Adding a contract-level cap is a planned follow-up.
- Proxy reads, cancellations, or position modifications. Frontends call the trading contract directly for those.

If you need behavior beyond what the wrapper offers, you can fork it. The contract is small and intentionally simple. Custom forks should preserve the calling conventions of `open_market`, `place_limit`, and `close_position` so that the SDK remains compatible.
