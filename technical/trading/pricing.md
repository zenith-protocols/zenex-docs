---
sidebar_position: 2
title: Pricing
---

# Pricing

Every price-bearing call carries a signed Pyth Lazer payload that the [price verifier](../price-verifier/overview) validates and decodes into a `PriceData` value. The trading contract uses that value for entry, exit, mark, and liquidation.

## Price Attached at Submission

Calls that require user authorization (`open_market`, `close_position`, `modify_collateral`) sign over every argument *except* the price blob (`require_auth_for_args` covers the rest). A backend submitting the transaction can attach a different, fresher Pyth payload between signing and inclusion. Two reasons this matters:

- **Slow signing flow.** The cryptography itself is fast, but the user interaction wrapped around it (password entry, button presses on a hardware wallet, biometric confirmation for a passkey) takes seconds. The market keeps moving during that time, so locking the price at signing time would force stale fills or repeated re-signing.
- **Submission timing.** A backend co-located with a fast RPC node lands transactions sooner than a user's browser ever could. Letting that backend refresh the price means the latency advantage shows up as a fresher fill for the user.

The verifier still checks signature, confidence, staleness, and feed-ID match on whatever payload the backend attaches, so the backend can only pick among valid signed prices, not invent one.

## User-Signed Bounds

The backend's freedom to swap prices has limits. Without further protection, the user's signature on its own no longer pins the trade to a moment in time or to a price range. A backend holding the signed payload could replay it once the market has moved against the user, or attach the worst valid price within the staleness window. Two bounds the user signs over close that gap:

| Bound | Applies to | Effect |
|---|---|---|
| `expiration_ledger` | `open_market`, `close_position`, `modify_collateral` | Reverts with `Expired` (760) once the current ledger exceeds the user's deadline |
| `price_bound` | `open_market`, `close_position` | Reverts with `PriceSlippage` (712) when the fill price falls outside the user's direction-aware bound |

`price_bound` is always oriented to protect the user against an unfavorable move:

| Call | Direction | Bound type | Reverts when |
|---|---|---|---|
| `open_market` | Long | Ceiling (upper) | `fill_price > price_bound` |
| `open_market` | Short | Floor (lower) | `fill_price < price_bound` |
| `close_position` | Long | Floor (lower) | `fill_price < price_bound` |
| `close_position` | Short | Ceiling (upper) | `fill_price > price_bound` |

When the user is paying for size (open long, close short) the bound is a ceiling. When the user is receiving (open short, close long) the bound is a floor.

`modify_collateral` carries `expiration_ledger` but not `price_bound`. The only price-dependent check on that call is the margin requirement on a withdrawal, which fails one-sidedly, so a slippage bound is not needed.

Both bounds accept `0` to disable the check. The opt-out exists for internal callers (smart-account batches, deploy-time scaffolding) that have their own intent-binding mechanisms.
