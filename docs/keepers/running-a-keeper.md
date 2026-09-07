---
sidebar_position: 3
title: Running a Keeper
---

# Running a Keeper

This page covers the practical details of running a keeper on Zenex. For what keepers are and why they matter, see the [Keepers overview](./overview.md).

## Requirements

Running a keeper requires a few things. You need a Stellar account funded with XLM to cover transaction fees, which are typically fractions of a cent per transaction. You need a machine that can run continuously with reliable connectivity, since keepers must react to price changes quickly. You need access to the market's **Chainlink Data Streams** feed to fetch the same signed price reports the protocol verifies at execution. You do not need any permission or registration: the role is permissionless.

## The Keeper Loop

At a high level, a keeper repeatedly does three things:

1. **Watch for fillable work.** Watch the market contract's events (an order created, a vault order created) and on-chain state (positions, orders, the ADL flags) alongside the live price. Work becomes fillable when a trigger price is crossed, a slippage bound is satisfied, a redeem's cooldown elapses, or a position's equity falls below maintenance.
2. **Fetch a fresh signed price.** Pull a current report for the market's stream. It must be fresh enough to clear the protocol's staleness and anti-replay checks (see below).
3. **Submit the fill.** Call the relevant entry point on the market contract, or batch several through the market-router, naming your reward address as the `keeper`.

Filling an order or a vault order pays you in two parts: the keeper share of the fill's fee, plus the flat execution fee the trader or LP escrowed when the order was created. The execution fee is a flat per-market parameter. Liquidations and ADL closes carry no order and therefore no escrowed execution fee. An ADL close pays only the keeper share of the trade fee, and a liquidation pays the share of the trade fee plus the liquidation fee. Factor this into which work is worth racing for.

## Batching With the Market-Router

The **market-router** is a stateless contract that lets a keeper bundle work into one transaction. Its methods:

- **`multicall`**: run a list of calls in order, all-or-nothing. Any single failure traps the whole batch, so use it when the calls should only land together.
- **`multicall_try`**: run a list of calls in order, isolating each failure. A failing call rolls back only its own effects and the batch continues, reporting per-call outcomes. Use it to sweep many independent fills without one bad target killing the rest.
- **`create_and_fill`**: create an order and fill it atomically (fill-or-kill). A failed fill unwinds the creation and the approval. This is aimed at integrators filling their own users' orders. Setting `keeper` equal to the user round-trips the reward back to the trader.
- **`create_and_try_fill`**: create the order, then attempt an isolated fill. If the fill fails the order simply rests, funded by its escrow, and the attempt reports why.

Any batch of creates and cancels rides `multicall`, so vault orders and cancels need no dedicated entry point. `multicall`, `create_and_fill`, and `create_and_try_fill` each also come in a `_with_fee` variant that collects a transaction fee from the user in a token they choose before the batch runs.

## Liquidations

A position becomes liquidatable when its equity falls below the maintenance margin. Call `execute_liquidation` to force-close it. This is a permissionless race: every keeper can see the same eligible position, multiple may submit at once, and only the first valid transaction to land succeeds. The others are rejected without penalty beyond the small XLM they spend. A healthy position is not liquidatable, so attempting it returns a not-liquidatable error.

## Wind-Down

When a market is **Delisted** and its delist deadline has passed, keepers may force-close any remaining position regardless of health. Once a flat terminal price has been set for the market, every close settles at that stored value and the submitted price bytes are ignored. Until then, closes still price at the verified feed price. A healthy position closed this way keeps whatever equity is left after its costs and the liquidation fee. Use `execute_liquidation` here as well: this is how the book is cleared so the market can eventually retire.

## Anti-Replay and Expiration

Three timing rules shape when a fill is valid.

- **Anti-replay.** The verified price's publish time is checked against a reference time that depends on the work. A trade-order fill needs a price published at or after the order's creation time. A force-close (liquidation or ADL) needs a price published at or after the publish time of the price the position was last filled against. A vault-order fill needs a price published at or after the order's creation time and must land in a strictly later ledger than the creation, so a vault order can never fill in the ledger it was created in. The only same-ledger exemption is a market order (no trigger) filling in its creation ledger. Trigger orders, force-closes, and vault orders get none.
- **Expiration.** An order's expiration is a ledger sequence. The order is fillable only while the current ledger is at or before it. An expired order cannot be filled and should be dropped from your queue.
- **Staleness.** The oracle rejects a report whose observation is older than the window for the call: a strict window for order and vault-order fills (10 seconds on the current testnet deployment, at most 15), and a wider one for liquidations, ADL, and accrual (60 seconds on testnet, at most 120), so a force-close still lands during a feed gap. Fetch a fresh report for each submission rather than reusing a cached one. On every call except a trade-order fill, a report older than the newest price the market has already consumed prices at that cached newer price.

## Getting Started

The `zenex-keeper` reference implementation, written in Rust, and the Zenex TypeScript SDK are the natural starting points for building a keeper. Before relying on either, check that the version you pull matches the deployed contract interface, since the order and price wire formats evolve with the protocol. Start by watching a single market to understand the flow before scaling up.

A sensible build order follows the [role structure](./overview.md#the-liquidator-is-the-base): stand up the liquidator base first, tracking every position and marking it at the live price, and run it as a pure liquidation keeper. The other roles are consumers of that same state, so order filling, vault-order filling, and ADL can each be layered on once the base is solid.
