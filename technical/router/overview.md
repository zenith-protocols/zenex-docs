---
sidebar_position: 1
title: Market router
---

# Market router

The router runs a list of contract calls in one invocation. It can also fill the order that the first call creates. The contract symbol is `RouterContract`, and its whole surface is seven entry points. Any invoker may call each of the seven, and a deployed instance is usable with no setup. The router writes no storage, and each invocation names its own targets, so one instance serves every market. The four plain entry points defer each call's authorization to the call's own target. The three with-fee entry points also take one authorization from `user` over `calls`, `fee_token`, `max_fee_amount`, and `fee_expiration`. The fill leg of the create flows takes no authorization, because the market's `execute_order` is permissionless. The router therefore does only what `user` and each target permit. It declares no error enum. Every contract error code comes from a contract the router calls or from the `stellar-fee-abstraction` library. The router calls each batch target, the market through `execute_order`, and the `fee_token`. The pages below hold the contract surface.

| Page | What it holds |
| --- | --- |
| [Batches and fills](./batching.md) | The `Call` struct, the strict and the isolated batch rules, the outcome encoding, the first-call convention, the result vector shape, the two host traps, and `multicall`, `multicall_try`, `create_and_fill`, `create_and_try_fill`. |
| [Fee abstraction](./fee-abstraction.md) | The signed prefix and the unsigned tail, the fee leg and the allowance it wipes, the `fee_collected` event, the fee error codes, the one instance read, and `multicall_with_fee`, `create_and_fill_with_fee`, `create_and_try_fill_with_fee`. |
