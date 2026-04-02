---
sidebar_position: 2
title: Trading Integration
---

# Trading Integration

The price verifier is consumed exclusively by the trading contract. Every action that depends on a current market price, whether initiated by a user, a keeper, or the circuit breaker, routes through the same `PriceVerifierClient::verify_prices` cross-contract call.

## User Actions

For `open_market`, `close_position`, and `modify_collateral`, the user submits raw price data (`Bytes`) as a parameter alongside the request. The trading contract calls `PriceVerifierClient::verify_price(price_data)`, which returns the parsed and authenticated `PriceData`. The contract then verifies that `feed_id` matches the position's market. Staleness is enforced by the price verifier using its configured `max_staleness` threshold. If the price is too old or the feed does not match, the transaction is rejected.

## Keeper Batch Execution

The `execute` function takes a different approach to minimize cross-contract overhead. All price feeds are verified once at the start of the batch by calling `PriceVerifierClient::verify_prices(price_data)`, which returns `Vec<PriceData>`. The results are cached in `ExecuteContext::price_map` as `Map<u32, (i128, i128)>` mapping each `feed_id` to its `(price, price_scalar)` pair. Each request in the batch then looks up its feed from this cached map rather than invoking the verifier again.

This design amortizes the cross-contract verification cost across the entire batch. A single keeper transaction processing 10 fills pays for one verification call, not 10. Staleness is enforced by the price verifier using the same `max_staleness` threshold.

## Circuit Breaker and ADL

For `update_status`, prices are verified and used to compute aggregate PnL across all markets. Accurate prices are critical here because the aggregate PnL determines whether the contract enters the `OnIce` state or triggers auto-deleveraging.

## Wire Format

The binary format is Pyth Lazer's native encoding. Maximum buffer size is 1024 bytes.

```text
Envelope:
  [0..4]    magic: 0x821A01B9 (LE)
  [4..68]   signature: Ed25519 (64 bytes)
  [68..100] pubkey: Ed25519 (32 bytes)
  [100..102] payload_len: u16 (LE)
  [102..]   payload

Payload:
  [0..4]    magic: 0x93C7D375 (LE)
  [4..12]   timestamp: u64 microseconds (LE)
  [12]      channel: u8
  [13]      num_feeds: u8
  [14..]    feeds...

Feed:
  [0..4]    feed_id: u32 (LE)
  [4]       num_properties: u8
  properties...

Property:
  type 0: price (i64 LE, 8 bytes)
  type 4: exponent (i16 LE, 2 bytes, cast to i32)
  type 5: confidence (i64 LE, 8 bytes)
```

All multi-byte integers are little-endian. The envelope is parsed first, its signature verified, and then the payload is decoded to extract individual feed prices. The property types are fixed identifiers defined by the Pyth Lazer protocol.
