---
sidebar_position: 1
title: Price Verifier
---

# Price Verifier

Zenex uses [Pyth Lazer](https://pyth.network/) for price feeds. The `PriceVerifierContract` parses and verifies Ed25519-signed binary price updates from the Pyth Lazer network, providing cryptographically authenticated price data to the trading contract.

## PriceData Structure

Each verified price update produces one or more `PriceData` values:

```rust
pub struct PriceData {
    pub feed_id: u32,       // Pyth Lazer feed identifier
    pub price: i128,        // Raw price value
    pub exponent: i32,      // Decimal exponent (e.g., -8)
    pub publish_time: u64,  // Unix timestamp (seconds)
}
```

The price scalar used in downstream computation is derived from the exponent: `price_scalar = 10^(-exponent)`. For the standard exponent of `-8`, this yields `price_scalar = 100,000,000`.

## Verification Flow

The contract performs a sequence of checks on every incoming price update before returning parsed data.

Verification begins with **envelope parsing**. The contract reads a fixed-layout binary envelope starting with magic bytes `0x821A01B9`, followed by a 64-byte Ed25519 signature, a 32-byte public key, and a `u16` payload length. If the magic bytes do not match, the update is rejected immediately.

The contract then performs **signer verification**. The public key embedded in the update must match the contract's stored `trusted_signer` exactly. This ensures only Pyth Lazer's authorized key can produce accepted updates.

Next, **signature verification** is performed via `env.crypto().ed25519_verify(pubkey, payload, signature)`, using Soroban's host-provided cryptographic primitives. This confirms the payload has not been tampered with since signing.

With authenticity established, the contract proceeds to **payload parsing**. The payload begins with its own magic bytes (`0x93C7D375`), followed by a microsecond-precision timestamp, a channel byte, a feed count, and per-feed price/exponent/confidence properties.

Finally, a **confidence check** is applied when confidence data is present. If `confidence * 10,000 > |price| * max_confidence_bps`, the contract raises `ConfidenceTooHigh`. This guards against consuming prices with excessive uncertainty relative to the configured tolerance.

## Access Control

The price verifier implements OZ Ownable for access control. For standard Ownable behavior, refer to [OpenZeppelin Stellar Contracts](https://github.com/OpenZeppelin/stellar-contracts).

| Function | Auth |
|---|---|
| `verify_price(update_data)` | Permissionless |
| `verify_prices(update_data)` | Permissionless |
| `max_confidence_bps()` | Permissionless |
| `max_staleness()` | Permissionless |
| `update_trusted_signer(signer)` | Owner only (`#[only_owner]`) |
| `update_max_confidence_bps(bps)` | Owner only |
| `update_max_staleness(max_staleness)` | Owner only |

## Staleness Threshold

The price verifier enforces a single configurable `max_staleness` parameter on all price data. Any price older than `max_staleness` seconds is rejected. The threshold is set at deployment and can be updated by the owner via `update_max_staleness`.

Both the constructor and `update_max_staleness` enforce a hard upper bound of `MAX_STALENESS_SECONDS = 30`. Any attempt to configure a larger value reverts with `InvalidStaleness`. The cap is aligned with the trading contract's `MIN_OPEN_TIME` (30s): a stale price older than that window could in principle be paired with an immediate close, so the verifier refuses to vend prices the trading layer would treat as suspect.

Prices in the future (publish_time > now) are also rejected. This prevents replay of pre-signed future prices.
