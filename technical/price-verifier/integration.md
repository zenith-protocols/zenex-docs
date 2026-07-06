---
sidebar_position: 2
title: Trading Integration
---

# Trading Integration

The price verifier is consumed exclusively by the trading contract. Only **keeper** paths carry a price: a trader's order is price-free, so the verifier is never touched on `create_order`, `cancel_order`, or `create_vault_order`.

## Keeper Paths

Every price-bearing keeper entry point (`execute_order`, `execute_liquidation`, `execute_vault_order`, `update_adl_state`, `execute_adl`, and `accrue`) passes the keeper's serialized update to `verify_price(update_data, feed_id, exponent)`, using the trading contract's own immutable `(feed_id, exponent)` anchors. The verifier returns a single verified `PriceData` for that feed. Because one trading contract serves one market, exactly one feed is ever requested, and a keeper cannot substitute another market's feed: a mismatch raises `FeedNotFound` (790) or `WrongExponent` (791).

The verifier's own checks (Lazer signature delegation, confidence, bid/ask validity, staleness) are described on the [overview](./overview). The trading contract adds its own anti-replay rule on top: the verified `publish_time` must be at or after the order's `created_at`, else `StalePrice` (740). See [Pricing](../trading/pricing.md).

## Terminal Price Bypass

Once a delisted market has a stored terminal price, the trading contract prices flat and does not call the verifier at all: submitted price bytes are ignored. Verification only runs while the market is still marking against its live feed.

## Wire Format

The signed envelope (magic bytes, signature, signer key) is verified by the separate Lazer contract, which returns the inner payload bytes. The price verifier parses that payload:

```text
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

Property (id byte, then value):
  0  price          (u64 LE, reinterpreted i64; 0 = absent)
  1  best_bid_price (u64 LE, reinterpreted i64; 0 = absent)
  2  best_ask_price (u64 LE, reinterpreted i64; 0 = absent)
  3  publisher_count (u16 LE)
  4  exponent       (u16 LE, reinterpreted i16)
  5  confidence     (u64 LE, reinterpreted i64; 0 = absent)
  6..12  funding rate / timestamp / interval, market session, EMA fields, feed timestamp
```

All multi-byte integers are little-endian. The property ids are fixed identifiers from the Pyth Lazer protocol. For a Zenex feed, properties `0` (price), `1` (best bid), `2` (best ask), `4` (exponent), and `5` (confidence) must all be present and valid; a feed missing best bid or best ask is rejected with `InvalidPrice` (781), since the bid/ask spread is a distinct signal and is not synthesized from confidence. An unknown property id raises `InvalidProperty` (788).
