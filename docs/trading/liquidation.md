---
title: Liquidation
sidebar_position: 10
---

# Liquidation

Liquidation is the close a keeper runs on your position once its equity falls under the maintenance margin's share of its size. It is the event that takes the most money from a trader on Zenex. Any account can run it. The whole position closes at once. A liquidation fee comes out of what is left before anything reaches you. This page gives the line that triggers a liquidation, the wind-down case that needs none, what the close costs, and what returns to you.

## When your position becomes liquidatable

Your position becomes liquidatable once its equity falls under the maintenance margin's share of its size. Equity is what the position would return if it closed at the current price. It is your margin, plus your profit or loss, less the costs the close settles. Those costs are the trade fee and the impact fee on the whole size, the borrowing interest, and any funding you owe.

The size in that test is the size you entered with. A price move does not change it. On a market with a 2% maintenance margin, a position of 10,000 USDC in size becomes liquidatable once its equity falls under 200 USDC. A position that sits exactly at the requirement is not liquidatable. A position one cent under it is.

The [Margin and leverage](./margin-and-leverage.md) page gives the two margin lines and what each one measures.

## Your liquidation price

The same rule reads as a price level. Take a long of 10,000 USDC in size at 20x leverage on that market. Your collateral is 500 USDC and the maintenance margin is 2%. The position becomes liquidatable once its equity falls under 200 USDC. Before costs, that takes a loss of 300 USDC, an adverse move of 3%. Entered at 2.50 USDC, the long would start liquidatable at 2.425 USDC. The mirror short entered at 2.50 USDC would start at 2.575 USDC.

The costs of the close fall on the same side as the loss, so the real line sits nearer your entry price than that. The two fees count against your equity from the first second. The interest and any funding you pay accrue on top of them every second the position stays open. The line therefore creeps toward your entry price over time.

Two things push the line away from your entry price. Added collateral raises your equity at once. Lower leverage starts the line further away in the first place. At 5x in the same example your collateral is 2,000 USDC. The line then starts at an adverse move of 18% before costs.

## Any keeper can close the whole position

A liquidation is permissionless. Any account can act as a keeper and submit the call against any position. The market checks the health of the position, not the identity of the keeper. The call names the account that receives the reward, and that account need not be the one that submits the call. The named account collects a share of the trade fee, the impact fee, and the liquidation fee. The borrowing interest and the funding you owe pay the named account nothing.

A liquidation always takes the whole position. The keeper names your account and the side, and every unit of size on that side closes in one call. You cannot be liquidated for part of your size and left with the rest.

The keeper submits a price report, and the market decides the exit price from it. If the market already holds a newer price than the report, it closes you at the newer one. A delisted market that carries a flat settlement price closes you at that price and reads no report at all.

Two limits on your own close do not limit a keeper. Size you added moments ago is locked against your own decrease, and a liquidation closes it anyway. A liquidation also accepts an older price report than an order fill does. A report too stale to fill your order can still liquidate you.

## The liquidation fee

Every liquidation charges a liquidation fee on top of the ordinary costs of the close. The rate is set per market. The fee is that rate on the size that closes, rounded up. On the 10,000 USDC position above, a rate of 0.5% makes the fee 50 USDC. The protocol holds the rate below that market's maintenance margin. It also caps the rate at 25%. For how a rate changes, see the [parameter-change process](../governance.md).

**The fee is capped at the equity that survives your loss and the other costs of the close.** It therefore takes what is there and never more, and it can never push your payout below zero. A position that has already lost everything pays a fee of zero.

The fee divides between the keeper, the treasury, and the vault in the same proportions as a trade fee. The [Fees](./fees.md) page gives that split. The keeper's share of the fee is flat, so a keeper who waits for your equity to fall further earns no more.

## What comes back to you

The order of operations is what decides your payout. The market prices your whole position at the exit price. It settles the costs of the close first. It then applies your profit or loss to what is left. A profit meets the cap that scales down a payout once the pending profit on your side of the market runs past its allowance. The [Profit and loss](./pnl.md) page gives that cap. The liquidation fee comes out of the remainder. What survives the fee reaches you.

Funding you are owed does not join that payout. The market banks it as claimable credit, and you take it in a call you sign yourself. The [Claimable credit](./claimable-credit.md) page gives how you claim it.

**A position liquidated close to insolvency returns little or nothing.** The table takes the same 10,000 USDC position and a fee rate of 0.5%, at three levels of health.

| Equity left before the fee | Liquidation fee | Returned to you |
| --- | --- | --- |
| 90 USDC | 50 USDC | 40 USDC |
| 30 USDC | 30 USDC | 0 USDC |
| 0 USDC | 0 USDC | 0 USDC |

The second row is the cap at work. The rated fee of 50 USDC is larger than the 30 USDC that survived, so the fee takes the 30 USDC and stops. A position caught while it still holds real equity keeps most of that remainder. A position caught after a violent move keeps none of it.

For a take-profit or a stop-loss still resting against a liquidated position, see [Positions](./positions.md).

## When the loss runs past your margin

A fast market can take a position past the point where any equity survives. The loss and the costs then run past the margin behind the position, and the shortfall is bad debt. The vault absorbs it. **The margin behind a position is the most that position can lose, and the protocol never asks you for more.** The maintenance margin exists to keep most positions clear of that point. The keeper reward exists to make sure someone acts before a position reaches it.

A liquidation still has to settle. Your own remainder comes out of the margin the market already holds. The vault is the counterparty to that settlement. It pays out a realized profit, it takes in a realized loss, and it absorbs the part of a loss that runs past your margin. If a single liquidation would draw more than the vault holds, the call fails and the position stays open. The [Vault](../vault/overview.md) page gives what backs a market.

## A delisted market

A delisted market carries every open position until someone closes it. Seven full days after the delisting, any keeper can close any remaining position on that market, whatever its health. You can close your own position at any point before that. The liquidation fee is charged at the same rate as on any other liquidation. A healthy position closed this way keeps its equity after the costs of the close and that fee.

A liquidation runs in the active, on ice, and delisted states. A frozen market and a retired market run none. The [Market status](../markets/status.md) page gives the states a market moves through. It also gives the flat settlement price a delisted market can close at.
