---
sidebar_position: 3
title: Position Lifecycle
---

# Position Lifecycle

A position in Zenex is **netted**: each `(user, is_long)` pair has at most one position, stored under the `Position(Address, bool)` key. An Increase order grows the position on its side, a Decrease shrinks it, and a fully closed position is a zeroed row. Position state changes only when a keeper fills an order at a verified price. Order creation escrows funds and prepares storage but does not touch the position's size or margin.

## The Position Row

`Position` carries:

| Field | Meaning |
|---|---|
| `margin` | Posted margin (token-dec) |
| `notional` | Size in quote terms (token-dec) |
| `tokens` | Size in base terms (base-dec). Implied entry price = `notional / tokens` |
| `funding_idx`, `borrowing_idx` | Accrual index snapshots at the last change |
| `locked_notional`, `unlocks_at` | Notional locked against decreases, and its deadline |
| `priced_at` | `publish_time` of the last fill's price, the floor for a later fill or force-close |
| `decrease_orders` | Ids of the pending decrease orders resting on this side, at most 8 |

Zero `notional` means no open position. The zeroed row is the canonical closed state, returned by `get_position` when nothing is open on that side. PnL is **not stored**: it is implied from `tokens`, `notional`, and the current price (see [PnL Calculation](./pnl-calculation.md)).

## Orders

A trader creates an order with `create_order(user, is_long, kind, notional, margin, trigger_price, price_bound, expiration)`, which returns the allocated order id (`u32`). The order is price-free and authorized by the trader's own signature.

- `kind` is a `u32` discriminant selecting one of six order kinds. An unknown discriminant raises `UnknownKind` (734).

| `kind` | Name | Behavior |
|---|---|---|
| 0 | MarketIncrease | Grow now, `trigger_price` ignored |
| 1 | LimitIncrease | Grow on favorable crossing |
| 2 | StopIncrease | Grow on adverse crossing |
| 3 | MarketDecrease | Shrink now, `trigger_price` ignored |
| 4 | LimitDecrease | Shrink on favorable crossing (take-profit) |
| 5 | StopDecrease | Shrink on adverse crossing (stop-loss) |

- `notional` and `margin` are non-negative magnitudes, and the kind sets their direction.
- Market kinds fill immediately and ignore `trigger_price`. Trigger kinds (limit and stop) require a positive `trigger_price` (`InvalidOrder` 732 otherwise) and become eligible once the execution-side price crosses it. The cross direction is implied by kind and side: for a long, StopIncrease and LimitDecrease fill at or above the trigger, LimitIncrease and StopDecrease at or below. The directions invert for a short.
- `price_bound` is a one-sided slippage limit (`0` means unbounded).
- `expiration` is a **ledger sequence**. The order is fillable while `ledger_seq <= expiration`.

Creation escrows funds from the trader into the market contract: an Increase transfers `margin + exec_fee`, a Decrease transfers `exec_fee` only. `exec_fee` is the flat keeper execution fee, read from config at creation and copied onto the order row, and it is paid to the keeper on fill.

Three order shapes are valid, all checked at creation: size plus margin, size only, or margin only. A no-op with both zero is rejected with `InvalidOrder` (732). Any moved value below its dust floor (`min_order_notional`, `min_order_margin`) is rejected. An Increase whose `margin + exec_fee` escrow sum overflows is rejected with `InvalidOrder` (732) as well. Negative inputs raise `NegativeValueNotAllowed` (710). An Increase with `notional` above `max_position_notional` raises `NotionalAboveMaximum` (712). An expiration already behind the current ledger raises `OrderExpired` (731). Orders live in persistent user-tier storage, so `expiration` gates fill eligibility only and is decoupled from the entry's storage lifetime. An archived order is restored (keeper-paid) at fill.

Submitting an order creates the target position row (zeroed if none yet) and tops up its TTL on the trader's own transaction, so the keeper's later fill always finds a live row. A Decrease order's id joins the position's `decrease_orders` list, capped at 8 pending Decrease orders per side (`TooManyOrders` 733). A Decrease may be submitted before any position exists on that side. It simply becomes fillable once one does.

`cancel_order(user, id)` removes a resting order and refunds its full escrow (margin and exec fee). `OrderNotFound` (730) if there is nothing to cancel.

