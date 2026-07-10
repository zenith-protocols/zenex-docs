---
sidebar_position: 8
title: Auto-Deleveraging (ADL)
---

# Auto-Deleveraging (ADL)

Auto-deleveraging is a safety mechanism that protects the vault when the winning side of a market builds up more unrealized profit than the vault can comfortably back. Rather than letting the protocol drift toward insolvency, ADL closes some of the winning positions at the oracle price, taking their profit off the table before it becomes a problem the vault cannot pay.

ADL is decided per side. Each side (long and short) is evaluated on its own pending PnL, and only a side that is actually winning can ever be flagged.

## When ADL Triggers

The protocol tracks each side's pending PnL against a share of the vault, and a keeper can refresh this evaluation at any time by submitting a verified price. A side's ADL flag is managed with hysteresis, using two per-market thresholds set through the protocol's [parameter-change process](../governance/parameter-changes.md):

- The flag **sets** when the side's pending PnL rises above the upper threshold (a share of half the vault balance).
- Once set, it **holds** while pending PnL stays above a lower clear target.
- It **clears** when pending PnL falls back to or below that clear target.

The gap between the two thresholds prevents the flag from rapidly toggling on and off as PnL hovers near the line. A side that is not winning is never flagged.

## What a Flagged Side Means

While a side is flagged, two things happen:

1. **New opens on that side are halted.** Orders that would grow a position on the flagged side cannot fill until the flag clears, though the orders themselves can still be placed and will rest. Adding collateral to an existing position still works, so you can defend your margin while the flag is up. Closing, reducing, and trading the other side all continue normally.
2. **Winning positions on that side become eligible for deleveraging.** A keeper can close part or all of a winning position through the regular decrease path, bringing the side's pending PnL back down toward the clear target.

## How Deleveraging Works

A keeper runs ADL permissionlessly by naming a position on the flagged side and an amount to close, along with a verified oracle price. The close settles at that oracle price through the ordinary decrease path. A partial deleverage realizes a slice of the position's profit and shrinks its size, leaving the collateral in place. A full deleverage closes the position and pays out the remaining collateral together with the realized profit.

The mechanism has guardrails. A close must actually reduce the side's pending PnL, and it may not overshoot below the clear target that the deleveraging is aiming for. A partial deleverage respects the decrease lock on freshly added size and always leaves at least a minimum-size remainder rather than dust. Deleveraging stops once the side has been brought back to its clear target.

## What You Should Know

- **ADL is a backstop, not a routine event.** It only engages when a winning side has grown large relative to the vault. Under normal conditions, ordinary liquidations handle risk.
- **It only touches winning positions.** If your side is not in profit, ADL never applies to you.
- **No action is required from you.** Deleveraging is performed by keepers. If your winning position is reduced, you keep the realized profit on the closed portion, net of the regular close fees and any profit haircut in effect, and only your remaining exposure shrinks.
- **It caps profit extraction during an overhang.** ADL works alongside the realized-profit haircut described in [PnL](./pnl.md): the haircut scales down gains while a side is overweight, and ADL bounds how large that overhang can grow.
