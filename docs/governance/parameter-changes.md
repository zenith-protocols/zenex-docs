---
sidebar_position: 2
title: Parameter Changes
---

# Parameter Changes

All parameter updates on Zenex follow a structured timelock process. This ensures that changes are publicly visible before they take effect, giving traders and vault depositors the opportunity to review, prepare, and respond.

## The Timelock Flow

Parameter changes follow three sequential steps.

1. **Queue.** The protocol owner submits a transaction that records the proposed change on-chain. The change includes the new parameter values and is visible to anyone inspecting the contract state. At this point, nothing has changed about the protocol's behavior. The existing parameters remain in effect.

2. **Wait.** A mandatory delay period must pass before the change can be applied. During this window, users can review the proposed values, assess how the change would affect their positions or vault deposits, and take any action they consider appropriate. The delay is configurable but is always at least one second. Changing the delay period itself is also subject to the timelock, preventing the owner from shortening the delay without notice.

3. **Execute.** After the delay period has elapsed, anyone can submit a transaction to apply the queued change. Execution is permissionless. The owner does not need to be the one who triggers it. Once executed, the new parameter values take effect immediately.

The owner can cancel a queued change at any time before it is executed. This allows the team to withdraw a proposal if community feedback reveals concerns or if circumstances have changed since the change was queued.

## Expiration

Queued changes do not persist indefinitely. If a queued change is not executed within approximately 100 days of being queued, its on-chain storage expires and the change is lost. To apply it after expiration, the owner would need to queue it again, restarting the full timelock process. This expiration prevents stale parameter changes from being unexpectedly applied long after they were proposed.

## What Parameters Exist

Zenex has two categories of configurable parameters, and both follow the same timelock process.

Global trading parameters apply across all markets. These include the base fee rates for the dominant side and the non-dominant side, the global base borrowing rate and variable borrowing rate, the funding rate, the caller rate that determines keeper compensation, the minimum and maximum notional position sizes, and the global utilization cap. Adjusting any of these affects every market on the protocol.

Per-market parameters are configured individually for each trading pair. These include whether the market is enabled, the margin requirement (which determines maximum leverage), the liquidation fee threshold, the price impact divisor, the per-market variable borrowing rate, and the per-market utilization cap. These parameters let the protocol fine-tune risk and fee settings for each asset based on its volatility, liquidity, and trading characteristics.

For details on what each parameter controls, see the [Market Parameters](../markets/market-parameters.md) page.
