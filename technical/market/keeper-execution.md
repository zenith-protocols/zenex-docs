---
sidebar_position: 10
title: Keeper Execution
---

# Keeper Execution

Every price-bearing action in Zenex is performed by a permissionless keeper. Traders create price-free intents, and keepers fill them at a verified price, earning a cut of the fee plus the order's escrowed execution fee for doing so. Any address can act as a keeper.

## Price-Bearing Entry Points

Each of these takes a signed Chainlink Data Streams report (`Bytes`), passed to the oracle and verified against the market's immutable feed id before anything settles. One exception: once a flat settlement price is set on a delisted market past its grace window, the submitted bytes are ignored and the stored terminal price is used.

| Function | Action | Keeper reward |
|---|---|---|
| `execute_order(keeper, user, id, price)` | Fill an increase or decrease order | `keeper_rate` cut of the trade fee plus the order's escrowed `exec_fee` |
| `execute_liquidation(keeper, user, is_long, price)` | Force-close a position below maintenance margin | `keeper_rate` cut of the close's trade fee plus the liquidation fee |
| `execute_vault_order(keeper, user, id, price)` | Fill a deposit or redeem in full | `keeper_rate` cut of the vault fill fee plus the order's escrowed `exec_fee` |
| `update_adl_state(price)` | Recompute the per-side ADL flags | none (state update only) |
| `execute_adl(keeper, user, is_long, amount, price)` | Deleverage a winning position on a flagged side | `keeper_rate` cut of the trade fee |
| `accrue(price)` | Advance borrowing and funding indices to now | none |

`exec_fee` is a flat execution fee, a `Config` amount in token decimals, escrowed with every trade order and vault order at creation. It pays the keeper at fill and refunds on cancel, including the auto-cancel of resting decrease orders when a position fully closes. Liquidation and ADL carry no order, so those paths pay the fee cut alone. Past a Delisted market's 7-day delist deadline, `execute_liquidation` may also close any remaining position regardless of margin health (the wind-down waiver).

Every one of these calls advances the borrowing and funding indices to the current ledger timestamp before it touches a position, so `accrue` exists only to advance them without any other side effect.

## Staleness Windows

`execute_order` and `execute_vault_order` verify under the oracle's strict trade window, while `execute_liquidation`, `execute_adl`, `update_adl_state`, and `accrue` verify under its wider close window. Every route except `execute_order` prices at the market's cached mark when the cache is newer than the submitted report. See [Oracle](../oracle/overview) for the windows and their bounds.

## Permissionless and Unauthenticated

The `keeper` argument is only the reward recipient. It is never authenticated, and it need not be related to the trader or the order. The trader consented to the fill at order creation: the escrow posted with the order (an increase escrows `margin + exec_fee`, a decrease escrows `exec_fee` only) funds the fill, and the trigger and slippage bounds constrain the price. This creates a competitive, open keeper network where anyone can run a bot and collect rewards.

## Fill Eligibility

Before settling, `execute_order` evaluates the order against the verified price. An order is fillable only while the ledger sequence is at or below its `expiration`, else `OrderExpired` (731). A size-growing increase is rejected with `IncreaseHalted` (705) while the market status does not accept opens (only Active does) or the target side's ADL flag is set. A zero-notional increase (a pure margin top-up) is exempt from the open halt, so a trader can always defend margin. Both the trigger and the slippage bound are judged on the **execution-side** price: the entry price (`ask` for a long, `bid` for a short) for an Increase, the exit price (`bid` for a long, `ask` for a short) for a Decrease. So a stop or limit fires on the exact price the fill will touch.

- **Trigger.** The cross direction is implied by the order kind and side: for a long, `StopIncrease` and `LimitDecrease` are eligible when the execution-side price is at or above `trigger_price`, `LimitIncrease` and `StopDecrease` at or below. Inverted for a short. Market kinds have no trigger check. Not crossed raises `TriggerNotMet` (742).
- **Slippage bound.** `price_bound` is one-sided: a buy leg (long Increase or short Decrease) caps the price and rejects above the bound, while a sell leg floors it and rejects below. Worse than the bound raises `PriceBoundExceeded` (741). The check is skipped when `price_bound` is `0`.
- **Anti-replay.** The verified price's `publish_time` must be at or after the order's `created_at`, else `StalePrice` (740). One exception: a market kind (`MarketIncrease` or `MarketDecrease`) filling in its creation ledger is an atomic create-and-fill and accepts any verifier-accepted price. A trigger kind gets no same-ledger exemption.

Every position-touching path shares one further floor: `execute_order`, `execute_liquidation`, and `execute_adl` require the verified `publish_time` at or after `position.priced_at`, the publish time stamped by the position's last fill, else `StalePrice` (740). `priced_at` only moves forward, so no fill or force-close ever prices behind the position's own last mark. There is no same-ledger exemption on a force-close path.

Vault-order fills have their own gates. The verified `publish_time` must be at or after the order's `created_at`, and the fill must land in a strictly later ledger than the creation (an atomic create-and-fill can never price the shares), both raising `StalePrice` (740). A redeem before `redeem_lock` seconds have elapsed from `created_at` raises `VaultOrderLocked` (751), and a fill returning less than the order's `min_out` raises `MinOutNotMet` (752).

## Settlement and the Fee Split

Fills settle on a gross basis inside `settle`. Four itemized costs are computed (see [Fee System](./fee-system.md)): the base fee, the impact fee, funding, and borrowing. The trade fee (base plus impact) splits between keeper, treasury, and vault. The borrowing fee splits between treasury and vault. Funding never enters the split: a paid funding accrual is banked in the market's internal credit pool, and an earned one credits the position owner's claimable balance, paid out through `claim_credit`.

- The **keeper** takes its `keeper_rate` cut of the trade fee (base plus impact) on trade fills, or of the vault fill fee on vault-order fills, plus the order's escrowed `exec_fee` in both cases. ADL pays the trade-fee cut alone, and liquidation the cut of the trade fee plus the liquidation fee.
- The **treasury** takes its rate (read live from the treasury contract, which bounds its own rate to at most 50%) of the trade fee, the liquidation fee, and the borrowing fee. All three cuts are taken on the gross amount, so `keeper_rate` cannot dilute them.
- The **vault** banks every remainder, funds realized PnL through `strategy_withdraw`, and absorbs `bad_debt`.

Fees are subtracted from the margin escrowed at order creation, so the fill moves no additional funds from the trader, and a fee or rate change between creation and fill cannot leave the fill under-funded. On an Increase fill whose fees exceed the newly escrowed margin, the deficit debits the position's existing margin, and the fill fails the margin floors at fill (`InsufficientMargin`, 713) only when the resulting position falls below them, so either way it never settles underfunded. If a direct payout to a trader fails (for example a dropped trustline), the contract parks the amount as the trader's claimable credit, redeemable through `claim_credit`, so a third-party fill never stalls on its receiver.

## Router Batching

Keepers and integrators can bundle work through the stateless market-router contract, which holds no funds and has no privileges, so a batch can only do what the caller's own authorization already permits. Its create-and-fill flows run a batch of arbitrary calls and then fill the order the first call created, atomically in one transaction. See [Market Router](../router/overview) for the full surface.
