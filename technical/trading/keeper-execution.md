---
sidebar_position: 10
title: Keeper Execution
---

# Keeper Execution

Every price-bearing action in Zenex is performed by a permissionless keeper. Traders create price-free intents, and keepers fill them at a verified Pyth Lazer price and are paid a cut of the fee for doing so. Any address can act as a keeper.

## Price-Bearing Entry Points

Each of these takes a serialized Pyth Lazer price update (`Bytes`), verified against the contract's immutable feed before anything settles:

| Function | Action | Keeper reward |
|---|---|---|
| `execute_order(keeper, user, id, price)` | Fill an increase or decrease order | `keeper_rate` cut of the trade fee |
| `execute_liquidation(keeper, user, is_long, price)` | Force-close a position below maintenance margin | `keeper_rate` cut of the close's trade fee |
| `execute_vault_order(keeper, user, id, amount, price)` | Fill up to `amount` of a deposit or redeem | `keeper_rate` cut of the vault fill fee |
| `update_adl_state(price)` | Recompute the per-side ADL flags | none (state update only) |
| `execute_adl(keeper, user, is_long, amount, price)` | Deleverage a winning position on a flagged side | `keeper_rate` cut of the trade fee |
| `accrue(price)` | Advance borrowing and funding indices to now | none |

The price-free maintenance call `accrue_funding` advances only the funding index, which needs no price.

## Permissionless and Unauthenticated

The `keeper` argument is only the reward recipient. It is never authenticated, and it need not be related to the trader or the order. The trader consented to the fill in two ways at order creation: the collateral allowance that funds an increase, and the trigger and slippage bounds that constrain the price. This creates a competitive, open keeper network where anyone can run a bot and collect rewards.

## Fill Eligibility

Before settling, `execute_order` evaluates the order against the verified price. Both the trigger and the slippage bound are judged on the **execution-side** price: the entry price (`ask` for a long, `bid` for a short) for an Increase, the exit price (`bid` for a long, `ask` for a short) for a Decrease. So a stop or limit fires on the exact price the fill will touch. Each check is skipped when its field is `0`.

- **Trigger.** `trigger_above` selects the cross direction: eligible when the execution-side price is at or above (`true`) or at or below (`false`) `trigger_price`. Not crossed raises `TriggerNotMet` (742).
- **Slippage bound.** `price_bound` is one-sided: a buy leg (long Increase or short Decrease) caps the price and rejects above the bound, while a sell leg floors it and rejects below. Worse than the bound raises `PriceBoundExceeded` (741).
- **Anti-replay.** The verified price's `publish_time` must be at or after the order's `created_at`, else `StalePrice` (740). One exception: a market order (`trigger_price == 0`) filling in its own creation ledger is an atomic create-and-fill and accepts any verifier-accepted price. A trigger order gets no same-ledger exemption.

## Settlement and the Fee Split

Fills settle on a gross basis inside `settle`. Four itemized costs are computed (see [Fee System](./fee-system.md)): the trade fee (base), impact, funding, and borrowing. The trade fee (base plus impact) and the borrowing fee are split between three recipients. Funding never enters the split: a paid funding accrual is banked in the market's internal funding pool, and an earned one credits the position owner's claimable balance, paid out through `claim_funding`.

- The **keeper** takes its `keeper_rate` cut of the trade fee (base plus impact).
- The **treasury** takes its rate (read from the treasury contract, clamped to `[0, MAX_KEEPER_RATE]`) of the trade fee, the borrowing fee, and any forfeit.
- The **vault** banks every remainder, funds realized PnL through `strategy_withdraw`, and absorbs `bad_debt`.

Fees are subtracted from the posted collateral at fill, so a later fee or rate increase cannot break an existing allowance. An Increase fill whose fees outgrow the posted collateral fails the margin floors at fill (`InsufficientMargin`, 713), so it cannot settle underfunded. If a direct payout to a trader fails (for example a dropped trustline), the contract falls back to granting a pull allowance (`pay_trader`), so a third-party fill never stalls on its receiver.

## Router Batching

Keepers and integrators can bundle work through the stateless trading-router contract, which never holds funds:

- `multicall(calls)` runs a list of calls in order, and any failure traps the whole batch (all-or-nothing).
- `multicall_try(calls)` runs them in order but isolates each failure: a failing call rolls back only its own effects and the batch continues, reporting a `CallOutcome { ok, value, error }` per call.
- `create_and_fill(trading, keeper, user, approve_amount, ...order args, price)` creates an order and fills it atomically (fill-or-kill: a failing fill unwinds the creation and the approval). With `keeper = user` the reward round-trips to the trader. `approve_amount` sets the collateral allowance first (`0` skips it).
- `create_and_try_fill(...)` creates strictly, then attempts an isolated fill. A failed fill leaves the order resting with its allowance in place, reporting why in a `FillAttempt`.
- `create_and_try_fill_vault_order(...)` does the same for a deposit or redeem: a locked order simply rests, and a Retired-market redeem pays out at creation.
- `adl_sweep(trading, keeper, targets, price)` deleverages a list of targets back to back, isolated, stopping once a target reports `AdlNotTriggered` (the side has reached its clear target).

A router-set collateral approval lasts roughly 120 days.
