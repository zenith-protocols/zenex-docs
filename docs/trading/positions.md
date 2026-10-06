---
title: Positions
description: Understand how orders change your position and when you can close it.
---

# Positions

You can hold one long and one short in each market. Each side has its own margin, entry price, costs, and liquidation risk. A later fill on the same side changes the position you already hold. It does not create a separate position.

## Open or increase

An increase adds size, collateral, or both. When it adds size, your entry price becomes the combined average of the existing and new exposure. Fees and accrued costs settle at the fill. The remaining collateral must pass the market's margin checks. Adding margin without size can restore a position's buffer. The top-up must be large enough to pass both margin lines after settlement. See [Margin and leverage](./margin-and-leverage.md).

## Reduce or close

A decrease removes size, margin, or both.

| Action | Result |
| --- | --- |
| Partial decrease | Realizes the result on the closed size. The remainder keeps its entry price. |
| Margin withdrawal | Returns collateral if the position remains within its required limits. |
| Full close | Settles the whole position and returns what remains after losses and costs. |

A partial decrease pays costs from realized profit first, then from margin. It returns remaining realized profit and any permitted margin withdrawal. A full close also cancels all resting decrease orders on that side and refunds their escrow. Resting increase orders are separate requests and can still open exposure later.

:::warning A small remainder can become a full close
If a decrease reaches the whole position or leaves less than the minimum position size, the market closes the entire position. Review the resulting size and payout before you sign.
:::

## The decrease lock {#the-decrease-lock}

New size is locked against decreases for a short period. Each fill that adds size restarts the lock on all size still locked, so scaling in can delay a full close. The position can contain both locked and unlocked size. A partial close can take only unlocked size. A full close waits until all the size is unlocked. The current lock and size limits are on [Deployments](../deployments.md).

:::info A stop loss follows the same lock
An exit order can trigger while its size remains locked. It must wait until a fill passes the lock and other checks. Liquidation can close locked size.
:::

## Follow the funds

A full close pays your margin and realized result, less fees and accrued costs. A losing position can return zero, but creates no debt against your other wallet funds. Earned funding goes to [Claimable credit](./claimable-credit.md). A payout that cannot reach your wallet can go there too. For how the price and profit cap affect the amount, use [Profit and payouts](./pnl.md). For a forced close, use [Liquidation](./liquidation.md) or [Auto-deleveraging](./adl.md).
