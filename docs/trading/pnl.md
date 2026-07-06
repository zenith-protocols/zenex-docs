---
sidebar_position: 7
title: PnL
---

# PnL Calculations

PnL ("profit and loss") measures how much you have gained or lost on a position as the market moves. It updates continuously and is the primary indicator of trade performance. It is also an important input to [liquidations](./liquidation.md), which is why this section elaborates on the subject.

**PnL is implied, never stored**

A position records its size in the base asset (its tokens) and its notional in the quote asset, and your entry is simply the ratio of the two. PnL is implied from the live price against that entry, rather than stored as a running figure:

$$
PnL_{long} = tokens \times currentPrice - notional
$$

$$
PnL_{short} = notional - tokens \times currentPrice
$$

PnL turns positive when the price moves in your favor and negative when it moves against you. Because it is computed from the current price each time, it always reflects the latest oracle value with no separate accounting to keep in sync.

**Realizing PnL on a decrease**

Unrealized PnL only becomes cash when you reduce the position. A partial decrease realizes PnL pro-rata: closing half the size realizes half the position's PnL, and the implied entry of the remaining size is preserved. A full close realizes all of it. On a losing close the loss is taken out of the position's proceeds and margin, and a partial close never runs past the margin, so a partial reduction cannot create bad debt.

**The realized-profit haircut**

When a whole side of the market is sitting on very large unrealized profit, the vault protects itself by scaling down realized gains while that overhang lasts. If a side's pending PnL exceeds a threshold (a share, set per market by governance, of half the vault balance), a closing profit is scaled by the ratio of the allowance to the side's pending PnL. Every profitable close during the overhang is cut by the same live factor, and the withheld share stays with the vault. Losses always pass through unchanged.

The factor is re-read on each fill, so as the overhang relaxes the haircut eases. Slicing a close into many small fills can partially escape the haircut, but the same overhang is what arms [auto-deleveraging](./adl.md), which bounds how much can be extracted that way.

**Example**

A user opens a long with a notional size of \$10,000 on XLM. A 10% price increase yields a \$1,000 gain, so the implied PnL is \$1,000. If the price then falls back so the position is 5% below entry, the implied PnL is -\$500. Closing there returns the collateral minus \$500 (net of fees). Had the user instead closed at the +\$1,000 mark while that side was under the profit overhang, the realized gain would have been scaled down by the live haircut factor, with the withheld portion retained by the vault.
