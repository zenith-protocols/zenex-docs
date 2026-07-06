---
sidebar_position: 3
title: Position Lifecycle
---

# Position Lifecycle

A position in Zenex is **netted**: each `(user, is_long)` pair has at most one position, stored under the `Position(Address, bool)` key. An Increase order grows the position on its side, a Decrease shrinks it, and a fully closed position is a zeroed row. All state changes happen when a keeper fills an order at a verified price, never at order creation.

## The Position Row

`Position` carries:

| Field | Meaning |
|---|---|
| `collateral` | Posted margin (token-dec) |
| `notional` | Size in quote terms (token-dec) |
| `tokens` | Size in base terms (base-dec); implied entry price = `notional / tokens` |
| `funding_idx`, `borrowing_idx` | Accrual index snapshots at the last change |
| `locked_notional`, `unlocks_at` | Notional locked against decreases, and its deadline |
| `updated_at` | Timestamp of the last fill (anti-replay anchor) |

Zero `notional` means no open position. The zeroed row is the canonical closed state, returned by `get_position` when nothing is open on that side. PnL is **not stored**: it is implied from `tokens`, `notional`, and the current price (see [PnL Calculation](./pnl-calculation.md)).

## Orders

A trader creates an order with `create_order(user, is_long, kind, notional, collateral, trigger_price, trigger_above, price_bound, expiration)`. The order is price-free and authorized by the trader's own signature.

- `kind` is `Increase` or `Decrease`. `notional` and `collateral` are non-negative magnitudes; `kind` sets their direction.
- `trigger_price` is the eligibility trigger (`0` means market, fillable immediately). `trigger_above` selects the cross direction.
- `price_bound` is a one-sided slippage limit (`0` means unbounded).
- `expiration` is a **ledger sequence**. The order is fillable while `ledger_seq <= expiration`.

Three order shapes are valid, all checked at creation: size plus collateral, size only, or collateral only. A no-op with both zero is rejected with `InvalidOrder` (732). Any moved value below its dust floor (`min_order_notional`, `min_order_collateral`) is rejected. Negative inputs raise `NegativeValueNotAllowed` (710). An expiration already behind the current ledger raises `OrderExpired` (731); one beyond the network's storage horizon (`now + max_ttl`) raises `InvalidOrder` (732), since the entry could not outlive its own TTL.

Submitting an order creates the target position row (zeroed if none yet) and tops up its TTL on the trader's own transaction, so the keeper's later fill always finds a live row. A Decrease may be submitted before any position exists on that side; it simply becomes fillable once one does.

`cancel_order(user, id)` removes a resting order. `OrderNotFound` (730) if there is nothing to cancel.

## Increase Fill

A keeper fills an Increase through `execute_order`. Size is bought at the **entry** price (`ask` for a long, `bid` for a short). The implied entry blends across successive increases.

Collateral is drawn from the trader's token allowance at fill. The margin added is the posted collateral minus the settled fees (trade, impact, borrowing, and funding if the position owed any). Newly added notional is locked against decreases for `notional_lock` seconds; a further increase folds into the live lock and resets its deadline.

An Increase fill enforces several guards, any of which aborts the fill:

- Initial-margin floor: collateral must cover `init_margin * notional`, else `InsufficientMargin` (713).
- Maintenance floor on equity.
- Per-side open interest at or below `max_open_interest`, else `OpenInterestExceeded` (715).
- Reserve utilization at or below `max_util_open * vault_balance`, else `UtilizationExceeded` (714).
- Resulting notional within `[min_position_notional, max_position_notional]`.
- The target side must not be ADL-flagged and the status must accept opens, else `IncreaseHalted` (705).

## Decrease Fill (Partial)

A partial Decrease shrinks the position and/or withdraws collateral. Realized PnL is settled pro-rata at the **exit** price (`bid` for a long, `ask` for a short). The implied entry price is preserved on the remainder.

A realized profit is subject to the [realized-profit haircut](./fee-system.md#realized-profit-haircut). Settled fees come out of the trader's proceeds first (the withdrawal, then the realized profit), then the surviving margin. A partial close never runs past the margin, so it produces no bad debt. It must leave a valid position (`min_position_notional`, initial and maintenance margin), and it can only touch the **unlocked** fraction of notional, else `NotionalLocked` (721).

## Decrease Fill (Full Close)

A Decrease whose `notional` is at or above the position size clamps to a **full close** at fill. `i128::MAX` is the conventional full-close signal (the SDK exports it as `FULL_CLOSE`). `max_position_notional` caps an Increase only; a Decrease is never capped, since it cannot grow the position.

A full close unwinds size, collateral, and the lock together. The payout is the post-fee equity floored at zero. Any shortfall past the freed margin becomes `bad_debt`, absorbed by the vault. A full close is blocked while any locked notional remains (`NotionalLocked` 721).

## Take-Profit and Stop-Loss

TP and SL are ordinary **Decrease orders that carry a trigger**, expressed through the same `create_order` fields as any other order. A Decrease with `trigger_price` set becomes eligible only once the execution-side price crosses the trigger: `trigger_above = true` fires when the exit-side price is at or above the trigger, `false` when at or below. The SDK's `placeTakeProfit` and `placeStopLoss` helpers set `trigger_above` for you (a take-profit fires as profit grows, a stop-loss on the losing side).

## Collateral-Only Changes

Adding or removing margin without changing size is just an order with `notional = 0`. An Increase adds collateral (pulled from the allowance); a Decrease withdraws it (subject to the maintenance and initial-margin floors on the remainder). The SDK exposes these as `addCollateral` and `withdrawCollateral`.

## Liquidation and ADL

A position can also be closed by a keeper without the owner's order:

- **Liquidation** force-closes the whole position once equity falls below maintenance margin. See [Liquidation](./liquidation.md).
- **Auto-deleveraging** partially closes a winning position on an ADL-flagged side. See [Auto-Deleveraging](./auto-deleveraging.md).

Both run through the same settlement machinery as a Decrease fill and leave a zeroed (liquidation) or reduced (ADL) row, each paired with a `position_update` event.
