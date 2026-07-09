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

The price used is direction- and action-aware. An Increase pays the **entry** price (`ask` for a long, `bid` for a short), while a close realizes at the **exit** price (`bid` for a long, `ask` for a short). See [Pricing](./pricing.md).

## Blended Entry Across Increases

Because only `tokens` and `notional` are stored, successive increases blend automatically: each fill adds its bought `tokens` and its paid `notional`, and the implied entry `notional / tokens` moves to the size-weighted average. A partial close removes a pro-rata slice of both fields, preserving the implied entry on the remainder.

## Fill Price on Events

Fill events (`increase_fill`, `decrease_fill`, `liquidation`) do not carry a price field. On every receipt, `notional * SCALAR_18 / tokens` (in `price_scalar` units) gives the implied entry price of the moved size. On an `increase_fill` that is also the fill price. On `decrease_fill` and `liquidation` the moved size is prorated at the position's entry ratio, so the exit-side value is recovered from the `pnl` field instead: `(notional + pnl) * SCALAR_18 / tokens` for a long, `(notional - pnl) * SCALAR_18 / tokens` for a short. The emitted `pnl` is post-haircut and the mark rounds against the trader, so the recovered exit price is exact only up to that rounding and only when the haircut did not fire.

## Equity, Payout, and Bad Debt

Realized settlement combines PnL with collateral and fees:

$$
\text{equity} = \text{collateral} + \text{pnl} - \text{fees}
$$

On a close the trader's payout is the post-fee equity floored at zero. If equity is negative, the trader receives nothing. The loss is drawn from the freed margin, and any shortfall past that margin becomes `bad_debt` absorbed by the vault. A partial close never runs past the margin, so it produces no bad debt. Only a full close or a liquidation can.

The realized profit on a close may additionally be scaled down by the [realized-profit haircut](./fee-system.md#realized-profit-haircut) while the winning side's pending PnL overhangs the vault. A loss passes through unscaled.
