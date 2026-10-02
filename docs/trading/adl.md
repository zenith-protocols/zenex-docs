---
title: Auto-deleveraging
sidebar_position: 11
---

# Auto-deleveraging

Auto-deleveraging (ADL) is the market's backstop for a side that holds more unpaid profit than the vault can safely back. This page covers when a side is flagged and what a flag stops. It also covers how a keeper reduces a winning position, what a reduction costs you, and which limits bind it.

The vault is the counterparty to every position. It pays each winner and takes in each loss. The profit a whole side carries at the current price is therefore a claim on the vault. That total is the side's pending profit. Each market allows a side a share of half the vault balance. ADL turns part of a larger claim into cash before it grows further.

**Like a liquidation, ADL closes part or all of a winning position without your consent.**

## A side is flagged when its pending profit passes the upper level

The market measures each side on its own against two levels, and each level is a share of half the vault balance. Each market sets both through the [parameter-change process](../governance.md). The upper level raises a flag on a side and the lower level clears it. The gap between them keeps the flag from switching on and off around a single number.

1. **Raise.** A side is flagged when a measurement finds its pending profit above the upper level.
2. **Hold.** The flag stays on while the profit stays above the lower level.
3. **Clear.** The flag comes off when a later measurement finds the profit at the lower level or below.

A side that is flat or behind is never flagged.

The market takes a measurement only when an account sends one with a signed price report. The [Prices](../markets/prices.md) page gives what a report must pass. Any account can send it, and it pays its sender nothing. A keeper sends it because a side must be flagged before a keeper can reduce a position on it. You can send it yourself to clear a flag. A market that is frozen or retired refuses the call.

A profit that falls under the lower level therefore leaves the flag on until the next measurement. The market publishes the result of every measurement, so the flags are public.

## A flagged side takes no new size

A flagged side already holds a claim the vault should not back further, so the market lets it shrink and stops it growing. No fill can open a position on that side or grow one you already hold.

You can still place an increase order. It rests until a measurement clears the flag and a keeper fills it, or until it expires. The [Orders](./orders.md) page gives what a resting order escrows. An increase that adds collateral and no size still fills, so you can defend the margin behind a position you hold. Closes and decreases on the flagged side run as usual, and the other side of the market is untouched.

## A keeper reduces a winning position

A keeper names an account, a side, an amount to close, and a signed price report. The keeper chooses the position, and it must sit on a flagged side. The market closes that amount at the price your own close would take, and the [Prices](../markets/prices.md) page gives that price. It then settles the close the way it settles a close you ask for. This is a reduction.

A request that reaches your whole size closes the position in full. So does a request that would leave less than the market's minimum position size. Any other request is a partial reduction. The two differ in what they pay and what they leave behind.

| | Partial reduction | Full reduction |
| --- | --- | --- |
| What you realize | The profit or loss on the closed part, with any profit capped | The profit or loss on the whole position, with any profit capped |
| Who pays the costs | The realized profit first, then the collateral behind the position | They come out of the settled amount |
| What reaches you | The profit left after costs, paid at once | Your collateral and your realized profit, less costs, as one amount that never falls below zero |
| Your collateral | None is withdrawn. A realized loss comes out of it | The whole amount is settled |
| What stays open | The rest of the size, at the same entry price | Nothing |
| Resting decrease orders | Every order stays in place | Every order is cancelled, and each returns its escrow to you |

The [Profit and loss](./pnl.md) page gives the profit cap. The [Positions](./positions.md) page gives the same payout rules for a close you request.

## A reduction settles your costs

The closed part pays the trade fee and the impact fee. The keeper takes a share of those two fees as its reward. The whole position settles its accrued borrowing interest and funding at the reduction, and not only the share the closed part accrued. The [Fees](./fees.md) page gives each charge and where it goes.

A reduction consumes no order, so it carries no execution fee. It is not a liquidation, so it carries no liquidation fee. The market banks any funding you earned as claimable credit, which you take in a claim you sign yourself. The [Claimable credit](./claimable-credit.md) page gives how.

## Limits bind every reduction

Each reduction must lower the pending profit of its side. It must also leave that profit at or above the lower level, measured after the close settles. The first limit makes sure a reduction does the job it exists for. The second stops a keeper from cutting deeper than the vault needs, because a side at the lower level is already clear. A side at or under the lower level refuses reductions even while its flag stays on.

A keeper therefore works a heavily flagged side down in steps. The only winner on a side cannot close in full, because a full close takes the side's profit to zero or below, under the lower level. Such a position shrinks in parts.

Two limits on your own close bind a keeper here as well. The [decrease lock](./positions.md#the-decrease-lock) applies. While any of your size is locked, a full reduction is refused, and a partial one can take no more than the unlocked part. The amount must also clear the market's minimum order size, which stops a keeper from cutting a winner into fragments.

A partial reduction must leave a remainder at or under the market's maximum position size. The [Margin and leverage](./margin-and-leverage.md) page gives that bound. The remainder's equity must also stay at or above its maintenance margin. The initial margin is the collateral a new position of that size needs, and the market does not hold the remainder to it. **A position that ADL reduced can sit under the collateral a new position of that size needs.** A later change you make to it meets the initial margin again.

A position whose equity is already under its maintenance margin is refused. Liquidation is the close that takes such a position, and the [Liquidation](./liquidation.md) page gives it.

A frozen or retired market refuses a reduction. So does a price older than the one your position was last priced against. A reduction runs at the newer of the keeper's report and the price the market remembers, so an old report alone does not trigger this.

## The keeper picks the position

The keeper chooses which winning position to reduce and by how much. The market checks the profit of the side and does not check who is picked, and that check protects the vault whichever position closes. Any position on the flagged side whose close lowers the side's profit is a candidate, within the limits above.

The market measures a side's profit at whichever quoted price gives the side its larger total. Your close settles at the price your side leaves on. The two differ by the spread. A position that shows a small loss at your exit price can therefore be a candidate. The market does not send a keeper to the largest winner first. It keeps no queue and gives no warning before a reduction.

## What you control

What you keep after a reduction is a realized profit you did not choose to take, at a moment you did not pick. The flag and the close are outside your control. You control the size you carry on a winning side, and you control whether you close part of it yourself before the side is flagged.
