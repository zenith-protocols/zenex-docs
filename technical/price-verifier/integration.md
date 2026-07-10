---
sidebar_position: 2
title: Trading Integration
---

# Trading Integration

The price verifier is consumed exclusively by the trading contract. Only **keeper** paths carry a price: a trader's order is price-free, so the verifier is never touched on `create_order`, `cancel_order`, or `create_vault_order`.

## Keeper Paths

Every price-bearing keeper entry point (`execute_order`, `execute_liquidation`, `execute_vault_order`, `update_adl_state`, `execute_adl`, and `accrue`) passes the keeper's serialized update to `verify_price(update_data, feed_id, exponent)`, using the trading contract's own immutable `(feed_id, exponent)` anchors. The verifier returns a single verified `PriceData` for that feed. Because one trading contract serves one market, exactly one feed is ever requested, and a keeper cannot substitute another market's feed: a mismatch raises `FeedNotFound` (790) or `WrongExponent` (791).

The verifier's own checks (Lazer signature delegation, confidence, bid/ask validity, staleness) are described on the [overview](./overview). The trading contract adds its own anti-replay rules on top, each raising `StalePrice` (740) and each anchored to what the path acts on.

For a trade-order fill (`execute_order`), the verified `publish_time` must be at or after the order's `created_at`. The one exception is an atomic market fill, a market-kind order filled in the same ledger it was created in (`created_at == now`), which skips this check since no earlier-priced ledger sits between creation and fill. Trigger kinds get no exemption. A vault-order fill (`execute_vault_order`) is stricter on both ends: the `publish_time` must be strictly greater than the order's `created_at` (equality rejects) and no older than the market's `last_price_time`, the publish time of the most recent price the market consumed. Because the verifier caps `publish_time` at the ledger time, an atomic create-and-fill can never price a vault order. Force-closes (`execute_liquidation` and `execute_adl`) act on positions, not orders: the `publish_time` must be at or after the position's `priced_at`, the publish time of the price the position was last marked against, with no same-ledger exemption. `update_adl_state` and `accrue` add no anchor of their own beyond the verifier's staleness window. See [Pricing](../trading/pricing.md).

## Terminal Price Bypass

Once a delisted market has a stored terminal price, the trading contract prices flat and does not call the verifier at all: submitted price bytes are ignored. Verification only runs while the market is still marking against its live feed.

## Wire Format

The signed envelope (magic bytes, signature, signer key) is verified by the separate Lazer contract, which returns the inner payload bytes. The price verifier parses that payload:

```text
Payload:
  [0..4]    magic: 0x93C7D375 (LE)
  [4..12]   timestamp: u64 microseconds (LE)
  [12]      channel: u8 (valid values 1..=4, else InvalidChannel 787)
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
  6..11  funding rate / timestamp / interval, market session, EMA fields
  12  feed_update_timestamp (1 exists byte, then u64 LE microseconds; exists byte 0 = absent)
```

All multi-byte integers are little-endian. The property ids are fixed identifiers from the Pyth Lazer protocol. For a Zenex feed, properties `0` (price), `1` (best bid), `2` (best ask), `4` (exponent), `5` (confidence), and `12` (feed update timestamp) must all be present and valid. A feed missing best bid or best ask is rejected with `InvalidPrice` (781), since the bid/ask spread is a distinct signal and is not synthesized from confidence. The verifier converts property 12 from microseconds to unix seconds by integer division (flooring), and that value becomes the returned `publish_time`. An unknown property id raises `InvalidProperty` (788). The remaining layout failures (truncated reads, trailing bytes, a bad magic value, an out-of-range market session) raise the parser errors 784 through 789 listed in the [overview](./overview) error table.
