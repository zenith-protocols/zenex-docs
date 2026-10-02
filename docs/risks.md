---
title: Risks
sidebar_position: 7
---

# Risks

This page lists the ways you can lose money on Zenex, as a trader and as a liquidity provider. Each entry says what can happen to you and names the page that gives the mechanism in full.

Read it as a warning list. **Nothing on this page removes the risk it describes.** Commit only money you can afford to lose.

## A defect in the contracts can take money

Every trade, every deposit, and every payout runs through contract code. A defect in that code can take money, and no review proves that a defect is absent. For the reports from independent security firms, see [Audits](./audits.md).

## An owner can change the rules under your open position

Each market has one owner. The owner replaces the whole parameter set, moves the market between its states, and replaces the market's code in place. Your position, your margin, and your orders survive a code replacement, and the new rules then act on them. **A lost or misused owner key reaches your open positions.**

An owner can be a timelock, which holds each parameter change and code replacement in a public queue for a fixed wait. A change of state skips that queue, so a timelock gives no warning before a freeze, a delist, or a retirement. An owner can also give up ownership for good. If that happens while the market is frozen, the freeze never lifts, and every position and every deposit in the market stays out of reach. [Governance](./governance.md) gives the powers, the timelock, and the ways ownership ends. [Market parameters](./markets/market-parameters.md) lists the settings.

The vault has no owner, and no one can replace its code. It pays assets out only on a call from its market. A liquidity provider's exposure to owner powers therefore runs through the market's owner and the market's code.

## A wrong price reaches every position

Zenex acts on a signed price report from the one stream a market is bound to. The oracle checks each report for a valid signature, the right stream, and an acceptable age. Those checks bound what a bad report can do. They do not make the number right. If the stream publishes a wrong price, the market treats it as true, and positions open, close, and liquidate at it.

The oracle has an owner of its own. That owner sets the age limits and the share of the spread that the oracle removes, and it can replace the oracle's code. **Replacement code can return any price to every market that oracle serves.**

A gap in the stream is the other failure. While no keeper holds a fresh report, no trade order and no vault order fills. A liquidation accepts an older report than a fill does, so that it still runs during a gap. **When the two age limits differ, a keeper can liquidate you on a report too old to fill your order.** When reports resume, the market prices your position at the first one it accepts, and the whole move during the gap lands at once. For the checks, the two age limits, and the side of the quote your fill takes, see [Prices](./markets/prices.md).

## Nothing moves until a keeper acts

Your order does not fill until some account submits the fill, and no account owes you that work. Anyone can be a keeper, you included, and the reward on the fill is the reason others do it.

If no keeper acts, your order rests where it is. A stop loss can fill late, at a price past the level you named, or not at all. A liquidation can land late and leave a deeper shortfall behind. A deposit or a redeem waits the same way, and the market holds your escrow until the fill lands or you cancel.

A keeper cannot change your terms. The fill must sit inside your trigger and your bound. For the work a keeper does and the reward on each kind of call, see [Keepers](./keepers.md). For the terms you set, see [Orders](./trading/orders.md).

## A liquidation closes the whole position

Once your equity falls under the maintenance margin, any account can liquidate you. Your whole position on that side closes in one call. The market settles the costs of the close first, then takes the liquidation fee from what is left, and returns the remainder to you. **A position caught late returns little or nothing.**

Take a 10,000 USDC position on a market with a 2% maintenance margin. It becomes liquidatable once its equity falls under 200 USDC. With a liquidation fee of 0.5%, a position that holds 90 USDC of equity after the costs of the close returns 40 USDC to you. A position that holds 30 USDC returns nothing, because the fee takes it all.

Higher leverage puts your liquidation price nearer your entry price. Borrowing interest and any funding you pay push it nearer still while you hold. Funding you earn does not move it away, because the market credits that funding to you apart from the position. For the liquidation price and for what returns to you, see [Liquidation](./trading/liquidation.md) and [Margin and leverage](./trading/margin-and-leverage.md).

## The vault limits what a winner can take

The vault backs every position, so it limits the profit it recognizes on each side. Two rules act on a side that carries too much pending profit, and neither one asks you first.

The first rule scales a profit down. While a side's pending profit sits above the profit cap, a close pays a winner a reduced share of that profit. The vault keeps the rest. The scale keeps the vault from paying out more than it can back. Your margin and your losses are never scaled. For the cap and the scale, see [Profit and loss](./trading/pnl.md).

