---
title: Market status
sidebar_position: 3
---

# Market status

A market is always in one of five states, and the state decides which actions the market accepts. An action is anything you or a keeper asks the market to do, such as fill, cancel, deposit, redeem, claim, or liquidate. The owner sets the state, and the market publishes every change on chain. Active is normal trading. On ice stops new size. Frozen is an emergency halt. Delisted winds the market down, and retired ends it. For who the owner is and what else the owner can change, see [Governance](../governance.md).

## Five states decide which actions run

| State | What runs | What stops |
| --- | --- | --- |
| Active | Every action. | A fill that adds size on a side that auto-deleveraging has flagged. |
| On ice | Every action except a fill that adds size. | Any fill that opens a position or adds size to one. |
| Frozen | The changes the owner makes to the market and its settings. | Every other action, for you and for the keepers. |
| Delisted | Every action except a fill that adds size. | Any fill that opens a position or adds size to one. |
| Retired | Claims, cancels, vault redeems, and the owner's changes to every setting except the borrowing and funding curves. | Every fill, every new order, every vault deposit, and every liquidation. |

## On ice and delisted stop new size only

Both states let a market shrink without taking on new risk. No keeper can fill an order that opens a position or grows one you already hold. You can still place that order. The market holds it, and it rests until the state changes or the order expires. An order that only adds margin still fills, so you can defend a position you hold. In every state, a side that auto-deleveraging has flagged also takes no new size. See [Auto-deleveraging](../trading/adl.md) for the flag.

Every other action keeps running, so the way out stays open. That covers a decrease, a close, a liquidation, an auto-deleveraging fill, a vault deposit, a vault redeem, a cancel, and a claim. On ice these run at the price the keepers submit. In a delisted market they run at the flat settlement price once the owner sets one.

## A freeze halts every action and leaves your position open

The owner uses a freeze as an emergency halt. A fill needs a price, and a cancel, a deposit, a redeem, and a claim move funds. The freeze stops all of them. Your position, your margin, your resting orders, and the escrow behind them stay as they are. You reach none of them until the owner lifts the freeze.

**A frozen market reprices your position the moment it reopens.** Your position stays open at its size. The market values it at the first price a [keeper](../keepers.md) submits after the freeze lifts. If the price moved against you in the meantime, a keeper can liquidate you at once. You cannot add margin while the freeze lasts.

Borrowing interest and funding keep accruing through a freeze. Your next settlement charges both for the whole frozen period. That settlement can come from your own fill, a liquidation, or an auto-deleveraging fill. Borrowing interest comes out of the margin of the larger side, and the smaller side pays none. See [Borrowing interest](../trading/borrowing-interest.md). Funding comes out of the margin of the paying side. The receiving side earns it as [claimable credit](../trading/claimable-credit.md). See [Funding rate](../trading/funding-rate.md).

The owner can change the borrowing and funding curves while the market is frozen. The first update after the freeze then bills everything since the last update at the curves in force at that moment. The owner therefore decides what the frozen period costs you.

The owner lifts a freeze by setting another state. If a delist is at least one day old, a lifted freeze lands in delisted or retired, and never in active or on ice.

## A delist opens two windows toward a forced close

A delist stops new size and starts a wind-down with two windows. Both count from the delist. The first lasts one day. The second lasts seven days.

**The first window is the one day in which the owner cannot fix a flat price, so every close runs at the price stream.** During it, the owner can undo the delist by setting the market back to active or on ice. An undo drops both windows, and a later delist starts them again from zero. Once the day ends, the market can move to frozen or retired, or stay delisted, and it never returns to active or on ice.

When the first window ends, the owner can fix a flat settlement price. From the moment the owner sets it, every fill in the market runs at that price, whatever the price stream reports. The owner can replace it while the market stays delisted. The protocol checks only that the price is above zero. **The flat price is the price you close at**, however far it sits from the stream you watched.

When the second window ends, any keeper can close any position still open in the market, whatever its equity. Before then a keeper can close only a position whose equity has fallen under the maintenance margin. This forced close empties the book so that the market can retire. The liquidation fee applies as on any liquidation, and it never exceeds the equity the close frees. For what a close of this kind costs you, see [Liquidation](../trading/liquidation.md).

A freeze in a delisted market stops neither window. If the seven days pass during a freeze, a keeper can close any position as soon as the freeze lifts. A flat settlement price the owner has already set stays in force through the freeze. **A freeze that covers the first day leaves you no close at the price stream before the owner can fix a flat price.**

## A retired market keeps three exits open

Retirement is the end state, and no state follows it. A market retires only when every position is closed and no margin is posted. At that moment the market pays the vault whatever its credit pool holds beyond the balances it still owes traders. The credit pool is the one reserve that backs every claim in the market. No trader is owed that surplus, so the vault takes it.

Three paths stay live for you. You can claim a balance the market owes you. You can cancel a resting order, or a vault deposit or redeem that never filled, and take back everything the market holds for it. You can redeem your vault shares. A redeem in a retired market pays out in the same transaction that creates it, so it waits for no keeper and no cooldown. For that path in full, see [Deposits and redeems](../vault/depositing.md).
