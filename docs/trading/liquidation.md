---
title: Liquidation
description: Understand the equity trigger, forced close, fees, and remaining payout.
---

# Liquidation

Liquidation forcibly closes the whole position on one side. Any keeper can run it once equity falls below the market's maintenance requirement. Equity includes margin, the marked profit or loss, the profit cap, and the costs of closing.

:::danger You can lose all the position's margin
A liquidation returns only what remains after losses, closing costs, and the liquidation fee. That amount can be zero. A stop loss does not guarantee execution before liquidation.
:::

## When a position becomes liquidatable

The maintenance requirement is a share of the position's entry size. Equity below that line makes the position liquidatable. Equity exactly on the line does not. For illustration, a 10,000 USDC position with a 2% maintenance requirement needs 200 USDC of equity. Any amount below 200 makes it eligible.

Borrowing interest and funding owed lower equity before settlement. The costs of a full close count too. Earned funding sits in claimable credit. It does not raise the position's equity.

## Why the displayed liquidation price moves

The liquidation price estimates where equity reaches maintenance margin. More collateral moves it farther from entry. Higher leverage starts it closer. Ongoing costs move that price toward entry even when the asset price does not change. Changes to the market's settings can move it too. For illustration, a 10,000 USDC position backed by 500 USDC has 300 USDC above a 200 USDC maintenance line. Fees reduce that buffer. Read [Prices](../markets/prices.md) for the price rules.

:::warning Treat the displayed price as an estimate
Liquidation uses the verified execution price and costs at that moment. The chart price can differ. A stream outage can stop your ordinary fill while a liquidation still accepts an older report.
:::

## What you can do before liquidation

Reduce exposure, close, or add margin while the market permits it. Newly added size can have a decrease lock. Below maintenance margin, an ordinary close or margin withdrawal is refused. A sufficiently large margin top-up can restore the position if its fill passes both margin lines. The top-up must cover accrued costs and the required remaining margin in one step. A submitted top-up does not guarantee it fills first. A frozen market blocks these actions. See [Market status](../markets/status.md).

## What the close returns

The close settles the entire position, including accrued borrowing and funding. It then takes the liquidation fee from surviving equity.

| Illustrative equity after closing costs | Rated liquidation fee | Payout |
| --- | --- | --- |
| 90 USDC | 50 USDC | 40 USDC |
| 30 USDC | 50 USDC | 0 USDC |
| Zero or negative | 50 USDC | 0 USDC |

The fee is capped at surviving equity. It cannot create a negative payout. Resting decreases on the closed side are cancelled and refunded. Resting increases can still create exposure later. Earned funding and failed payouts become [Claimable credit](./claimable-credit.md).

## What happens beyond the margin

The vault absorbs losses that exceed the position's margin. The protocol creates no debt against your other wallet funds. If the vault cannot fund a required payout, the close fails and the position stays open. It can continue accruing costs.

## Forced close during a wind-down

Seven days after delisting, any keeper can close any remaining position, including a healthy one. The usual liquidation fee still applies. A delisted market can use an owner-set settlement price. See [Market status](../markets/status.md) for the wind-down rules.
