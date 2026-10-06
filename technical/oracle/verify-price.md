---
title: Price verification
description: Report decoding, signature verification, freshness gates, spread reduction, and errors.
sidebar_position: 2
---

# Price verification

`verify_price` turns one signed Chainlink Data Streams report into one `PriceData` for one stream. The Chainlink verifier contract checks the report's decentralized oracle network (DON) signatures and returns the raw report body. The oracle decodes that body, runs seven gates over it, and narrows the quote before it returns. Chainlink's verifier does not judge freshness or price sanity, so every such check is the oracle's own.

```rust
pub fn verify_price(
    env: Env,
    report: Bytes,
    feed_id: BytesN<32>,
    protective: bool,
) -> PriceData
```

| Argument | Type | Meaning |
|---|---|---|
| `env` | `Env` | The host environment. Soroban passes it to every contract call. |
| `report` | `Bytes` | The signed report blob, exactly as fetched from the Data Streams API. It is opaque to the oracle and hashed for the memo key. On a memo miss it reaches the verifier byte for byte. |
| `feed_id` | `BytesN<32>` | The caller's stream anchor. It must equal word 0 of the verified body. |
| `protective` | `bool` | Selects the backward staleness window. `false` is the strict class, `true` is the protective class. |

## Authorization

Any account or contract may call `verify_price`, and the call carries no signature from its caller. The verifier's `verify` calls `require_auth` on its `sender` argument, and the oracle passes its own contract address in that argument. A caller key never reaches the verifier.

## Call flow

The call runs six steps in this order:

