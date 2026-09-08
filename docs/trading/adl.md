---
title: Auto-deleveraging
sidebar_position: 11
---

# Auto-deleveraging

Auto-deleveraging (ADL) protects the vault when one side of a market carries more pending profit than the vault can safely back. The vault is the counterparty to every position, so a side far ahead is a claim the vault must keep ready to pay. ADL turns part of that claim into cash before it grows past the allowance the market sets for that side.

**Like a liquidation, ADL closes a position without your consent. It takes a position whose close brings the flagged side's profit down.**

## When a side is flagged

The market measures each side's pending profit against two levels, an upper one and a lower one. Both are a share of half the vault balance. Longs and shorts are measured on their own, and each side carries its own flag. Any account can refresh both measurements with a verified price. The refresh pays no reward, and it is refused while the market is frozen or retired.

If a side's pending profit rises above the upper level, that side is flagged. The flag holds while the profit stays above the lower level. A falling profit does not clear the flag on its own. Only a later refresh at a fresh price clears it, and you can run that refresh yourself. If the new measurement is at the lower level or below, the flag comes off. The gap between the two levels keeps the flag from switching on and off around one number. A side that is flat or behind is never flagged. Both levels are per-market parameters, and the [parameter-change process](../governance.md) covers how a value changes.

## What a flag stops

**A flagged side takes no new size.** No fill may open a position on that side or grow one you already hold. You can still sign and place an increase order. It rests until a keeper fills it after the flag comes off, or until it expires. An increase order that adds collateral and no size still fills, so you can defend the margin on a position you hold. Closes and decreases on the flagged side run as usual, and the other side of the market is untouched.

## How a position is reduced

A keeper names a position on the flagged side, an amount to close, and a verified price. The market closes that amount and settles it the way your own close settles. The close takes the same price a close you run yourself would take, and the [Prices](../markets/prices.md) page gives that price. If the market already holds a price newer than the keeper's report, it closes you at the newer one.

A partial reduction realizes part of your profit and shrinks your size. It withdraws none of your collateral. The costs of the closed part come out of that realized profit first, and the market pays you the profit that is left. If the profit does not cover the costs, the rest comes out of the collateral on the position you keep. Every decrease order resting on that side stays in place.

A full close pays your collateral and your realized profit as one settled amount, with the costs taken out of that amount first. It cancels every decrease order still resting on that side, and each cancelled order returns its escrow to you.

## What a reduction costs you

The closed part pays the ordinary trade fee and the impact fee, and it settles the borrowing interest and the funding it accrued. The keeper that ran the close takes a share of the two fees as its reward. No execution fee and no liquidation fee apply. For each of those charges, see [Fees](./fees.md). For the cap on the profit you realize, see [Profit and loss](./pnl.md).

## The limits that still bind

Two limits on your own close bind a keeper here as well. Size you added moments ago sits under the decrease lock. While any of your size is locked, a full close is refused, and a partial close can take no more than the unlocked part. The amount must also clear the market's minimum order size, which stops a keeper from cutting a winner into fragments.

Each reduction must lower the pending profit of its side, and it must leave that profit at or above the lower level. A keeper therefore works a heavily flagged side down in steps rather than in one closure.

What a partial close leaves behind must sit at or under the market's maximum position size. Its equity must stay at or above its maintenance margin. A request that would leave less than the market's minimum position size closes the position in full instead. That full close pays and cancels orders in the way described above. **The remainder is held to the maintenance margin alone. A position that ADL reduced can sit under the collateral a new position of that size needs.** A position already under its maintenance margin is out of reach here. For the close that takes such a position, see [Liquidation](./liquidation.md).

## Which position a keeper picks

The protocol enforces the side-level bound alone, and that bound protects the vault whichever eligible position closes. **Any position on the flagged side whose close lowers that side's profit is a candidate, and the limits above decide how much of it a keeper can take.**

The market measures a side's profit at the price that favors that side, and your close settles at the other side of the quote. A position that shows a small loss at the price you close on can still be a candidate. No rule on chain sends a keeper to the largest winner, and nothing gives you a place in a queue or a warning first.

What you keep after a reduction is a realized profit you did not choose to take, at a moment you did not pick. The flag and the close are outside your control. What you control is the size you carry on a winning side. You also control whether you take profit before that side is flagged.
