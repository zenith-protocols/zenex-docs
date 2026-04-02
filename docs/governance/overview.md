---
sidebar_position: 1
title: Governance Overview
---

# Governance Overview

Zenex is controlled by a governance system that balances the need for protocol upgrades with the need for transparency and user protection. All non-emergency parameter changes go through a mandatory delay period, giving users time to review proposed changes and react before they take effect.

## How Governance Works

The protocol is managed by a contract owner who has the authority to propose changes to trading parameters and market configurations. Initially, this owner is the Zenex team. Over time, the plan is to transition ownership to a decentralized governance structure where the community has direct control over protocol decisions.

Rather than allowing the owner to change parameters instantly, Zenex uses a timelock contract. When the owner wants to update a parameter, they first queue the change on-chain. A mandatory delay period must then pass before anyone can execute the queued change. This two-step process ensures that no parameter modification happens without advance public notice. Users can inspect the queued change, evaluate its impact on their positions, and take action if needed, whether that means adjusting their positions, withdrawing from the vault, or voicing concerns to the community.

After the delay period expires, the queued change becomes executable. Execution is permissionless, meaning anyone can submit the transaction to apply the change. The owner does not need to be involved in the second step. If the owner decides a queued change is no longer appropriate, they can cancel it at any time before execution.

## Emergency Actions

Not every situation allows for a waiting period. If the protocol faces an immediate threat, such as an oracle malfunction, a discovered vulnerability, or extreme market conditions, the owner can change the contract's status without going through the timelock. This means the owner can immediately freeze new position openings, pause all trading activity, or restore normal operations as the situation warrants.

This emergency power is deliberately narrow in scope. It applies only to the contract status, not to fee rates, margin requirements, or any other financial parameter. The intent is to provide a circuit breaker that can protect users and the vault during crises, while preventing unilateral changes to the economic rules that govern trading.

## What Can Be Changed

The governance system covers two categories of parameters. Global trading parameters affect the entire protocol and include base fee rates for dominant and non-dominant sides, the global borrowing base rate and variable rate, the funding rate, the caller rate paid to keepers, minimum and maximum notional position sizes, and the global utilization cap. Per-market parameters are configured individually for each trading pair and include the margin requirement (which determines maximum leverage), the liquidation threshold, the price impact divisor, the per-market variable borrowing rate, the per-market utilization cap, and whether the market is enabled or disabled.

## What Cannot Be Changed

Certain core addresses are set at deployment and are permanently immutable. The vault address, the price verifier address, and the treasury address cannot be changed through governance or any other mechanism. These are hardcoded at construction time and remain fixed for the lifetime of the trading contract. This immutability provides a strong guarantee that the fundamental infrastructure of the protocol, where liquidity is held, how prices are verified, and where fees flow, cannot be altered after the fact.
