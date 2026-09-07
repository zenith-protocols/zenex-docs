---
sidebar_position: 1
title: Oracle
---

# Oracle

Zenex prices markets with [Chainlink Data Streams](https://docs.chain.link/data-streams). The `Oracle` contract turns a signed Data Streams report into verified, stream-scoped `PriceData` for the market contract. DON signature checking is delegated to Chainlink's deployed verifier contract, whose address is pinned at construction and has no setter. The oracle decodes the returned report body and enforces every protocol gate on top: stream identity, schema version, the report's own validity window, two-sided staleness, price sanity, and spread reduction.

## PriceData Structure

A verified report produces one `PriceData` carrying the two sides of the quote. The report's benchmark price is sanity-checked but never returned. Consumers mark off `bid` and `ask`:

```rust
pub struct PriceData {
    pub bid: i128,          // best bid, after spread reduction
    pub ask: i128,          // best ask, same precision as bid
    pub publish_time: u64,  // observation timestamp (unix seconds)
}
```

There is no `feed_id` echo and no exponent: the caller passes its anchor *in* and the oracle traps on a mismatch, so the return never needs to repeat it, and prices stay in the feed's native precision throughout.

Report price words carry feed-native precision (18-decimal on most V3 crypto streams, 8-decimal on some), and precision cancels through consumer accounting (`tokens = notional * 1e18 / price`, backed out at the same scale), which holds as long as one market's prices all come from one stream. The caller's `feed_id` anchor is what pins that. The market contract uses `bid` and `ask` for direction-aware entry and exit (see [Pricing](../market/pricing.md)).

## Verification Flow

```rust
pub fn verify_price(env: Env, report: Bytes, feed_id: BytesN<32>, protective: bool) -> PriceData
```

The `report` blob is handed to the Chainlink verifier verbatim, exactly as fetched from the Data Streams API, with the oracle's own address as the verifier's `sender`. That contract checks the report's DON signatures against its registered config and returns the raw report body. It checks signatures and config activity only, so every freshness and sanity check is the oracle's own. A verifier rejection traps and fails the whole call with the verifier's error code, and there is no fallback price path. `verify_price` is not a view: it bumps this contract's instance TTL and the verifier bumps its own.

`protective` selects which staleness class gates the report's age. Anyone may call `verify_price`, and there is no batch variant: one report, one anchored stream, one `PriceData`.

**Report decode.** The verified body must be exactly 288 bytes, the nine 32-byte ABI words of a Data Streams V3 report. Every word is parsed, including the fee words, and non-zero padding in a word narrower than 32 bytes is a decode failure.

| Word | Field | Width | Notes |
|---|---|---|---|
| 0 | `feedId` | `bytes32` | must equal the caller's anchor, and its first two bytes must be `0x0003` (the V3 schema pin) |
| 1 | `validFromTimestamp` | `uint32` | seconds |
| 2 | `observationsTimestamp` | `uint32` | seconds, becomes `publish_time` |
| 3, 4 | `nativeFee`, `linkFee` | `uint192` | kept at full 24-byte width, inert under subscription billing |
| 5 | `expiresAt` | `uint32` | seconds |
| 6 | `benchmarkPrice` | `int192` | validated, not returned |
| 7, 8 | `bid`, `ask` | `int192` | the returned quote sides |

A `uint32` word must be zero above its low 4 bytes and a `uint192` word zero above its low 24, else `InvalidData` (780). An `int192` price word is read as a big-endian `i128` from its low 16 bytes, and its top 16 bytes must be the sign extension of that value, so a magnitude wider than `i128` raises `InvalidPrice` (781).

**Gates.** In order, each a trap: stream mismatch against the caller's anchor, a non-V3 stream id, a validity window opening more than the forward allowance ahead of the ledger clock, a ledger clock past `expiresAt`, an observation older than the selected class window, an observation more than the forward allowance ahead, and a non-positive benchmark, bid, or ask, or a crossed `bid > ask`. See [Error Codes](#error-codes). Every comparison is strict, so an age of exactly the window and a forward skew of exactly the allowance both pass.

## Two-Tier Staleness

Two windows are stored, both in whole seconds. The strict `trade_staleness` bounds report age on order fills, the wider `close_staleness` bounds it on the gap-closing calls (liquidation, ADL, accrual), so a report gap that outlasts the fill window never freezes the routes that protect vault solvency.

| Bound | `protective = false` | `protective = true` |
|---|---|---|
| Observation age | `trade_staleness` | `close_staleness` |
| Forward allowance, on both `validFrom` and the observation | `trade_staleness` | `trade_staleness` |

Only the past side widens. Forward skew is ledger-clock lag, identical on every route, and pinning the forward allowance to the trade window keeps a protective call from accepting a future-stamped price that would then substitute into a strict fill. The class is fixed per route by the market contract, never chosen by the caller of a market entry point.

## Spread Reduction

`spread_reduction_factor` narrows the quote symmetrically toward the bid/ask midpoint, applied after every gate so the gates see raw report values. It is `SCALAR_18`-scaled, not basis points: `0` is a bit-for-bit identity, `SCALAR_18` collapses both sides onto the midpoint, and an intermediate value removes that fraction of the half-spread from each side. Both the half-spread and the cut floor, so the two sides move by the same amount and can never invert. The multiplication widens through I256, so an 18-decimal BTC-scale price cannot overflow.

## Access Control

The oracle implements OZ Ownable. For standard Ownable behavior, refer to [OpenZeppelin Stellar Contracts](https://github.com/OpenZeppelin/stellar-contracts).

| Function | Auth |
|---|---|
| `verify_price` | Permissionless |
| `verifier` / `trade_staleness` / `close_staleness` / `spread_reduction_factor` | Permissionless (views) |
| `update_staleness` | Owner only (`#[only_owner]`) |
| `update_spread_reduction_factor` | Owner only |
| `upgrade` | Owner only (`operator` must be the owner, else `UpgradeNotOwner`, 600) |

Configuration power is exactly two parameters, each bounded by a compile-time constant. `update_staleness` sets both windows in one atomic call, so the ordering rule is always checked against the values that will be stored. The owner can also `upgrade` the contract WASM in place (storage preserved), but cannot change the verifier address, cannot change the accepted stream (the anchor comes from the caller), and cannot pause. The verifier is the root of trust, and Chainlink ships its own upgrades in place with the address preserved, so with the address pinned no owner key can redirect pricing; a verifier migration means a new oracle and market deployment. `verify_price` publishes nothing: prices are returned as a value. The two owner-settable gates are chain-attested, with `update_staleness` emitting a `staleness_update` event (`trade_staleness`, `close_staleness`) and `update_spread_reduction_factor` emitting a `spread_reduction_update` event (`spread_reduction_factor`).

## Bounds and Constants

The constructor and `update_staleness` both enforce the ordering `MIN_STALENESS_SECONDS <= trade_staleness <= close_staleness`, with equality allowed on every bound and each end held by the constant below, raising `InvalidStaleness` (783) on a violation and `InvalidSpreadReduction` (785) for a `spread_reduction_factor` outside `[0, SCALAR_18]`.

| Constant | Value | Meaning |
|---|---|---|
| `MIN_STALENESS_SECONDS` | 3 | floor on both windows |
| `MAX_TRADE_STALENESS_SECONDS` | 15 | ceiling on `trade_staleness` |
| `MAX_CLOSE_STALENESS_SECONDS` | 120 | ceiling on `close_staleness` |
| `SCALAR_18` | 1e18 | scale of `spread_reduction_factor` |

## Storage

All four entries live in instance storage and are written at construction.

| Key | Type | Meaning |
|---|---|---|
| `Verifier` | `Address` | Chainlink Data Streams verifier, write-once |
| `TradeStaleness` | `u64` | strict window, seconds |
| `CloseStaleness` | `u64` | protective window, seconds |
| `SpreadReductionFactor` | `i128` | `SCALAR_18`-scaled |

Every state-touching entry point extends the instance TTL by roughly 31 days against a 30-day threshold. The four views are TTL-neutral.

## Error Codes

| Code | Name | Meaning |
|---|---|---|
| 780 | `InvalidData` | Body is not 288 bytes, a word carries non-zero padding, or the stream id is not V3 |
| 781 | `InvalidPrice` | Non-positive benchmark, bid, or ask, a crossed book, or a price magnitude wider than `i128` |
| 782 | `PriceStale` | Observation older than the selected class window |
| 783 | `InvalidStaleness` | Staleness pair violates its bounds or its ordering |
| 784 | `ReportExpired` | Ledger clock has passed the report's `expiresAt` |
| 785 | `InvalidSpreadReduction` | Factor outside `[0, SCALAR_18]` |
| 790 | `FeedMismatch` | Report's stream id differs from the caller's anchor |
| 793 | `PriceAhead` | Validity window or observation sits more than the forward allowance ahead of the ledger clock |