The second rule closes size for you. Auto-deleveraging (ADL) flags a side once its pending profit passes an upper level. Both ADL levels sit at or below the profit cap, so a side can be flagged before any payout is scaled down. Any account can set the flag by refreshing the measurement, and the refresh pays no reward. A later refresh is the only way to clear the flag. The flag comes off when a refresh finds the pending profit at or under the lower level.

While a side is flagged, no fill opens a position or adds size on it. An order that only adds margin still fills, so you can defend a position you hold. A keeper can reduce any winning position on the flagged side, and each reduction must lower that side's pending profit.

**A position that shows a small loss at your own exit price can still be reduced, and you get no notice and no place in a queue.** The market measures the side's profit at the price that favors the side, and your close settles at the other side of the quote. For the two levels and for what a reduction costs, see [Auto-deleveraging](./trading/adl.md).

## A liquidity provider takes the other side

A vault share is a claim on the vault that backs one market, and that vault is the counterparty to every position in the market. Trader losses stay in it. Trader profits are paid out of it.

A liquidity provider is therefore exposed to the combined result of everyone who trades that market. A long stretch of trader profit lowers what a share is worth, and you can redeem for less than you put in. Fees and borrowing interest are the income against that exposure. The keeper and the treasury take their cuts first. The owner of the treasury sets the treasury's cut at up to half of every fee. The vault keeps the rest.

A deposit and a redeem each price at the value that favors the vault. A deposit returns fewer shares, a redeem returns fewer tokens, and each pays a vault fee. For both effects, see [Share value](./vault/share-value.md).

## Bad debt falls on the vault

A fast move can take a position past the point where any equity is left. The loss then runs past the margin behind that position, and the shortfall is bad debt. The vault absorbs it, and the value of every share falls with it. A trader loses no more than the margin behind a position, so bad debt is the exposure of the liquidity providers.

If a close would draw more than the vault holds, the call fails. That holds for a winner's close and for a liquidation alike. The position stays open at its size and keeps moving with the price until a close that the vault can pay lands. For that failure and for the bad debt behind it, see [Liquidation](./trading/liquidation.md).

## A redeem or a deposit can be refused

Your redeem is an order, and it waits. A cooldown runs first, and a keeper fills it after that. At the fill, the market checks four things in order.

| What the fill finds | What happens |
| --- | --- |
| The redeem would return less than the minimum you set on the order. | The order is rejected. Your shares come back, the keeper keeps the execution fee, and the order is gone. |
| The redeem would ask for more tokens than the vault holds. Pending trader losses count toward what your shares are worth, so a large redeem can pass the balance. | The order keeps resting, and a keeper can try it again later. |
| Too little liquidity would stay behind for the open positions the vault backs. | The order keeps resting, and a keeper can try it again later. |
| Pending profit on either side would sit above its limit, measured against what stays in the vault after you are paid. | The order keeps resting, and a keeper can try it again later. |

A deposit that would return less than its minimum is rejected in the same way. A deposit that would carry the vault above the cap on its balance fails, and the order keeps resting. For the queue, the cancel, and the other reasons a fill waits, see [Deposits and redeems](./vault/depositing.md).

## A freeze holds your funds in place

While a market is frozen, no fill, no cancel, no deposit, no redeem, and no claim runs. Your position stays open at its size, and your escrow stays with the market until the freeze lifts. A freeze does not hold the price still. If the price moved against you during the freeze, a liquidation can follow as soon as the market accepts a price again. Borrowing interest and funding keep counting over the whole frozen period. [Market status](./markets/status.md) gives what each state stops.

## A wind-down runs on the owner's clock

The owner can delist a market, and new size stops at that moment. From one day after the delist, the owner can fix a flat settlement price. Every fill in that market then runs at that price, whatever the stream reports. The owner can replace it at any point while the market stays delisted. Seven days after the delist, any account can close any position still open, at any level of health and at the usual liquidation fee.

**A wind-down can close your position at a price and a time you did not pick.** While the market is not frozen, you can close the position yourself, cancel your resting orders, and redeem your shares. After the seventh day a keeper can close the position first. The owner can retire a market once every position in it is closed. A retired market never trades again. There you can claim a balance, cancel an order, and redeem your shares in your own transaction, with no keeper involved. For the five states and the clock, see [Market status](./markets/status.md).

## Law and access

Rules for digital assets and derivatives differ by country, and they change. Zenex can become unavailable or unlawful where you are, and you are responsible for the law that applies to you. Access through any one app can also stop. The contracts stay on the Stellar network without that app, and anyone can call them directly. An order you sign still needs a keeper to fill it.
