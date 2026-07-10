---
sidebar_position: 2
title: Pricing
---

# Pricing

Prices enter the contract only on **keeper** paths. A trader's order is price-free, and the keeper attaches a serialized Pyth Lazer price update when it fills. Every price-bearing call verifies its bytes against the market's immutable `(feed_id, exponent)` anchors through the [price verifier](../price-verifier/overview), which returns a `PriceData` carrying `feed_id`, `exponent`, `bid`, `ask`, and `publish_time`. The aggregate Pyth price is validated but not returned. Every downstream mark uses `bid` or `ask`.

## Verification on the Keeper Path

The functions that carry a price are `execute_order`, `execute_liquidation`, `execute_vault_order`, `update_adl_state`, `execute_adl`, and `accrue`. Each passes the submitted `Bytes` to the verifier, which:

- delegates signature checking to the Pyth Lazer verification contract,
- confirms the update contains the contract's `feed_id` with the matching `exponent`,
- rejects a malformed feed (missing price, non-positive price, bid, or ask, a crossed `bid > ask`, or a confidence interval wider than the configured tolerance),
- rejects a stale or future-dated update.

Because the anchors are immutable and per-contract, a keeper cannot substitute another market's feed. The keeper's only freedom is to pick which valid, recent signed price to attach. Every price-bearing load accrues borrowing and funding to now before touching a position. Funding advances its index, and on the borrowing side only the dominant token holder's per-side index moves (a token tie charges both), while both accrual timestamps always advance.

## Entry and Exit Use Bid/Ask

Execution is direction- and action-aware, using the two sides of the verified quote:

| Action | Side | Price used |
|---|---|---|
| Increase | Long | `ask` (entry) |
| Increase | Short | `bid` (entry) |
| Decrease / close | Long | `bid` (exit) |
| Decrease / close | Short | `ask` (exit) |

A trader always enters on the worse side of the spread and exits on the worse side, which is the on-chain spread cost. `price_scalar = 10^-exponent` is the divisor that converts an integer quote into price units. Token-decimal scaling in a notional calculation is a separate step through `SCALAR_18`.

## Order-Level Protection

Since a trader signs a price-free order, protection against an unfavorable fill lives in the order's own fields:

| Field | Effect |
|---|---|
| `price_bound` | One-sided slippage limit judged on the execution-side price. A buy leg caps the price (rejects above), a sell leg floors it (rejects below). `0` disables. Violation raises `PriceBoundExceeded` (741). |
| `trigger_price` | Eligibility trigger, also judged on the execution-side price. The crossing direction is implied by the order kind and side: for a long, `StopIncrease` and `LimitDecrease` fill at or above the trigger, `LimitIncrease` and `StopDecrease` at or below, inverted for a short. Market kinds ignore `trigger_price`, and a limit or stop kind with `trigger_price == 0` is rejected at creation with `InvalidOrder` (732). Not crossed raises `TriggerNotMet` (742). |
| `expiration` | Last **ledger sequence** the order is fillable at. Past it, a fill raises `OrderExpired` (731). |

The anti-replay rule ties the price to the order in time: the verified `publish_time` must be at or after the order's `created_at`, else `StalePrice` (740). A market order filling in its own creation ledger is the one exception, an atomic create-and-fill that accepts any verifier-accepted price. A trigger order gets no same-ledger exemption.

A vault-order fill is stricter. The verified `publish_time` must be strictly greater than the vault order's `created_at`, so an atomic create-and-fill can never price the shares, and no older than the market's `last_price_time`, the publish time of the most recent consumed price (advanced monotonically on every store). Either violation raises `StalePrice` (740). Force-close paths (liquidation and ADL) anchor anti-replay to the position instead of an order: the verified `publish_time` must be at or after `position.priced_at`, the publish time of the price the position was last filled against, else `StalePrice` (740).

## Terminal (Flat) Price

A wound-down market can be pinned to a flat settlement price. Once `set_terminal_price` stores a value on a delisted market (allowed after the grace window expires), the market prices flat: `bid = ask = terminal` with `publish_time` reading as now, and submitted price bytes are ignored and never verified. The switch to flat pricing is governed by the **presence of a stored terminal price**, not by the status value itself. Accrual keeps running (borrowing keeps charging) until a terminal price is stored, after which everything prices flat at it. See the [status lifecycle](./storage-and-events.md#status-lifecycle).
