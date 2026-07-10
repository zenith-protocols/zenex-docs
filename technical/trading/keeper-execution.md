---
sidebar_position: 10
title: Keeper Execution
---

# Keeper Execution

Every price-bearing action in Zenex is performed by a permissionless keeper. Traders create price-free intents, and keepers fill them at a verified Pyth Lazer price, earning a cut of the fee plus the order's escrowed execution fee for doing so. Any address can act as a keeper.

## Price-Bearing Entry Points

Each of these takes a serialized Pyth Lazer price update (`Bytes`), verified against the contract's immutable feed before anything settles. One exception: once a flat settlement price is set on a delisted market past its grace window, the submitted bytes are ignored and the stored terminal price is used.

| Function | Action | Keeper reward |
|---|---|---|
| `execute_order(keeper, user, id, price)` | Fill an increase or decrease order | `keeper_rate` cut of the trade fee plus the order's escrowed `exec_fee` |
| `execute_liquidation(keeper, user, is_long, price)` | Force-close a position below maintenance margin | `keeper_rate` cut of the close's trade fee |
| `execute_vault_order(keeper, user, id, price)` | Fill a deposit or redeem in full | `keeper_rate` cut of the vault fill fee plus the order's escrowed `exec_fee` |
| `update_adl_state(price)` | Recompute the per-side ADL flags | none (state update only) |
| `execute_adl(keeper, user, is_long, amount, price)` | Deleverage a winning position on a flagged side | `keeper_rate` cut of the trade fee |
| `accrue(price)` | Advance borrowing and funding indices to now | none |

`exec_fee` is a flat execution fee, a `Config` amount in token decimals, escrowed with every trade order and vault order at creation. It pays the keeper at fill and refunds on cancel, including the auto-cancel of resting decrease orders when a position fully closes. Liquidation and ADL carry no order, so those paths pay the fee cut alone. Past a Delisted market's 7-day delist deadline, `execute_liquidation` may also close any remaining position regardless of margin health (the wind-down waiver).

The price-free maintenance call `accrue_funding` advances only the funding index, which needs no price.

## Permissionless and Unauthenticated

The `keeper` argument is only the reward recipient. It is never authenticated, and it need not be related to the trader or the order. The trader consented to the fill at order creation: the escrow posted with the order (an increase escrows `collateral + exec_fee`, a decrease escrows `exec_fee` only) funds the fill, and the trigger and slippage bounds constrain the price. This creates a competitive, open keeper network where anyone can run a bot and collect rewards.

## Fill Eligibility

Before settling, `execute_order` evaluates the order against the verified price. An order is fillable only while the ledger sequence is at or below its `expiration`, else `OrderExpired` (731). A size-growing increase is rejected with `IncreaseHalted` (705) while the market status does not accept opens (only Active does) or the target side's ADL flag is set. A zero-notional increase (a pure collateral top-up) is exempt from the open halt, so a trader can always defend margin. Both the trigger and the slippage bound are judged on the **execution-side** price: the entry price (`ask` for a long, `bid` for a short) for an Increase, the exit price (`bid` for a long, `ask` for a short) for a Decrease. So a stop or limit fires on the exact price the fill will touch.

- **Trigger.** The cross direction is implied by the order kind and side: for a long, `StopIncrease` and `LimitDecrease` are eligible when the execution-side price is at or above `trigger_price`, `LimitIncrease` and `StopDecrease` at or below. Inverted for a short. Market kinds have no trigger check. Not crossed raises `TriggerNotMet` (742).
- **Slippage bound.** `price_bound` is one-sided: a buy leg (long Increase or short Decrease) caps the price and rejects above the bound, while a sell leg floors it and rejects below. Worse than the bound raises `PriceBoundExceeded` (741). The check is skipped when `price_bound` is `0`.
- **Anti-replay.** The verified price's `publish_time` must be at or after the order's `created_at`, else `StalePrice` (740). One exception: a market kind (`MarketIncrease` or `MarketDecrease`) filling in its creation ledger is an atomic create-and-fill and accepts any verifier-accepted price. A trigger kind gets no same-ledger exemption.

Force-closes have their own anti-replay floor. `execute_liquidation` and `execute_adl` require `publish_time` at or after `position.priced_at`, the publish time of the last fill's price, else `StalePrice` (740). The ADL paths add a market-clock floor: `update_adl_state` and `execute_adl` also reject a price older than the market's newest consumed price (`last_price_time`) with the same error. There is no same-ledger exemption on a force-close path.

Vault-order fills have their own gates. The verified price must strictly postdate the order's `created_at` (an atomic create-and-fill can never price the shares) and be at least as new as the market's last consumed price time, both raising `StalePrice` (740). A redeem before `redeem_lock` seconds have elapsed from `created_at` raises `VaultOrderLocked` (751), and a fill returning less than the order's `min_out` raises `MinOutNotMet` (752).

## Settlement and the Fee Split

Fills settle on a gross basis inside `settle`. Four itemized costs are computed (see [Fee System](./fee-system.md)): the base fee, the impact fee, funding, and borrowing. The trade fee (base plus impact) splits between keeper, treasury, and vault. The borrowing fee splits between treasury and vault. Funding never enters the split: a paid funding accrual is banked in the market's internal funding pool, and an earned one credits the position owner's claimable balance, paid out through `claim_funding`.

- The **keeper** takes its `keeper_rate` cut of the trade fee (base plus impact) on trade fills, or of the vault fill fee on vault-order fills, plus the order's escrowed `exec_fee` in both cases. Liquidation and ADL pay the trade-fee cut alone.
- The **treasury** takes its rate (read live from the treasury contract, which bounds its own rate to at most 50%) of the trade fee, the borrowing fee, and any forfeit.
- The **vault** banks every remainder, funds realized PnL through `strategy_withdraw`, and absorbs `bad_debt`.

Fees are subtracted from the collateral escrowed at order creation, so the fill moves no additional funds from the trader, and a fee or rate change between creation and fill cannot leave the fill under-funded. On an Increase fill whose fees exceed the newly escrowed collateral, the deficit debits the position's existing margin, and the fill fails the margin floors at fill (`InsufficientMargin`, 713) only when the resulting position falls below them, so either way it never settles underfunded. If a direct payout to a trader fails (for example a dropped trustline), the contract falls back to granting a pull allowance (`pay_trader`), so a third-party fill never stalls on its receiver.

## Router Batching

Keepers and integrators can bundle work through the stateless trading-router contract, which never holds funds:

- `multicall(calls)` runs a list of calls in order, and any failure traps the whole batch (all-or-nothing).
- `multicall_try(calls)` runs them in order but isolates each failure: a failing call rolls back only its own effects and the batch continues, reporting a `CallOutcome { ok, value, error }` per call.
- `create_and_fill(trading, keeper, user, approve_amount, ...order args, price)` creates an order and fills it atomically (fill-or-kill: a failing fill unwinds the creation and the approval). With `keeper = user` the reward round-trips to the trader. `approve_amount` sets the collateral allowance first (`0` skips it).
- `create_and_try_fill(...)` creates strictly, then attempts an isolated fill. A failed fill leaves the order resting with its allowance in place, reporting why in a `FillAttempt`.
- `create_and_try_fill_vault_order(...)` does the same for a deposit or redeem: a redeem still inside its cooldown simply rests, and a Retired-market redeem pays out at creation.
- `adl_sweep(trading, keeper, targets, price)` deleverages a list of targets back to back, isolated, stopping once a target reports `AdlNotTriggered` (the side has reached its clear target).

A router-set collateral approval lasts roughly 120 days.
