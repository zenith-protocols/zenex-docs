---
title: Market status
sidebar_position: 3
---

# Market status

A market is always in one of five states, and the state decides which actions the market accepts. The owner of the market sets the state, and the market publishes every change on chain. A new state can open or close actions for you and for the keepers. For who the owner is and what else the owner can change, see [Governance](../governance.md).

## The five states

| State | What still runs | What stops |
| --- | --- | --- |
| Active | Every action. | Nothing. |
| On ice | Every action except one. | Any fill that opens a position or adds size to one. |
| Frozen | Changes the owner makes to the market and its settings. | Every action, for you and for the keepers. |
| Delisted | Every action except one. Closes, cancels, and redeems run inside the wind-down window below. | Any fill that opens a position or adds size to one. |
| Retired | Claims, cancels, vault redeems, and changes the owner makes to the market and its settings. | Every fill, every new order, and every vault deposit. The market never trades again. |

On ice and delisted both stop one thing. No keeper can fill an order that opens a position or grows one you already hold. You can still sign and place that order, and the market holds it, but it rests until the state changes or the order expires. An order that only adds collateral still fills, so you can defend the margin behind a position you hold. A close, a decrease, a liquidation, an auto-deleveraging fill, a vault deposit, a vault redeem, a cancel, and a claim all keep running. On ice they run at the price the keepers submit. In a delisted market they run at the flat settlement price once the owner sets one. The way out stays open.

## A frozen market

A freeze stops every path that moves value. The market accepts no fill, no new order, no cancel, no deposit, no redeem, and no claim. Your position, your margin, your resting orders, and the escrow behind them stay as they are. You reach none of them until the owner lifts the freeze.

**A freeze does not hold the price still.** Your position stays open at its size. The market marks it at the next price a keeper submits once the freeze lifts. If the price moved against you during the freeze, a liquidation can follow at once.

**A freeze does not stop the borrowing and funding clock.** Both count over the whole frozen period. The next settlement of your position covers that period, whether it comes from your own fill, a liquidation, or an auto-deleveraging fill. Borrowing comes out of your margin. Funding comes out of your margin on the paying side, and on the receiving side the market credits it to you as a balance you can claim.

## A delisted market

A delist stops new size and starts a wind-down window. Close your position, cancel your resting orders, and redeem your vault shares inside that window.

For one day after the delist the owner can undo it and set the market back to active or on ice. After that day no call returns the market to either state. The owner can still leave it delisted, freeze it, or retire it.

From one day after the delist the owner can also fix a flat settlement price. From the moment that price is set, every fill in the market runs at it, whatever the price stream reports. **The flat price is the price you close at**, however far it sits from the stream you watched. The owner can replace that price at any point while the market stays delisted, and the market uses the last price the owner set.

If the market is still delisted seven days after the delist, any keeper can close any position still open in it, at any level of health. The liquidation fee applies to that close at its usual rate. Before that mark a keeper can close only a position under its maintenance margin, and the fee is the same. The mark removes the health test and nothing else. For what a close of this kind costs you, see [Liquidation](../trading/liquidation.md).

A freeze during the wind-down window pauses no part of it. Both the day and the seven days count from the delist that started the window, and a freeze leaves that start where it is. If the owner undoes the delist inside the first day, both counts are dropped. A later delist starts them again from zero.

## A retired market

Retirement is the end state, and no state follows it. A market retires only when no position is left open in it and no margin is left posted, so retirement strands no position. At that moment, whatever the market's credit pool holds beyond the balances it still owes traders moves to the vault.

Three paths stay live for you. You can claim a balance the market owes you. You can cancel a resting order, or a vault deposit or redeem that never filled, and take back everything the market holds for it. You can redeem your vault shares. A redeem in a retired market pays out inside your own call, so it waits for no keeper and serves no cooldown. For that path in full, see [Deposits and redeems](../vault/depositing.md).

## What the owner can undo

A freeze is reversible. The owner can lift a freeze, and the owner can take a market off ice. Both moves need a market that was never delisted, or one still inside the first day after its delist. If a market is more than one day past a delist, it can only stay delisted, be frozen, or be retired. Retirement is permanent, and no call moves a market out of it.
