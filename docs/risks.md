---
title: Risks
sidebar_position: 7
---

# Risks

Zenex can cost you money in ways that have nothing to do with your view on the price. This page collects those ways in one place, for a trader and for a depositor. Each item states what can happen to you, and it names the page that gives the mechanism in full.

Read it as a warning list. **Nothing on this page removes the risk it describes.** Commit only money you can afford to lose.

## The owner and the code

Every trade, every deposit, and every payout runs through contract code. A defect in that code can take money, and no review proves that a defect is absent. For the reports from independent security firms, see [Audits](./audits.md).

Each market has one owner. The owner replaces the whole parameter set, moves the market between its states, and replaces the market's code in place. Your position and your margin survive a code replacement, and the new rules then act on them. The oracle that checks prices has an owner of its own. That owner sets the age windows and the share of the spread that every market on that oracle uses. **An owner key that is lost or misused reaches your open positions.** No account owns the vault, and no one can replace its code. Assets leave the vault only on a call from the market, and the market owner can replace the market's code. Your deposit sits behind that code either way.

An owner can be a timelock contract that runs a parameter change or a code replacement only after a public wait. An owner can also give up ownership for good, and the market then keeps the state it is in. **A market given up while it is frozen stays frozen, and every position and every deposit in it stays out of reach.** For the powers an owner holds and the limits an owner can accept, see [Governance](./governance.md). For the settings inside the parameter set, see [Market parameters](./markets/market-parameters.md).

## The price feed

Zenex acts on a signed price report from the one stream a market is bound to. The oracle refuses a report that carries a wrong signature or no signature at all. It then checks that the report names that stream. It also checks the expiry, the age, the forward skew, and the quote. Those checks bound what a bad report can do. They do not make the number right. If the stream publishes a wrong price, the market treats it as true, and positions open, close, and liquidate at it.

A gap in the stream is the other failure. While no keeper holds a fresh enough report, no trade order and no vault order fills. A liquidation runs on a wider age window, and that window is never shorter than the one a fill runs on. **A keeper can close you out on a report too old to fill an order of yours, whenever the two windows differ.** A position that survives a gap is marked at the first price that lands after it. For the checks, the two windows, and the side of the quote your fill takes, see [Prices](./markets/prices.md).

## Nothing moves until a keeper acts

Your order does not fill by itself. Some account must submit the fill, and no account owes you that work. Anyone can run it, you included, and the reward on the fill is the whole reason someone acts.

If no keeper acts, your order rests where it is. A stop-loss can fill late, at a price past the level you named, or not at all. A liquidation can land late, and a late liquidation leaves a deeper shortfall behind. A deposit and a redeem wait the same way, and the market holds your escrow until the fill lands.

What bounds this is the order you signed. A keeper picks which order to fill and changes no term you signed into it. The fill must sit inside your trigger and your bound. For the work a keeper runs and the reward on each kind, see [Keepers](./keepers.md). For the terms you set, see [Orders](./trading/orders.md).

## Liquidation takes the whole position

Once your equity falls under the maintenance margin, any account can close your position. The whole position on that side closes at once, and none of it stays open. What is left of your equity after the costs of the close returns to you. A liquidation fee comes out of the equity that survives those other costs, so **a position caught late returns little or nothing.** Higher leverage starts the liquidation line nearer your entry price, and borrowing interest moves it nearer still while you hold. Funding moves it nearer on the side that pays. Funding you earn is credited to you apart from the position, so it moves the line neither way. For the line and for what returns to you, see [Liquidation](./trading/liquidation.md) and [Margin and leverage](./trading/margin-and-leverage.md).

## The vault caps a win, and a keeper can close one for you

Two rules bound what one side of a market can draw from the vault. Both act on a side that carries too much pending profit, and neither one asks you first.

The first rule scales a realized profit down. While a side's pending profit sits above its allowance, a close pays a winner a reduced share of that profit. The vault keeps the rest. Your margin is never scaled, and a loss is never scaled. Your payout is final at the close. For the allowance and the scale, see [Profit and loss](./trading/pnl.md).

The second rule closes size for you. Auto-deleveraging runs on two levels of its own, and both sit at or below the allowance above. A side is flagged once its pending profit passes the higher of the two. A side can therefore be flagged before any payout is scaled down. Any account can set the flag, and setting it pays no reward. A side can run above the level with no flag on it. The same call is the only way to clear a flag, so a side stays flagged after its profit falls back inside the level. While a side is flagged, no fill opens a position on it or grows one you already hold. An order that only adds collateral still fills, so you can defend the margin behind a position. Any position on the flagged side is a candidate once its close lowers that side's profit. The market measures that profit at the price that favors the side. A position that shows a small loss at your own exit price can still be taken. **You get no notice, no queue, and no place in line.** For the two levels and for what a reduction costs, see [Auto-deleveraging](./trading/adl.md).

## A depositor takes the other side

A vault share is a claim on the vault that backs one market, and that vault is the counterparty to every position in the market. Trader losses stay in it. Trader profits are paid out of it.

A depositor is therefore exposed to the aggregate result of everyone who trades that market. A long stretch of trader profit lowers what a share is worth, and you can redeem for less than you put in. Fees and borrowing interest are the income that stands against that exposure. A deposit and a redeem are also each priced at the side of the mark that pays you less. A deposit returns fewer shares, and a redeem returns fewer tokens. For both effects, see [Share value](./vault/share-value.md).

## Bad debt falls on the vault

A fast move can take a position past the point where any equity is left. The loss then runs past the margin behind that position, and the shortfall is bad debt. The vault absorbs it, and the value of every share falls with it. A trader is never asked for more than the margin behind the position, so this exposure sits with the depositors.

A close that would draw more than the vault holds fails outright. The position stays open until someone closes it at a price the vault can pay. For that failure and for the bad debt behind it, see [Liquidation](./trading/liquidation.md).

## A redeem can be refused

Your redeem is an order, and it waits. A cooldown runs first, and a keeper fills it after that. At the fill the market runs four more checks. The vault must hold enough tokens to pay you. Pending trader losses raise what a share redeems for, so the amount owed can pass the balance the vault holds. The fill must return at least the minimum you set on the order. Enough liquidity must stay behind for the open positions the vault backs. Pending trader profit on each side must be at or under its limit, measured against what stays in the vault after the vault pays you. A redeem that fails a check keeps resting, and a keeper can try it again later. A deposit has a refusal of its own, the cap on the vault balance.

A frozen market blocks the way out entirely. No fill runs, and no cancel runs either, so your escrow stays with the market until the freeze lifts. For the queue, the cancel, and every reason a fill is refused, see [Deposits and redeems](./vault/depositing.md).

## A wind-down runs on the owner's clock

The owner can delist a market, and new size stops at that moment. One day after the delist the owner can set a flat settlement price. From then on every fill in that market runs at that price, whatever the stream reports. The owner can replace it at any point while the market stays delisted, and the market uses the last price the owner set. Seven days after the delist, any account can close any position still open, at any level of health. The liquidation fee applies to that close at its usual rate.

**A wind-down ends your position on a schedule you did not pick.** Close it yourself inside the window, cancel your resting orders, and redeem your shares. A retired market never trades again. What stays open there is your claim on funds. You can claim a balance, cancel a resting order, and redeem your shares yourself, with no keeper involved. For the five states and the clock, see [Market status](./markets/status.md).

## Law and access

Rules for digital assets and derivatives differ by country, and they change. Zenex can become unavailable or unlawful where you are, and you are responsible for the law that applies to you. Access to any given front end can also stop. The contracts stay reachable on chain either way.
