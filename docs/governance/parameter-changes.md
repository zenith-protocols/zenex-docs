---
sidebar_position: 2
title: Parameter Changes
---

# Parameter Changes

Each Zenex market is a standalone trading contract with a configurable set of parameters that control fees, interest curves, leverage limits, and lifecycle behavior. Because every market is its own contract, parameter changes are **per market**. How those changes are applied depends on the governance model the market owner has chosen.

## Direct Ownership

When the trading contract is owned directly by an address or multisig, the owner can update parameters immediately by calling the contract's configuration entry point. This is the simplest model and is appropriate for markets where the owner is trusted or where fast iteration is needed. A change to the borrowing parameters is paired with a same-ledger interest accrual, so switching rates never skips or double-counts accrued borrowing interest.

## Timelock Governance

For markets that prioritize transparency, Zenex provides an optional governance contract with a built-in timelock. When the trading contract is owned by this governance contract, parameter changes follow three sequential steps.

1. **Queue.** The governance owner submits a transaction that records the proposed change on-chain. The change is visible to anyone inspecting the contract state. The existing parameters remain in effect.

2. **Wait.** A mandatory delay period must pass before the change can be applied. During this window, users can review the proposed values and take any action they consider appropriate. The delay is configurable but is always at least one second. Changing the delay period itself is also subject to the timelock.

3. **Execute.** After the delay period has elapsed, anyone can submit a transaction to apply the queued change. Execution is permissionless. The governance owner does not need to be the one who triggers it.

The governance owner can cancel a queued change at any time before it is executed. Queued changes have a limited lifetime: they expire after twice the delay period (with a minimum of one day). If a queued change is not executed before it expires, it must be re-queued.

## What Can Be Changed

A market owner acts through three entry points, each governing a different kind of change.

**Configuration** replaces the market's full parameter set: the skew-split trade fee rates, the impact fee divisor, the keeper rate, the position size bounds and open-interest ceiling, the order dust floors, the initial and maintenance margins (which set the leverage envelope), the liquidation fee, the notional lock, the utilization caps, and the borrowing and funding curves. Every one of these is set per market by governance.

**Status** moves the market through its lifecycle: normal trading, paused openings, an emergency freeze, a delist wind-down, or final retirement. The status is the only lever that can always be pulled immediately, even under a timelock.

**Terminal price** sets the flat settlement price used to wind down a delisted market once its grace window has passed.

For details on what each parameter controls, see the [Market Parameters](../markets/market-parameters.md) page. For the lifecycle states, see [Markets Overview](../markets/overview.md).
