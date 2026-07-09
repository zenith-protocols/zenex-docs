---
sidebar_position: 2
title: Pricing
---

# Pricing

Prices enter the contract only on **keeper** paths. A trader's order is price-free, and the keeper attaches a serialized Pyth Lazer price update when it fills. Every price-bearing call verifies its bytes against the market's immutable `(feed_id, exponent)` anchors through the [price verifier](../price-verifier/overview), which returns a `PriceData` carrying `price`, `exponent`, `bid`, `ask`, and `publish_time`.

## Verification on the Keeper Path

The functions that carry a price are `execute_order`, `execute_liquidation`, `execute_vault_order`, `update_adl_state`, `execute_adl`, and `accrue`. Each passes the submitted `Bytes` to the verifier, which:

- delegates signature checking to the Pyth Lazer verification contract,
- confirms the update contains the contract's `feed_id` with the matching `exponent`,
- rejects a malformed feed (missing price, non-positive price, bid, or ask, a crossed `bid > ask`, or a confidence interval wider than the configured tolerance),
- rejects a stale or future-dated update.

Because the anchors are immutable and per-contract, a keeper cannot substitute another market's feed. The keeper's only freedom is to pick which valid, recent signed price to attach. Both accrual indices advance to now on every price-bearing load.

## Entry and Exit Use Bid/Ask

Execution is direction- and action-aware, using the two sides of the verified quote:

| Action | Side | Price used |
|---|---|---|
| Increase | Long | `ask` (entry) |
| Increase | Short | `bid` (entry) |
| Decrease / close | Long | `bid` (exit) |
| Decrease / close | Short | `ask` (exit) |

A trader always enters on the worse side of the spread and exits on the worse side, which is the on-chain spread cost. `price_scalar = 10^-exponent` is the divisor that converts an integer quote into a `price` value. Token-decimal scaling in a notional calculation is a separate step through `SCALAR_18`.

## Order-Level Protection

Since a trader signs a price-free order, protection against an unfavorable fill lives in the order itself, not in a signed price:

| Field | Effect |
|---|---|
| `price_bound` | One-sided slippage limit judged on the execution-side price. A buy leg caps the price (rejects above), a sell leg floors it (rejects below). `0` disables. Violation raises `PriceBoundExceeded` (741). |
| `trigger_price` + `trigger_above` | Eligibility trigger, also judged on the execution-side price. `0` disables (a market order). Not crossed raises `TriggerNotMet` (742). |
| `expiration` | Last **ledger sequence** the order is fillable at. Past it, a fill raises `OrderExpired` (731). |

The anti-replay rule ties the price to the order in time: the verified `publish_time` must be at or after the order's `created_at`, else `StalePrice` (740). A market order filling in its own creation ledger is the one exception, an atomic create-and-fill that accepts any verifier-accepted price. A trigger order gets no same-ledger exemption.

## Terminal (Flat) Price

A wound-down market can be pinned to a flat settlement price. Once `set_terminal_price` stores a value on a delisted market (allowed after the grace window expires), the market prices flat: `bid = ask = price = terminal`, and submitted price bytes are ignored and never verified. The switch to flat pricing is governed by the **presence of a stored terminal price**, not by the status value itself. Accrual keeps running (borrowing keeps charging) until a terminal price is stored, after which everything prices flat at it. See the [status lifecycle](./storage-and-events.md#status-lifecycle).
