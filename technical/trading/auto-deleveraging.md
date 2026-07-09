---
sidebar_position: 9
title: Auto-Deleveraging
---

# Auto-Deleveraging (ADL)

Auto-deleveraging bounds how much a winning side can extract from the vault. When one side's unrealized profit grows large relative to the vault, that side is flagged: its opens are halted and its winners become eligible for a forced partial close. ADL is evaluated **per side**, long and short independently.

## The Per-Side Flags

A keeper calls `update_adl_state(price)` to recompute both sides' pending PnL at a verified price and set or clear the per-side ADL flags, published as an `adl_update` event. Each side's flag uses hysteresis against that side's pending PnL, measured as a fraction of **half the vault balance** (longs and shorts each get half):

- The flag **sets** while the side's pending PnL exceeds `adl_max_pnl` of half the vault.
- It **holds** while the PnL sits between `adl_clear_target` and `adl_max_pnl` (the hysteresis band that prevents flapping).
- It **clears** at or below `adl_clear_target`.

A side that is not winning is never flagged. Config validation orders the thresholds `MIN_ADL_CLEAR <= adl_clear_target <= adl_max_pnl <= max_pnl_trader < 1`, with `adl_max_pnl` additionally floored at `MIN_ADL_TRIGGER` (45%, all `SCALAR_18`), so ADL arms at or below the same overhang that triggers the realized-profit haircut.

## What a Flagged Side Does

A set flag has two effects:

1. **Opens halted.** A size-growing Increase on the flagged side aborts with `IncreaseHalted` (705). Existing positions can still be decreased or closed.
2. **Eligible for `execute_adl`.** Keepers can force a partial close of a winning position on that side.

## Executing ADL

`execute_adl(keeper, user, is_long, amount, price)` deleverages one winning position on a flagged side, reducing the side's pending PnL back toward `adl_clear_target` of half the vault. It closes `amount` (or the whole position if `amount` is `i128::MAX` or oversized) through the regular decrease path, with **no collateral withdrawal**. The requested amount is never resized. A partial close that would leave the remainder under `min_position_notional` aborts with `NotionalBelowMinimum` (711), while a request at or above the position's notional closes it in full. The decrease lock applies as on any decrease, so a request exceeding the unlocked notional aborts with `NotionalLocked` (721).

A forced reduction waives the initial-margin floor on the remainder (only the maintenance line applies), so a deleveraged position is never left stuck in a state its owner could not restore. The keeper is paid the `keeper_rate` cut of the trade fee, and the call emits a `decrease_fill` with id `0` plus a `position_update`.

Guards:

| Condition | Error |
|---|---|
| Side not flagged, or its pending PnL already at or below the clear target | `AdlNotTriggered` (770) |
| The close would overshoot below the re-measured clear allowance | `AdlOvershoot` (771) |
| The position is not a winner (the close would not reduce the side's pending PnL) | `AdlNotEligible` (772) |
| The verified price predates the position's last fill | `StalePrice` (740) |
| A sized partial close below the `min_order_notional` dust floor | `InvalidOrder` (732) |
| A partial close leaving the remainder under `min_position_notional` | `NotionalBelowMinimum` (711) |
| The requested close exceeds the unlocked notional (decrease lock) | `NotionalLocked` (721) |

## Interaction with the Profit Haircut

ADL and the [realized-profit haircut](./fee-system.md#realized-profit-haircut) work together. The haircut scales down closing profits while a side's PnL overhangs the vault, which a trader can partially escape by slicing a close across many fills (each fill re-reads a relieved ratio). ADL is the hard bound on that game: the same overhang that arms the haircut also flags the side for forced deleveraging, capping the total a winning side can extract before the vault is topped up or the imbalance unwinds.

The `adl_sweep` router helper lets a keeper deleverage a list of targets back to back, stopping once a side reports `AdlNotTriggered` (it has reached its clear target).
