---
sidebar_position: 4
title: PnL Calculation
---

# PnL Calculation

PnL in Zenex is **implied**, never stored. A position records its size in two units, `tokens` (base) and `notional` (quote), and its profit is derived from those against the current price whenever it is needed.

## Formula

The position's `tokens` field is the base size actually bought, and `notional` is the quote value paid for it. The implied entry price is `notional / tokens`. Marking the base size at the current price and subtracting what was paid gives the PnL.

For a **long** position:

$$
\text{pnl} = \text{tokens} \times \text{price} - \text{notional}
$$

For a **short** position the sign is inverted (a short profits as the price falls):

$$
\text{pnl} = \text{notional} - \text{tokens} \times \text{price}
$$

`price` is expressed in the feed's `price_scalar = 10^-exponent`, so the `tokens * price` product is scaled back down by `SCALAR_18` to land in the settlement token's decimals. The marked value rounds against the trader (floor for a long, ceil for a short), favoring the vault on rounding dust.

The formula always marks at the **exit** side of the verified price (`bid` for a long, `ask` for a short). Every PnL measurement uses it: unrealized equity for maintenance-margin and liquidation checks, the side's pending PnL, and realization on a close. The **entry** side (`ask` for a long, `bid` for a short) never enters the formula. It is consumed at fill time when sizing `tokens`, which embeds the spread in the implied entry instead. See [Pricing](./pricing.md).

## Blended Entry Across Increases

Because only `tokens` and `notional` are stored, successive increases blend automatically: each fill adds its bought `tokens` and its paid `notional`, and the implied entry `notional / tokens` moves to the size-weighted average. A partial close removes a pro-rata slice of both fields, preserving the implied entry on the remainder.

## Fill Price on Events

Every fill receipt (`increase_fill`, `decrease_fill`, `close_fill`, `liquidation`) carries the execution price on `price`: the entry side on an increase, the exit side on a close. On the close receipts, `notional` and `tokens` are the moved size prorated at the position's entry ratio, so `notional * SCALAR_18 / tokens` (in `price_scalar` units) gives the entry price of the closed chunk. The emitted `pnl` is post-haircut and the mark rounds against the trader, so recomputing PnL from `price` reproduces the field only up to that rounding and only when the haircut did not fire.

## Equity, Payout, and Bad Debt

Realized settlement combines PnL with collateral and fees:

$$
\text{equity} = \text{collateral} + \text{pnl} - \text{fees}
$$

`fees` in this formula is the debit total: base fee, impact fee, borrowing interest, and funding when the position pays it. Earned funding never offsets the debit. It accrues to the trader's claimable funding balance and is claimed separately.

On a **full close** the trader's payout is the post-fee equity floored at zero. If equity is negative, the trader receives nothing. The loss is drawn from the freed margin, and any shortfall past that margin becomes `bad_debt` absorbed by the vault.

A **partial close** settles differently. The trader is paid the requested collateral withdrawal plus the (haircut) realized profit, less the fees those proceeds cover. A realized loss and any fees the proceeds do not cover debit the surviving margin instead. Because that margin absorbs any shortfall, a partial close never produces bad debt. Only a full close or a liquidation can.

A **liquidation** follows the full-close payout rule on its soft tier only. If equity falls under the liquidation-fee line (`liq_fee` of notional), the hard tier fires and the entire remaining equity is forfeited to the vault, with the treasury taking its cut. See [Liquidation](./liquidation.md).

The realized profit on any close (partial or full, including liquidation and ADL) may additionally be scaled down by the [realized-profit haircut](./fee-system.md#realized-profit-haircut) while the winning side's pending PnL overhangs the vault. A loss passes through unscaled.
