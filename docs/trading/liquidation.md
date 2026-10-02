---
title: Liquidation
sidebar_position: 10
---

# Liquidation

A liquidation is the forced close of your whole position, run by a [keeper](../keepers.md) once the position's equity falls under its maintenance margin. Equity is what the position would return if it closed now. The maintenance margin is a share of the position's size that each market sets. A liquidation also charges a liquidation fee on what is left. This page covers the trigger and the price it implies. It then covers who can run it, what it costs, and what returns to you. It closes on the wind-down case that needs no trigger.

## Your position is liquidatable when equity falls under the maintenance margin

Your equity is your margin, plus or minus your unrealized profit or loss, less the costs the close settles. Those costs are the trade fee and the impact fee on the whole size, the borrowing interest, and any funding you owe. The [Fees](./fees.md) page gives each charge. Once your equity is under the maintenance margin, the position is liquidatable.

The size in that test is the value of your position at your entry price. A price move does not change it, and a fill that adds to the position does. On a market with a 2% maintenance margin, a position of 10,000 USDC in size is liquidatable once its equity falls under 200 USDC. Equity exactly at the line is safe. Any amount under it is not.

The [Margin and leverage](./margin-and-leverage.md) page gives the maintenance margin and the initial margin, and says what each one measures.

## Your liquidation price moves toward your entry price over time

The same rule reads as a price. Your liquidation price is the price at which your equity reaches the maintenance margin. Take a long of 10,000 USDC in size, entered at 2.50 USDC. The market has a 2% maintenance margin and allows 20x leverage. Your collateral is 500 USDC, so your equity starts near 500 USDC and the line sits at 200 USDC. The position can lose 300 USDC before it is liquidatable. That loss is 3% of the size, so before costs the price must move 3% against you.

| Leverage | Collateral | Loss before the line | Move against you | Liquidation price of the long | Liquidation price of the short |
| --- | --- | --- | --- | --- | --- |
| 20x | 500 USDC | 300 USDC | 3% | 2.425 USDC | 2.575 USDC |
| 5x | 2,000 USDC | 1,800 USDC | 18% | 2.05 USDC | 2.95 USDC |

The table gives the price before costs. The costs of the close fall on the same side as the loss, so the real liquidation price sits nearer your entry price. The trade fee and the impact fee count against your equity from the first second. The borrowing interest and any funding you owe accrue on top of them for as long as the position stays open. The liquidation price therefore drifts toward your entry price while you hold.

Added collateral raises your equity at once and moves the liquidation price away from your entry price. Lower leverage starts it further away.

## Any keeper can close the whole position

A liquidation is permissionless. Any account can act as a keeper and submit the call against any position. The market checks the health of the position, not the identity of the caller. The keeper names your account and the side. Every unit of size on that side closes in one call.

The keeper also names the account that receives the reward, and that account need not be the one that submits the call. The reward is a share of the trade fee, the impact fee, and the liquidation fee. The borrowing interest and the funding you owe pay it nothing. The [Keepers](../keepers.md) page gives the other calls a keeper can make.

The keeper submits a price report, and the market decides the exit price from it. If the market already holds a newer price than the report, it closes you at the newer one. A report older than the price of your last fill cannot liquidate you. A delisted market with a flat settlement price closes you at that price and reads no report at all.

Two limits that apply to your own orders do not apply to a liquidation. Size you added moments ago is locked against your own decrease, and a liquidation closes it anyway. The [Positions](./positions.md) page gives that lock. A liquidation also accepts an older price report than an order fill does, because a stalled price stream must not leave a failing position open. The [Prices](../markets/prices.md) page gives the two age limits.

## The liquidation fee comes out of what survives the close

Every liquidation charges a liquidation fee on top of the ordinary costs of the close. Each market sets the rate. The fee is that rate on the size that closes, rounded up. On the 10,000 USDC position above, a rate of 0.5% makes the fee 50 USDC. The protocol holds the rate under the market's maintenance margin and caps it at 25%. For how a rate changes, see the [parameter-change process](../governance.md).

**The fee is capped at the equity that survives your loss and the other costs of the close.** It takes what is there and no more. It cannot push your payout below zero. A position that has already lost everything pays a fee of zero.

The fee divides between the keeper, the treasury, and the vault in the same proportions as a trade fee. The [Fees](./fees.md) page gives that split. The keeper's share is a fixed rate of the fee. Your equity does not raise it, and the cap can only lower the fee as your equity falls. A keeper that waits therefore never earns more.

## Your payout is what remains after the costs and the fee

The market prices your whole position at the exit price and works out four amounts.

1. Your margin.
2. Your profit or loss on the whole size. A profit is first scaled down if your side of the market carries more profit than the vault allows. The [Profit and loss](./pnl.md) page gives that cap.
3. Less the trade fee and the impact fee of the close.
4. Less the borrowing interest and any funding you owe.

The total is your equity. The liquidation fee then comes out of it, and what survives the fee reaches you. A total under zero pays you nothing.

Funding you are owed does not join that payout. The market banks it as claimable credit, and you take it in a call you sign yourself. The [Claimable credit](./claimable-credit.md) page gives how you claim it. A take profit or a stop loss still resting against the position is cancelled in the same transaction, and its escrow returns to you. The [Positions](./positions.md) page gives that cancel.

**A position liquidated with its equity nearly gone returns little or nothing.** The table takes the same 10,000 USDC position at three levels of health, with a fee rate of 0.5%.

| Equity after the costs of the close | Liquidation fee | Returned to you |
| --- | --- | --- |
| 90 USDC | 50 USDC | 40 USDC |
| 30 USDC | 30 USDC | 0 USDC |
| 0 USDC or less | 0 USDC | 0 USDC |

The second row is the cap at work. The rated fee of 50 USDC is larger than the 30 USDC that survived, so the fee takes the 30 USDC and stops. A position caught while it still holds real equity keeps most of that remainder. A position caught after a violent move keeps none of it.

## The vault absorbs a loss beyond your margin

A fast market can take a position past the point where any equity survives. The loss and the costs then run past the margin behind the position. That shortfall is bad debt, and the vault absorbs it. **The margin behind a position is the most that position can lose, and the protocol never asks you for more.**

The vault is the counterparty to every liquidation. It pays out a realized profit, it takes in a realized loss, and it covers the part of a loss that runs past your margin. The maintenance margin keeps most positions clear of that point. The keeper reward gives someone a reason to act before a position reaches it.

If one liquidation would draw more than the vault holds, the call fails and the position stays open. Your position keeps its size and keeps accruing borrowing interest and funding. Any keeper can submit the close again once a price lets the vault pay it. The [Vault](../vault/overview.md) page gives what backs a market, and the [Risks](../risks.md) page gives this failure among the others.

## A delisted market opens a forced close after seven days

A delisted market carries every open position until someone closes it. Before the seventh day, a keeper can close a position only if its equity is under the maintenance margin, as in any other market. Seven full days after the delisting, any keeper can close any remaining position on that market, whatever its health. The forced close empties the market so that it can retire.

Your own close stays open the whole time, including after the seventh day. The liquidation fee is charged at the same rate as on any other liquidation. A healthy position closed this way keeps its equity after the costs of the close and that fee.

A market runs a liquidation while it is active, on ice, or delisted. A frozen market waits for the freeze to lift. The [Market status](../markets/status.md) page gives the states a market moves through and the two windows of the wind-down. It also gives the flat settlement price a delisted market can close at.
