---
sidebar_position: 2
title: Running a Keeper
---

# Running a Keeper

This page covers the practical details of running a keeper on Zenex. For what keepers are and why they matter, see the [Keepers overview](./overview.md).

## Requirements

Running a keeper requires a few things. You need a Stellar account funded with XLM to cover transaction fees, which are typically fractions of a cent per transaction. You need a machine that can run continuously with reliable connectivity, since keepers must react to price changes quickly. You need access to **Pyth Lazer** price feeds to obtain the same signed oracle data the protocol verifies at execution. You do not need any permission or registration: the role is permissionless.

## The Keeper Loop

At a high level, a keeper repeatedly does three things:

1. **Watch for fillable work.** Watch the trading contract's events (an order created, a vault order created) and on-chain state (positions, orders, the ADL flags) alongside the live price. Work becomes fillable when a trigger price is crossed, a slippage bound is satisfied, a cooldown elapses, a position's equity falls below maintenance, or an order reaches its expiration.
2. **Fetch a fresh signed price.** Pull a current Pyth Lazer update. The price must be fresh enough to clear the protocol's anti-replay checks (see below).
3. **Submit the fill.** Call the relevant entry point on the trading contract, or batch several through the trading-router, naming your reward address as the `keeper`.

## Batching With the Trading-Router

The **trading-router** is a stateless contract that lets a keeper bundle work into one transaction. Its methods:

- **`multicall`**: run a list of calls in order, all-or-nothing. Any single failure traps the whole batch, so use it when the calls should only land together.
- **`multicall_try`**: run a list of calls in order, isolating each failure. A failing call rolls back only its own effects and the batch continues, reporting per-call outcomes. Use it to sweep many independent fills without one bad target killing the rest.
- **`create_and_fill`**: create an order and fill it atomically (fill-or-kill). A failed fill unwinds the creation and the approval. This is aimed at integrators filling their own users' orders; setting `keeper` equal to the user round-trips the reward back to the trader.
- **`create_and_try_fill`**: create the order, then attempt an isolated fill. If the fill fails the order simply rests with its allowance in place, and the attempt reports why.
- **`create_and_try_fill_vault_order`**: the vault-order equivalent. A locked deposit or redeem just rests until its cooldown elapses, and a redeem on a Retired market pays out immediately at creation.
- **`adl_sweep`**: deleverage a list of targets back to back, isolated, stopping once a target reports that its side has reached the clear target. Pass the maximum close amount to let the contract size each close.

A collateral approval set by the router lasts roughly 120 days.

## Liquidations

A position becomes liquidatable when its equity falls below the maintenance margin. Call `execute_liquidation` to force-close it. This is a permissionless race: every keeper can see the same eligible position, multiple may submit at once, and only the first valid transaction to land succeeds. The others are rejected without penalty beyond the small XLM they spend. A healthy position is not liquidatable, so attempting it returns a not-liquidatable error.

## Wind-Down

When a market is **Delisted** and its delist deadline has passed, keepers may force-close any remaining position regardless of health, at the market's flat terminal price. Healthy positions flow through the soft tier and keep their full equity. Use `execute_liquidation` here as well: this is how the book is cleared so the market can eventually retire.

## Anti-Replay and Expiration

Two timing rules shape when a fill is valid.

- **Anti-replay.** The verified price's publish time must be at or after the target's own timestamp: an order's creation time, or a position's last-change time for a force-close. A stale price is rejected. The one exception is a market order (no trigger) filling in its own creation ledger, which is an atomic create-and-fill and accepts any verifier-accepted price. Trigger orders get no same-ledger exemption.
- **Expiration.** An order's expiration is a ledger sequence. The order is fillable only while the current ledger is at or before it. An expired order cannot be filled and should be dropped from your queue.

## Getting Started

The `zenex-keeper` reference implementation, written in Rust, demonstrates the full loop: price monitoring, condition detection, batch construction, and submission. The Zenex TypeScript SDK provides builders for every keeper entry point and the trading-router methods, plus decoders for the trading contract's events and helpers for reading position, order, and market state. Start by watching a single market to understand the flow before scaling up.
