---
title: Share value
sidebar_position: 3
---

# Share value

This page covers what one vault share is worth, which price sets that worth at your fill, and what moves it up or down.

A vault share is a claim on the assets that one vault holds. The backing behind the shares is the vault's token balance. The vault adjusts it for the profit and loss that the open positions carry and have not yet settled. That pending amount is money the vault pays out or collects when those positions close. To mark a position is to value it at the current price, so the adjustment is the vault's mark of the open positions. One share is worth the adjusted backing divided across every share outstanding.

The vault applies the mark before every conversion, in both directions. A deposit and a redeem therefore price at what the vault is worth at that moment. The conversion reads the vault as it stood before your own call. Your tokens are not backing yet when a deposit prices your shares, and your shares still count when a redeem prices your tokens.

## One share is worth the adjusted backing

Every conversion starts from the vault's token balance and then applies the pending profit and loss of the open positions. Pending trader profit is money the vault owes, so it lowers what a share is worth. Pending trader loss is money the vault stands to collect, so it raises what a share is worth. The balance itself moves as value settles into and out of the vault, so the adjusted figure moves with it.

Take a vault that holds 1,040,000 tokens, against 1,000,000 shares outstanding. The table shows one share at three marks.

| Open positions carry | Backing | One share is worth |
| --- | --- | --- |
| 40,000 tokens of profit | 1,000,000 tokens | 1.00 token |
| No profit or loss | 1,040,000 tokens | 1.04 tokens |
| 40,000 tokens of loss | 1,080,000 tokens | 1.08 tokens |

The same share is worth 8 percent more in the last row than in the first. The figures ignore rounding and fees.

## The mark runs against you

The market quotes a bid and an ask, so the open positions can be marked at more than one defensible price. The vault always takes the mark that is adverse to you.

A deposit reads the pending trader profit as low as the price allows. That values the vault high, so you receive fewer shares for your tokens. A redeem reads the same pending profit as high as the price allows. That values the vault low, so you receive fewer tokens for your shares. **Both marks are picked against you.** The difference between the two marks stays with the liquidity providers who hold their shares.

Suppose the same vault reads 30,000 tokens of pending profit at the low mark and 50,000 tokens at the high mark. A deposit then prices one share at 1.01 tokens, and 10,000 tokens buy about 9,900 shares. A redeem prices one share at 0.99 tokens, so those 9,900 shares return about 9,800 tokens. The gap of about 200 tokens is the cost of the two marks alone.

Every conversion also rounds down, in the vault's favor. A deposit and a redeem at the same mark therefore return at most the tokens you put in. A round trip returns less than you deposited, because the two conversions price at two different marks. Each fill also pays a vault fee. The gap between the two marks and the two vault fees is what a fast entry and exit costs you.

A redeem on a retired market is the one exception. A retired market carries no open positions, so the mark is zero. That redeem pays out inside your own transaction and pays no vault fee.

## The price is set at the fill

Your order carries an amount and no price. A keeper fills it in a later ledger, and the price at that fill decides the conversion. Only a price published at or after the creation of your order can fill it. To see which price that is, read [Prices](../markets/prices.md).

Share value can move between the moment you sign and the moment a keeper fills you. The shares you receive on a deposit, and the tokens you receive on a redeem, move with it. To bound that move, set a minimum received on the order. For that bound and the rest of the order flow, read [Deposits and redeems](./depositing.md).

## Fees and trader losses lift share value, payouts and bad debt lower it

Share value rises when the vault banks money. The vault keeps its share of the trade fee and the impact fee on every fill, after the keeper and the treasury take their cuts. It keeps its share of the vault fee that every deposit fill and every redeem fill pays, after the same two cuts. A liquidation adds the liquidation fee to the amount that the keeper, the treasury, and the vault divide. For how a liquidation charges it, read [Liquidation](../trading/liquidation.md).

Borrowing interest splits two ways. Open positions pay it for the liquidity they reserve, the treasury takes its cut, and the vault keeps the rest. For the charges behind these inflows, read [Fees](../trading/fees.md) and [Borrowing interest](../trading/borrowing-interest.md).

A trader's loss raises share value while the position is open, because the mark already counts it. Closing the position moves that loss into the vault balance. The mark drops by the same amount, so the close does not raise share value again.

A trader's profit lowers share value while the position is open, for the same reason. When the trader closes, the vault pays the profit out, and share value does not fall again by the amount the mark already counted. The next section covers the profit that the mark leaves out.

Bad debt lowers share value at the close. When a position closes, the margin it frees pays that position's own fees and its own loss first. Bad debt is the part that runs past the freed margin, and the vault absorbs it. For the full set of exposures you take as a liquidity provider, read [Risks](../risks.md).

Funding never moves share value. It passes from one side of the market to the other. Funding you pay stays in the market, and funding you earn becomes your claimable credit. The vault receives neither.

## The profit cap and the margin floor limit the mark

The vault marks a winning side's pending profit only up to the profit cap. Longs and shorts each carry their own cap, and it is a fraction of half the vault balance. Profit above the cap stays out of the mark.

The same cap scales down what a winner is paid. While a side's pending profit is above its cap, a winner receives a scaled-down share of the profit, and the vault keeps the rest. The further the side runs past its cap, the smaller the share. Read [Profit and loss](../trading/pnl.md) for the payout side of the profit cap. The fraction is a market parameter, and [Governance](../governance.md) covers who sets it.

The vault counts a pending loss as backing, up to the margin that side posted in total. A paper loss deeper than that margin cannot be collected, so the mark stops there.

## What this means for you

Your shares keep their count and change in value. That value follows the fees the vault banks, the losses of the traders, the profit the vault pays out, and the bad debt it absorbs. A deposit and a redeem each price at the mark that is adverse to you, and each pays a vault fee. If you leave soon after you enter, you pay the gap between the marks and both fees. If you stay longer, the fees and trader losses that build up in between count for you.
