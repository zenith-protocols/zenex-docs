---
sidebar_position: 1
title: Market router
---

# Market router

The router is a stateless contract that runs a list of calls in one invocation and can fill the order that the first call creates. Its symbol is `RouterContract`, and it has seven entry points, four plain and three with a relayer fee. Any invoker may call each of them. The router writes no storage and needs no setup, so one deployed instance serves every market.

| Page | What it holds |
| --- | --- |
| [Batches and fills](./batching.md) | The `Call` struct, the strict and the isolated batch rules, the outcome encoding, the first-call convention, the result vector shape, the two host traps, and `multicall`, `multicall_try`, `create_and_fill`, `create_and_try_fill`. |
| [Fee abstraction](./fee-abstraction.md) | The signed prefix and the unsigned tail, the fee leg and the allowance it wipes, the `fee_collected` event, the fee error codes, the one instance read, and `multicall_with_fee`, `create_and_fill_with_fee`, `create_and_try_fill_with_fee`. |
