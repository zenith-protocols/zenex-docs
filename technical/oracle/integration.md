---
sidebar_position: 2
title: Market Integration
---

# Market Integration

The oracle is consumed exclusively by the market contract. Only **keeper** paths carry a price: a trader's order is price-free, so the oracle is never touched on `create_order`, `cancel_order`, or `create_vault_order`.

## Keeper Paths

Every price-bearing keeper entry point passes the submitted report to `verify_price` under the market contract's own immutable 32-byte `feed_id` anchor, and the route decides the staleness class. Because one market contract serves one market and the anchor is immutable, a keeper cannot substitute another market's stream: a mismatch raises `FeedMismatch` (790).

| Entry point | `protective` | Class |
|---|---|---|
| `execute_order`, `execute_vault_order` | `false` | strict `trade_staleness` |
| `execute_liquidation`, `execute_adl`, `update_adl_state`, `accrue` | `true` | wider `close_staleness` |

The oracle's own checks are described on the [overview](./overview). The market contract adds its own anti-replay rules on top, each raising `StalePrice` (740) and each anchored to what the path acts on.

Every fill and force-close is floored by the position's `priced_at`, the publish time of the price the position was last marked against: a verified `publish_time` behind it is rejected, which keeps the floor monotone. A trade-order fill (`execute_order`) additionally requires the `publish_time` to be at or after the order's `created_at`, with one exception for an atomic market fill, a market-kind order filled in the same ledger it was created in (`created_at == now`), since no earlier-priced ledger sits between creation and fill. Trigger kinds get no exemption. A vault-order fill (`execute_vault_order`) requires the `publish_time` to be at or after the order's `created_at` and the fill to land in a strictly later ledger timestamp than the creation, so an atomic create-and-fill can never price shares. `update_adl_state` and `accrue` add no anchor of their own beyond the oracle's window.

## Price Cache

The market keeps the newest verified price it has consumed in a temporary `PriceCache` entry, and the entry only moves forward: a payload newer than the cache advances it, an older but valid payload leaves it untouched. On the routes loaded with `newest_price` (every path except `execute_order`) a payload older than the cache is upgraded to the cached mark, so those calls always act on the freshest price the market has seen. See [Pricing](../market/pricing.md).

## Terminal Price Bypass

Once a delisted market has a stored terminal price, the market contract prices flat and does not call the oracle at all: submitted report bytes are ignored, and the price cache is neither read nor written. Verification only runs while the market is still marking against its live stream.

## Wire Format

The bytes a keeper submits are the Data Streams `fullReport` envelope, passed to the oracle and on to the Chainlink verifier unmodified:

```text
abi.encode(
  bytes32[3] reportContext,   // config digest and epoch/round context
  bytes      reportData,      // the nine-word V3 report body
  bytes32[]  rs,              // DON signature r values
  bytes32[]  ss,              // DON signature s values
  bytes32    rawVs            // packed recovery ids
)
```

The verifier checks the signatures against its registered config and returns `reportData`, the 288-byte body the oracle decodes. Word layout and per-width decode rules are on the [overview](./overview). Everything in the envelope outside `reportData` is the verifier's concern: the oracle neither parses nor trusts it.
