---
sidebar_position: 2
title: Parameter Changes
---

# Parameter Changes

Each Zenex deployment has configurable parameters that control fees, rates, leverage limits, and market behavior. How these parameters are changed depends on the governance model chosen by the deployment owner.

## Direct Ownership

When the trading contract is owned directly by an address or multisig, the owner can update parameters immediately by calling the contract's configuration functions. This is the simplest model and is appropriate for deployments where the owner is trusted or where fast iteration is needed.

## Timelock Governance

For deployments that prioritize transparency, Zenex provides an optional governance contract with a built-in timelock. When the trading contract is owned by this governance contract, parameter changes follow three sequential steps.

1. **Queue.** The governance owner submits a transaction that records the proposed change on-chain. The change is visible to anyone inspecting the contract state. The existing parameters remain in effect.

2. **Wait.** A mandatory delay period must pass before the change can be applied. During this window, users can review the proposed values and take any action they consider appropriate. The delay is configurable but is always at least one second. Changing the delay period itself is also subject to the timelock.

3. **Execute.** After the delay period has elapsed, anyone can submit a transaction to apply the queued change. Execution is permissionless. The governance owner does not need to be the one who triggers it.

The governance owner can cancel a queued change at any time before it is executed. Queued changes have a limited lifetime: they expire after twice the delay period (with a minimum of one day). If a queued change is not executed before it expires, it must be re-queued.

## What Parameters Exist

Zenex has two categories of configurable parameters.

Global trading parameters apply across all markets. These include the base fee rates for the dominant and non-dominant sides, the global base borrowing rate and variable borrowing rate, the funding rate, the caller rate that determines keeper compensation, the minimum and maximum notional position sizes, and the global utilization cap.

Per-market parameters are configured individually for each trading pair. These include whether the market is enabled, the margin requirement (which determines maximum leverage), the liquidation threshold, the price impact divisor, the per-market variable borrowing rate, and the per-market utilization cap.

For details on what each parameter controls, see the [Market Parameters](../markets/market-parameters.md) page.
