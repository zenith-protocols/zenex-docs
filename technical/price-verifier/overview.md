---
sidebar_position: 1
title: Price Verifier
---

# Price Verifier

Zenex prices markets with [Pyth Lazer](https://pyth.network/). The `PriceVerifier` contract turns a signed binary Lazer update into verified, feed-scoped `PriceData` for the trading contract. Signature checking is delegated to a separate Lazer verification contract. The price verifier parses the payload and enforces feed, exponent, confidence, spread, and staleness bounds on top.

## PriceData Structure

A verified update produces `PriceData` values carrying the two sides of the quote. The aggregate Pyth price is validated (positivity, confidence bound) but not returned. Consumers mark off `bid` and `ask`:

```rust
pub struct PriceData {
    pub feed_id: u32,       // Pyth Lazer feed identifier
    pub exponent: i32,      // decimal exponent (e.g. -8)
    pub bid: i128,          // best bid (native precision)
    pub ask: i128,          // best ask (native precision)
    pub publish_time: u64,  // oracle publish timestamp (seconds)
}
```

The trading contract uses `bid` and `ask` for direction-aware entry and exit (see [Pricing](../trading/pricing.md)). The price scalar for downstream math is `price_scalar = 10^(-exponent)`.

## Verification Flow

The verifier runs the following on every call before returning data.

**Signature delegation.** The verifier holds a `lazer` contract address and calls `verify_update` on it, passing the raw update bytes. The Lazer contract checks the update's signature against its trusted-signer set and returns the inner payload bytes. This keeps the signing-key trust and the ECDSA verification in one dedicated contract that the price verifier depends on.

**Payload parsing.** The verifier parses the returned payload (its own magic number, a microsecond timestamp, a channel byte, a feed count, and per-feed properties: price, best bid, best ask, exponent, confidence, and feed update timestamp). An empty feed set is rejected.

**Feed selection.** `verify_price(update_data, feed_id, exponent)` extracts the one requested feed, raising `FeedNotFound` (790) if the update does not contain it and `WrongExponent` (791) if the feed's exponent differs from the caller's anchor. It validates only the requested feed, so an unrelated malformed feed in the same payload does not fail a scoped read. `verify_prices(update_data)` returns every feed in the update, validating and staleness-checking each one (a single malformed feed fails the whole call) and applying no exponent check.

**Per-feed validation.** For each returned feed the verifier requires the price, best bid, best ask, and feed update timestamp to be present, and enforces:

- `price > 0`, `bid > 0`, `ask > 0`: a non-positive wire value is malformed.
- `bid <= ask`: a crossed market is malformed.
- confidence present and non-negative, with `confidence * 10_000 <= |price| * max_confidence_bps`: a spread wider than the configured tolerance is rejected.
- feed update timestamp present: a feed lacking it is rejected, and `publish_time` is derived from it (`t / 1_000_000`).

Any violation raises `InvalidPrice` (781).

**Staleness.** The publish time must not be in the future (`publish_time <= now`) and must be no older than `max_staleness` seconds, else `PriceStale` (782). A future publish time indicates a malformed payload (the oracle publishes before transaction inclusion), and rejecting it also keeps the age subtraction from underflowing.

## Access Control

The price verifier implements OZ Ownable. For standard Ownable behavior, refer to [OpenZeppelin Stellar Contracts](https://github.com/OpenZeppelin/stellar-contracts).

| Function | Auth |
|---|---|
| `verify_price` | Permissionless |
| `verify_prices` | Permissionless |
| `lazer` / `max_confidence_bps` / `max_staleness` | Permissionless (views) |
| `update_lazer` | Owner only (`#[only_owner]`) |
| `update_max_confidence_bps` | Owner only |
| `update_max_staleness` | Owner only |

## Staleness and Confidence Bounds

`max_staleness` is a single configurable threshold applied to every price. It is set at deployment and updatable by the owner, but both the constructor and `update_max_staleness` enforce a hard cap of `MAX_STALENESS_SECONDS = 15`. A larger value reverts with `InvalidStaleness` (783). The cap keeps the verifier from vending a price older than the short window the trading layer is willing to act on.

`max_confidence_bps` bounds the acceptable confidence interval relative to price (for example `100` = 1%). It is likewise owner-updatable, with no code-level cap, and drives the confidence check above.

## Error Codes

| Code | Name | Meaning |
|---|---|---|
| 780 | `InvalidData` | Verified payload contains no feeds |
| 781 | `InvalidPrice` | Missing, non-positive, crossed, or over-confidence feed data |
| 782 | `PriceStale` | Update is future-dated or older than `max_staleness` |
| 783 | `InvalidStaleness` | Configured `max_staleness` exceeds `MAX_STALENESS_SECONDS` |
| 784 | `TruncatedData` | Payload ended before a field could be read |
| 785 | `InvalidPayloadLength` | Trailing bytes remain after the last feed is parsed |
| 786 | `InvalidPayloadMagic` | Payload magic number did not match |
| 787 | `InvalidChannel` | Unknown channel byte |
| 788 | `InvalidProperty` | Unknown feed property id (the parser cannot skip a property of unknown length) |
| 789 | `InvalidMarketSession` | Market session field is invalid |
| 790 | `FeedNotFound` | Requested `feed_id` absent from the update |
| 791 | `WrongExponent` | Feed exponent differs from the caller's scale anchor |