## Increase Fill

A keeper fills an Increase through `execute_order`. Size is bought at the **entry** price (`ask` for a long, `bid` for a short). The implied entry blends across successive increases.

The margin escrowed at order creation lands on the position at fill. The margin added is the posted amount minus the settled fees (trade, impact, borrowing, and funding if the position owed any), and the escrowed `exec_fee` is paid to the keeper. Newly added notional is locked against decreases for `notional_lock` seconds, and a further increase folds into the live lock and resets its deadline.

An Increase fill enforces several guards, any of which aborts the fill:

- Initial-margin floor: margin must cover `init_margin * notional`, else `InsufficientMargin` (713).
- Maintenance floor on equity.
- Per-side open interest at or below `max_open_interest`, else `OpenInterestExceeded` (715).
- Per-side reserve at or below `max_util_open * vault_balance / 2` (each side is measured against its own half of the vault), else `UtilizationExceeded` (714). This gate runs after settlement, against the post-fee tracked balance, and only for a size-growing Increase.
- Resulting notional within `[min_position_notional, max_position_notional]`.
- For a size-growing Increase (`notional > 0`), the target side must not be ADL-flagged and the status must accept opens, else `IncreaseHalted` (705). A margin-only Increase skips this gate (and the open-interest and utilization caps), so margin can be added while opens are halted.

## Decrease Fill (Partial)

A partial Decrease shrinks the position and/or withdraws margin. Realized PnL is settled pro-rata at the **exit** price (`bid` for a long, `ask` for a short). The implied entry price is preserved on the remainder.

A realized profit is subject to the [realized-profit haircut](./fee-system.md#realized-profit-haircut). Settled fees and losses come out of the realized profit first, then the surviving margin, never the requested withdrawal, and the margin floors at zero with any excess reported as `bad_debt`. The trade fee legs are re-priced at the fill size, while funding and borrowing are the full accruals on the pre-fill notional and are not prorated to the closed fraction. The fill must leave a valid position (`min_position_notional`, initial and maintenance margin), and it can only touch the **unlocked** fraction of notional, else `NotionalLocked` (721). A liquidatable position cannot be decreased at all (`PositionLiquidatable` 723). Liquidation is its only legal exit.

## Decrease Fill (Full Close)

A Decrease whose `notional` is at or above the position size, or which would leave a remainder below `min_position_notional`, clamps to a **full close** at fill. `i128::MAX` is the conventional full-close signal. `max_position_notional` caps an Increase only. A Decrease is never capped, since it cannot grow the position.

A full close unwinds size, margin, and the lock together. The payout is the post-fee equity floored at zero. Any shortfall past the freed margin becomes `bad_debt`, absorbed by the vault. Full closure also cancels every Decrease order still resting on the side (one `cancel_order` event per order) and adds their escrowed exec fees to the trader's payout. Liquidation, ADL, and delist wind-down run the same closure funnel. A full close is blocked while any locked notional remains (`NotionalLocked` 721).

## Take-Profit and Stop-Loss

TP and SL are ordinary **Decrease orders with a trigger kind**. A take-profit is a `LimitDecrease` (kind 4) and a stop-loss a `StopDecrease` (kind 5), each with a positive `trigger_price`. For a long, a LimitDecrease fills once the exit-side price is at or above the trigger (as profit grows) and a StopDecrease at or below (on the losing side). The directions invert for a short.

## Margin-Only Changes

Adding or removing margin without changing size is just an order with `notional = 0`. An Increase adds the margin escrowed at its creation, while a Decrease withdraws margin (subject to the maintenance and initial-margin floors on the remainder).

## Liquidation and ADL

A position can also be closed by a keeper without the owner's order:

- **Liquidation** force-closes the whole position once equity falls below maintenance margin. See [Liquidation](./liquidation.md).
- **Auto-deleveraging** closes part of a winning position on an ADL-flagged side, or all of it when the requested amount covers the whole position. See [Auto-Deleveraging](./auto-deleveraging.md).

Both run through the same settlement machinery as a Decrease fill and leave a zeroed (liquidation) or reduced or zeroed (ADL, when the requested amount covers the whole position) row, visible in the transaction's ledger entry changes.
