---
sidebar_position: 2
title: Trading Integration
---

# Trading Integration

The price verifier is consumed exclusively by the trading contract. Every action that depends on a current market price, whether initiated by a user, a keeper, or the circuit breaker, routes through the same `PriceVerifierClient::verify_prices` cross-contract call.

## User Actions

For `open_market`, `close_position`, and `modify_collateral`, the user submits raw price data (`Bytes`) as a parameter alongside the request. The trading contract calls `PriceVerifierClient::verify_price(price_data)`, which returns the parsed and authenticated `PriceData`. The contract then verifies that `feed_id` matches the position's market. Staleness is enforced by the price verifier using its configured `max_staleness` threshold. If the price is too old or the feed does not match, the transaction is rejected.

### Auth Scope Excludes the Price Blob

User auth on the three price-dependent entry points is bound via `require_auth_for_args` to a payload that **excludes** the price `Bytes` argument. The user signs over `(user, market_id, collateral, notional, ..., price_bound, expiration_ledger)` but not the price itself. This is the one logic change that lets a backend submitting the transaction inject the freshest oracle payload at inclusion time without invalidating the user's signature. The signed payload would otherwise pin the user to whatever price was current at signing time, which becomes stale during transit.

The user is protected against price manipulation by the `price_bound` slippage guard and `expiration_ledger` deadline, both of which **are** part of the signed payload. See [Position Lifecycle: Slippage and Expiration](../trading/position-lifecycle.md#slippage-and-expiration) for the direction-aware bound semantics. The price verifier still enforces signature, confidence, staleness, and feed-ID matching, so the backend's only freedom is to pick which valid signed price to attach.

## Keeper Batch Execution

The `execute` function processes a batch of requests for a single `market_id`. It calls `PriceVerifierClient::verify_price(price_data)` (singular) once at the start of the batch, which returns a single `PriceData`. This one verified price is then passed to all positions in the batch, since all positions share the same feed for the given market. Staleness is enforced by the price verifier using the same `max_staleness` threshold.

## Circuit Breaker and ADL

For `update_status`, prices are verified and used to compute aggregate PnL across all markets. Accurate prices are critical here because the aggregate PnL determines whether the contract enters the `OnIce` state or triggers auto-deleveraging.

## Wire Format

The binary format is Pyth Lazer's native encoding. Maximum buffer size is 2048 bytes.

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