1. When the remaining instance time to live (TTL) is below the threshold, it extends the instance TTL.
2. It selects the two staleness windows. The [staleness classes](#two-staleness-classes-set-the-windows) section defines the selection.
3. It computes `digest`, the `sha256` of `report`, as a `BytesN<32>`.
4. It reads the memo at `DataKey::VerifiedReport(digest)`. On a hit it uses the stored body and does not call the verifier. On a miss it calls the verifier, stores the returned body under the digest, and uses it.
5. It decodes the body into a `ReportDataV3`.
6. It reads `spread_reduction_factor`, runs the gates over the decoded report, and builds the `PriceData`.

The oracle reaches the verifier through `VerifierClient`, at the address held in `DataKey::Verifier`:

```rust
fn verify(env: Env, signed_report: Bytes, sender: Address) -> Bytes
```

| Argument | Type | Meaning |
|---|---|---|
| `env` | `Env` | The host environment. Soroban passes it to every contract call. |
| `signed_report` | `Bytes` | The `report` argument of `verify_price`, passed on byte for byte. |
| `sender` | `Address` | The account the verifier authorizes. The oracle passes its own contract address. |

The verifier checks DON signatures and config activity, and it returns the raw report body. If either check fails, it traps, and the trap fails the whole `verify_price` call. It authorizes `sender` and extends its own TTLs, so the call carries side effects.

## The verified report memo

`DataKey::VerifiedReport(BytesN<32>)` is a temporary entry keyed by the `sha256` of the signed report blob. Its value is the body the verifier returned, 288 bytes for a V3 report. A hit saves the verifier call.

`verify_price` writes the entry on a miss and does not extend its TTL, so the entry lives for the network minimum lifetime of a temporary entry. When it lapses, the next call with the same bytes is a miss and reaches the verifier again. A lapse is a miss and raises no error.

The key is the digest alone. Neither `feed_id` nor `protective` is part of it, so a strict miss serves a later protective hit, and a protective miss serves a later strict hit. Report bytes that differ in any byte, including an inert word such as a fee, hash to a different digest and are verified separately.

Every gate runs on the hit path and on the miss path, and a hit uses the same windows as a miss. A memoized report that is now stale is rejected with `PriceStale` and no verifier call. The memo write follows the verifier's return, so a verifier trap happens before any entry exists. When a gate rejects a report the verifier accepted, the whole call reverts and takes the fresh memo entry with it.

The memo bounds one replay case. A report whose DON config Chainlink later deactivates stays replayable through the memo while the temporary entry is alive. The verifier's `verify` returns the report body alone, so the digest is the only value the memo can key on. On a protective call, gate 5 ends the replay once the observation is older than `close_staleness`. Gate 6 lets the oracle accept a report while its observation still lies up to `trade_staleness` seconds ahead. A replay can therefore run up to `trade_staleness` plus `close_staleness` seconds after the first acceptance.

## Report decode

The verified body must be exactly `V3_REPORT_LEN`, which is 288 bytes. That is the nine 32-byte big-endian Application Binary Interface (ABI) words of a Data Streams V3 report. A shorter or longer body raises `InvalidData` before any word is read. Every word is parsed into `ReportDataV3`, the fee words included, so the oracle accepts no byte of the body unparsed.

| Word | Field | Wire type | Rust type | Unit or meaning |
|---|---|---|---|---|
| 0 | `feed_id` | `bytes32` | `BytesN<32>` | The stream id. The decoder copies the word whole. Gate 2 checks the V3 schema prefix. |
| 1 | `valid_from_timestamp` | `uint32` | `u64` | Unix seconds. The start of the report's validity window. |
| 2 | `observations_timestamp` | `uint32` | `u64` | Unix seconds. The observation time. It becomes `publish_time`. |
| 3 | `native_fee` | `uint192` | `[u8; 24]` | Inert. Decoded and padding-checked only. |
| 4 | `link_fee` | `uint192` | `[u8; 24]` | Inert. Decoded and padding-checked only. |
| 5 | `expires_at` | `uint32` | `u64` | Unix seconds. The end of the report's validity window. |
| 6 | `benchmark_price` | `int192` | `i128` | Feed precision. Gated, never returned. |
| 7 | `bid` | `int192` | `i128` | Feed precision. |
| 8 | `ask` | `int192` | `i128` | Feed precision. |

Feed precision is the scale the stream publishes. Data Streams V3 reports carry prices as 18-decimal integers, and the oracle passes the values through unrescaled. The [Units](../units.md) page defines the term.

Each wire type has one decode rule, and every byte range below includes both ends.

- A `uint32` word must carry zero in bytes 0 through 27. The decoder reads its value from bytes 28 through 31, big-endian.
- A `uint192` word must carry zero in bytes 0 through 7. The decoder keeps bytes 8 through 31 raw, at their full 24-byte width.
- The decoder reads an `int192` word as an `i128` from bytes 16 through 31. Its expected extension byte is `0xff` when bit 7 of byte 16 is set, and `0x00` otherwise. Every byte from 0 through 15 must equal that byte.

Two decode errors follow from those rules. A wrong body length, or non-zero padding in a `uint32` or a `uint192` word, raises `InvalidData` (780). An `int192` word whose top 16 bytes are not the uniform sign extension of its low half raises `InvalidPrice` (781), because the value overflows `i128`. An all-ones word decodes to -1, and `i128::MAX` and `i128::MIN` decode exactly.

## Seven gates run in a fixed order

`to_price_data` runs the gates over the decoded report, and the first failing gate ends the call. `now_s` is the ledger timestamp in unix seconds. Each timestamp subtraction saturates at zero. `max_staleness` and `max_ahead` are the two windows that the [staleness classes](#two-staleness-classes-set-the-windows) section defines.

| Order | Condition | Result |
|---|---|---|
| 1 | The report's `feed_id` differs from the `feed_id` argument | `FeedMismatch` (790) |
| 2 | `feed_id` bytes 0 and 1 are not `0x00` and `0x03` | `InvalidData` (780) |
| 3 | `valid_from_timestamp - now_s > max_ahead` | `PriceAhead` (793) |
| 4 | `now_s > expires_at` | `ReportExpired` (784) |
| 5 | `now_s - observations_timestamp > max_staleness` | `PriceStale` (782) |
| 6 | `observations_timestamp - now_s > max_ahead` | `PriceAhead` (793) |
| 7 | `benchmark_price <= 0`, `bid <= 0`, `ask <= 0`, or `bid > ask` | `InvalidPrice` (781) |

A report that clears all seven gates reaches spread reduction, and the narrowed quote becomes the `PriceData`. Gate 2 tests the V3 schema prefix because only V3 carries `bid` and `ask` in the nine-word shape the decoder reads.

**Equality passes at every timestamp boundary.** Gates 3 to 6 compare strictly.

- An observation exactly `max_staleness` seconds old passes gate 5.
- An observation exactly `max_ahead` seconds ahead of the ledger clock passes gate 6.
- A `valid_from_timestamp` exactly `max_ahead` seconds ahead of the ledger clock passes gate 3.
- A ledger clock exactly at `expires_at` passes gate 4.

Gate 7 rejects on equality with zero, so a `benchmark_price`, `bid`, or `ask` of exactly `0` raises `InvalidPrice`. Its crossed-book clause is strict, so a report whose `bid` equals its `ask` passes.

## Two staleness classes set the windows

`verify_price` reads `trade_staleness` from instance storage on every call and uses it as `max_ahead`. A protective call also reads `close_staleness` and uses it as `max_staleness`. A strict call uses `trade_staleness` for both. Both windows are `u64` in whole seconds.

| Class | `protective` | Backward window (`max_staleness`) | Forward allowance (`max_ahead`) |
|---|---|---|---|
| Strict, for a fill | `false` | `trade_staleness` | `trade_staleness` |
| Protective, for a call that closes a gap | `true` | `close_staleness` | `trade_staleness` |

Gates 5 and 6 together bound the observation on both sides. Each subtraction saturates at zero, so a call tests only the side the observation falls on. `to_price_data` accepts exactly this closed interval:

```
now_s - max_staleness <= observations_timestamp <= now_s + max_ahead
```

Where:

- `now_s` is the ledger timestamp in unix seconds.
- `observations_timestamp` is word 2 of the report, in unix seconds.
- `max_staleness` and `max_ahead` are the windows in the table, in whole seconds.

The observation may be `max_staleness` seconds behind the ledger clock or `max_ahead` seconds ahead of it, and no further on either side. In the rows below, gates 1 to 4 pass, `now_s` is 1000, `trade_staleness` is 10, and `close_staleness` is 60.

| `observations_timestamp` | Strict call | Protective call |
|---|---|---|
| 1010 | Passes, exactly `max_ahead` ahead | Passes |
| 1011 | `PriceAhead` (793) | `PriceAhead` (793) |
| 990 | Passes, exactly `max_staleness` behind | Passes |
| 989 | `PriceStale` (782) | Passes |
| 940 | `PriceStale` (782) | Passes, exactly `max_staleness` behind |
| 939 | `PriceStale` (782) | `PriceStale` (782) |

`require_valid_staleness` holds `close_staleness` at or above `trade_staleness` on every write, so the protective class accepts every report the strict class accepts. The reverse does not hold. Only the past side widens with the class.

Forward skew exists because the ledger clock trails the report source's clock. That lag does not depend on the class. The forward allowance therefore stays at `trade_staleness` for both classes, and a protective call cannot produce a `publish_time` further ahead of the ledger clock than a strict call could.

## Spread reduction

`reduce_spread` narrows the two sides symmetrically toward their midpoint. It runs after gate 7, so the gates see the raw report values. `reduce_spread` takes the report's `bid` and `ask`, both `i128` in feed precision with `0 < bid <= ask`. It does not read `benchmark_price`. Its third input is `factor`, the stored `spread_reduction_factor`, an `i128` in the range `[0, SCALAR_18]`, where `SCALAR_18` is 10^18. The general branch computes:

```
half_spread = floor((ask - bid) / 2)
cut         = floor(half_spread * factor / SCALAR_18)
result      = (bid + cut, ask - cut)
```

Where:

- `bid` and `ask` are the report's sides, `i128` in feed precision.
- `factor` is `spread_reduction_factor`, on the `SCALAR_18` scale.
- `half_spread` and `cut` are `i128` in feed precision.
- `result` is the pair the oracle returns as `bid` and `ask`, `i128` in feed precision.

The formula moves each side toward the midpoint by the fraction `factor / SCALAR_18` of half the spread, rounded down. Two values take a branch of their own. A `factor` of `0` returns `(bid, ask)` unchanged, bit for bit. A `factor` of `SCALAR_18` returns `(mid, mid)`, where `mid` is `bid + (ask - bid) / 2`.

| `bid` | `ask` | `factor` | `half_spread` | `cut` | Result |
|---|---|---|---|---|---|
| 100 | 105 | 0 | not computed | not computed | (100, 105) |
| 100 | 105 | `SCALAR_18 / 2` | 2 | 1 | (101, 104) |
| 100 | 105 | `SCALAR_18` | not computed | not computed | (102, 102) |
| 100 | 110 | `SCALAR_18 / 4` | 5 | 1 | (101, 109) |
| 100 | 110 | `SCALAR_18 / 2` | 5 | 2 | (102, 108) |

Integer division truncates toward zero, and `ask - bid` is never negative, so both divisions floor. The oracle computes `cut` with `fixed_mul_floor` from `SorobanFixedPoint`. It forms the product in `i128`, and when that multiplication overflows it falls back to a 256-bit product.

`factor` is at most `SCALAR_18`, so `cut` never exceeds `half_spread` and the quotient fits back into `i128`. Both sides move by the same `cut`. For every `factor` in range, `bid + cut <= ask - cut` holds, so the sides never invert.

:::info Raw report prices differ from effective quotes
The oracle applies the configured spread reduction after it validates the report. Its returned bid and ask can differ from the raw report fields.
:::

## The return carries a positive, ordered quote

```rust
pub struct PriceData {
    pub bid: i128,
    pub ask: i128,
    pub publish_time: u64,
}
```

| Field | Type | Unit |
|---|---|---|
| `bid` | `i128` | The bid after spread reduction, in feed precision. It is strictly positive. |
| `ask` | `i128` | The ask after spread reduction, in feed precision. It is at least `bid`. |
| `publish_time` | `u64` | Unix seconds. It equals `observations_timestamp`, word 2, and differs from `valid_from_timestamp`. |

The oracle passes the report's precision through unchanged, so `bid` and `ask` carry the scale of the stream the caller named. Gate 1 traps if the report prices another stream than `feed_id`. Neither an exponent nor a stream id travels in the return. The [Pricing](../market/pricing.md) page describes the market's direction-aware use of `bid` and `ask`.

A returned `PriceData` therefore satisfies `0 < bid <= ask`, and its `publish_time` lies inside the closed interval of the call's class.

## Errors

| Code | Name | Condition |
|---|---|---|
| 780 | `InvalidData` | The verified body is not 288 bytes, a `uint32` or `uint192` word carries non-zero padding, or the stream id is not `0x0003`-prefixed. |
| 781 | `InvalidPrice` | An `int192` word overflows `i128`, a benchmark, bid, or ask is not positive, or `bid > ask`. |
| 782 | `PriceStale` | The observation is older than `max_staleness`. |
| 784 | `ReportExpired` | The ledger clock is past `expires_at`. |
| 790 | `FeedMismatch` | The report prices another stream than the `feed_id` argument. |
| 793 | `PriceAhead` | The validity window opens, or the observation sits, more than `max_ahead` ahead of the ledger clock. |

The oracle raises each code above itself, and the trap ends the whole call. A report the Chainlink verifier rejects on its signatures or its DON config traps inside the verifier. That trap carries the verifier's own error code, which is not an `OracleError`. In both cases the call returns no price.

## Storage and events

`verify_price` touches five `DataKey` entries. Instance storage holds four of them, and the memo sits in temporary storage.

| Key | Tier | Access |
|---|---|---|
| `DataKey::TradeStaleness` | Instance | Read on every call. |
| `DataKey::SpreadReductionFactor` | Instance | Read after the decode, on every call. |
| `DataKey::CloseStaleness` | Instance | Read on a protective call. |
| `DataKey::Verifier` | Instance | Read on a memo miss. |
| `DataKey::VerifiedReport(digest)` | Temporary | Read on every call, written on a memo miss. |

Each call extends the instance TTL when the remaining TTL is below the threshold. The [Constructor and settings](./settings.md) page gives the threshold, the extension, the windows, and the factor.

The verified price reaches the caller as the return value, and `verify_price` publishes no event. Apart from the ownership events of its `Ownable` calls, the oracle publishes events only from its two owner calls. The [Constructor and settings](./settings.md) page covers both.
