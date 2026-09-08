---
title: Share value
sidebar_position: 3
---

# Share value

A vault share is a claim on the assets that one vault holds. The backing behind the shares is the vault's token balance. The vault adjusts it for the profit and loss that the open positions carry and do not yet settle. That pending amount is money the vault pays out or collects when those positions close. One share is worth that adjusted backing, divided across every share outstanding. The vault applies the adjustment before every conversion, in both directions. A deposit and a redeem therefore price at what the vault is worth at that moment. The conversion reads the vault as it stood before your own call. Your tokens are not backing yet when a deposit prices your shares, and your shares still count when a redeem prices your tokens.

## The value of one share

Every conversion starts from the vault's token balance and then applies the pending profit and loss of the open positions. Pending trader profit is money the vault owes, so it lowers what a share is worth. Pending trader loss is money the vault stands to collect, so it raises what a share is worth. Every conversion then divides that adjusted figure across the shares outstanding. The balance itself moves as value settles into and out of the vault, so the adjusted figure moves with it.

Take a vault that holds 1,040,000 tokens, against 1,000,000 shares outstanding. If the open positions sit 40,000 tokens in profit, the backing is 1,000,000 tokens and one share is worth 1 token. If they sit 40,000 tokens down instead, the backing is 1,080,000 tokens and one share is worth 1.08 tokens. The same share is worth 8 percent more in the second case.

## The mark runs against you

The open positions can be marked at more than one defensible price, because the market quotes a bid and an ask. The vault always takes the mark that is adverse to you.

A deposit reads the pending trader profit as low as the price allows. That values the vault high, so you receive fewer shares for your tokens. A redeem reads the same pending profit as high as the price allows. That values the vault low, so you receive fewer tokens for your shares. **Both marks are picked against you.** The difference between the two marks stays with the depositors who hold their shares.

Every conversion also rounds down, in the vault's favor. A deposit and a redeem at the same mark therefore return at most the tokens you put in. A round trip returns less than the tokens you deposited, because the deposit and the redeem price at two different marks. Each of the two fills also pays a vault fee. The gap between the two marks and the two vault fees is what a fast entry and exit costs you. A redeem on a retired market is the one exception. It pays out inside your own transaction and pays no vault fee.

## The price is set at the fill

Your order carries an amount and no price. A keeper fills it in a later ledger, and the price at that fill decides the conversion. To see which price that is, read [Prices](../markets/prices.md). A price published before you created the order cannot fill it.

Share value can move between the moment you sign and the moment a keeper fills you. The shares you receive on a deposit, and the tokens you receive on a redeem, move with it. To bound that move, set a minimum received on the order. For that bound and the rest of the order flow, read [Deposits and redeems](./depositing.md).

## What moves share value

Share value rises when the vault banks money. The vault keeps its share of every trade fee, after the keeper and the treasury take their cuts. It keeps its share of the vault fee that every deposit fill and every redeem fill pays, after the same two cuts. A liquidation pays a further fee on those terms, on top of the loss the closed position leaves behind. Borrowing interest splits differently. Open positions pay it for the liquidity they reserve, the treasury takes a cut, and the keeper takes none. The vault keeps the rest of it. The vault also keeps what traders lose, whether they close a position themselves or the market closes it for them. For the charges behind those inflows, read [Fees](../trading/fees.md) and [Borrowing interest](../trading/borrowing-interest.md).

Funding never moves share value. It passes from one side of the market to the other and stays with traders.

Share value falls when the vault pays money out. The vault pays a trader who closes in profit, and that payout lowers what the remaining shares hold. Bad debt has the same effect. When a position closes, the margin it frees pays that position's own fees and its own loss first. Bad debt is the part that runs past the freed margin, and the vault absorbs it. For the full set of exposures you take as a depositor, read [Risks](../risks.md).

## The profit the vault marks against itself

The vault marks a winning side's pending profit up to a ceiling. Longs and shorts each carry their own ceiling, and the ceiling is a fraction of half the vault balance. Profit above the ceiling stays out of the mark. The same allowance also scales down what a winner is paid, while that side's pending profit sits above the ceiling. Read [Profit and loss](../trading/pnl.md) for the payout side of it. The fraction is a market parameter. For who sets it, read [Governance](../governance.md).

The vault counts a pending loss as backing, up to the margin that side posted in total. A paper loss deeper than that margin cannot be collected, so the mark stops there.
