---
sidebar_position: 2
title: Pricing
---

# Pricing

Prices enter the contract only on **keeper** paths. A trader's order is price-free, and the keeper attaches a signed Chainlink Data Streams report when it fills. Every price-bearing call verifies those bytes against the market's immutable `feed_id` anchor through the [oracle](../oracle/overview), which returns a `PriceData` carrying `bid`, `ask`, and `publish_time` (the caller passes its `feed_id` anchor in, and the oracle traps on a mismatch rather than echoing it back). The report's benchmark price is validated but not returned. Every downstream mark uses `bid` or `ask`.

## Verification on the Keeper Path

The functions that carry a price are `execute_order`, `execute_liquidation`, `execute_vault_order`, `update_adl_state`, `execute_adl`, and `accrue`. Each passes the submitted `Bytes` to the oracle, which:

- delegates DON signature checking to Chainlink's deployed verifier contract,
- confirms the report's stream id equals the contract's `feed_id`,
- rejects a malformed report (a non-positive benchmark, bid, or ask, or a crossed `bid > ask`),
- rejects an expired report, an observation older than the call's staleness window, or one stamped ahead of the ledger clock.

The window is the oracle's strict trade staleness on the two fill paths (`execute_order`, `execute_vault_order`) and its wider close staleness on the gap-closing paths (`execute_liquidation`, `execute_adl`, `update_adl_state`, `accrue`), so a report gap that halts fills does not halt the calls that protect vault solvency. Because the anchor is immutable and per-contract, a keeper cannot substitute another market's stream. The keeper's only freedom is to pick which valid, recent signed report to attach.

Each market also caches the newest verified price it has consumed. The cache moves forward only, and on every path except `execute_order` a payload older than the cache is upgraded to the cached mark. Every price-bearing load accrues borrowing and funding to now before touching a position. Funding advances its index, and on the borrowing side only the dominant token holder's per-side index moves (a token tie charges both), while both accrual timestamps always advance.

## Entry and Exit Use Bid/Ask

Execution is direction- and action-aware, using the two sides of the verified quote:

| Action | Side | Price used |
|---|---|---|
| Increase | Long | `ask` (entry) |
| Increase | Short | `bid` (entry) |
| Decrease / close | Long | `bid` (exit) |
| Decrease / close | Short | `ask` (exit) |

A trader always enters on the worse side of the spread and exits on the worse side, which is the on-chain spread cost. A quote's precision cancels through the token accounting, which converts notional to tokens and back at the same fixed scale. Token-decimal scaling in a notional calculation is a separate step through `SCALAR_18`.

## Order-Level Protection

Since a trader signs a price-free order, protection against an unfavorable fill lives in the order's own fields:

| Field | Effect |
|---|---|
| `price_bound` | One-sided slippage limit judged on the execution-side price. A buy leg caps the price (rejects above), a sell leg floors it (rejects below). `0` disables. Violation raises `PriceBoundExceeded` (741). |
| `trigger_price` | Eligibility trigger, also judged on the execution-side price. The crossing direction is implied by the order kind and side: for a long, `StopIncrease` and `LimitDecrease` fill at or above the trigger, `LimitIncrease` and `StopDecrease` at or below, inverted for a short. Market kinds ignore `trigger_price`, and a limit or stop kind with `trigger_price == 0` is rejected at creation with `InvalidOrder` (732). Not crossed raises `TriggerNotMet` (742). |
| `expiration` | Last **ledger sequence** the order is fillable at. Past it, a fill raises `OrderExpired` (731). |

The anti-replay rule ties the price to the order in time: the verified `publish_time` must be at or after the order's `created_at`, else `StalePrice` (740). A market order filling in its own creation ledger is the one exception, an atomic create-and-fill that accepts any oracle-accepted price. A trigger order gets no same-ledger exemption.

A vault-order fill adds a ledger-level rule: the `publish_time` must be at or after the vault order's `created_at` and the fill must land in a strictly later ledger timestamp than the creation, so an atomic create-and-fill can never price the shares. Either violation raises `StalePrice` (740). Every fill and force-close is also floored by `position.priced_at`, the publish time of the price the position was last marked against: a price behind it raises `StalePrice` (740), which keeps the floor monotone.

## Terminal (Flat) Price

A wound-down market can be pinned to a flat settlement price. Once `set_terminal_price` stores a value on a delisted market (allowed after the grace window expires), the market prices flat: `bid = ask = terminal` with `publish_time` reading as now, and submitted price bytes are ignored and never verified. The switch to flat pricing is governed by the **presence of a stored terminal price**, not by the status value itself. Accrual keeps running (borrowing keeps charging) until a terminal price is stored, after which everything prices flat at it. See the [status lifecycle](./storage.md#status-lifecycle).
