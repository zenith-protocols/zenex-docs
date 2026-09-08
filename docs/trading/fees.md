---
title: Fees
sidebar_position: 5
---

# Fees

A fill that moves size charges a trade fee and an impact fee, and both scale with the size the fill moves. A fill that consumes an order also charges a flat execution fee, one fixed amount per order. A fill that only moves collateral charges neither the trade fee nor the impact fee. Every fill settles the borrowing interest and any funding you owe. This page itemizes each charge and says where it goes.

You escrow the execution fee when you create the order. An increase order escrows the margin you post plus the execution fee. A decrease order escrows the execution fee alone. Each order carries the execution fee that was in force when you created it. The market computes the trade fee and the impact fee at the fill, from that market's rates at that moment. On an open, both come out of the margin you posted. On a close, your realized profit pays them first, and the position's margin pays what the profit did not cover. The borrowing interest and any funding you owe come off the same way.

The two trade fee rates, the execution fee, the growth of the impact fee with size, and the keeper share are per-market parameters. The treasury share is a single rate that covers every market. The protocol caps each of the two trade fee rates at 1% of the size a fill moves. It caps the impact fee at 10% of that size. For how a value changes, see the [parameter-change process](../governance.md). For the values in use, see [Market parameters](../markets/market-parameters.md#current-testnet-values).

## The trade fee

The trade fee applies to the size a fill moves, on an open and on a close alike. A fill that only adds or removes collateral moves no size and pays no trade fee.

Each market carries two trade fee rates, and your fill can pay both. The higher rate applies to the part of the fill that pushes long and short exposure further apart. The lower rate applies to the part that brings them closer together. The market weighs the tokens held long against the tokens held short, so a price move alone never decides which side is crowded.

A fill that adds to the crowded side pays the higher rate on its whole size. A fill out of a balanced book pays the higher rate too, whichever side it takes. A fill that brings the two sides closer together pays the lower rate, and a close on the crowded side is such a fill. If your fill carries the book past balance and onto the other side, the two rates divide it. The part that runs the imbalance down to zero pays the lower rate. The part beyond zero pays the higher rate. The gap between the two rates is what makes the underrepresented side cheaper to take.

## The impact fee

Every fill that moves size pays the impact fee on the full size of the fill, whichever way that fill moves the balance. The rate grows with the size, so the fee grows faster than the size does. Below the ceiling, double the size of a fill and the fee is four times as large.

Each market sets how fast that rate grows, tuned to the liquidity of the asset. The numbers that follow are an illustration and not a rate in use. Take a market where a 1,000 USDC fill pays 10 USDC. On that market a 2,000 USDC fill pays 40 USDC, and the rate went from 1% to 2%. The rate stops at the ceiling of 10% of the fill. Above that point the fee grows in step with the size.

An order never fills in parts, so the fee follows the whole size that the fill moves. That size is the size your order asks for, unless a decrease closes your position in full. A decrease at or above your open size closes it in full. So does one that would leave less than the market's minimum position size. Below the ceiling, several smaller orders pay less impact fee in total than one large order. Once every part sits above the ceiling, a split saves nothing.

## The execution fee

Each order carries a flat execution fee, set per market. You escrow it when you create the order, on top of any margin you post. A fill pays it in full to the keeper named on the fill. Whoever submits the fill names the account that receives the fee. If you cancel the order, you get the fee back in full. A close of your whole position removes every decrease order left on that side and returns each escrow to you.

A liquidation and a forced close under auto-deleveraging consume no order, so neither carries an execution fee. A liquidation pays its keeper a share of the trade fee, the impact fee, and the liquidation fee. A forced close under auto-deleveraging pays a share of the trade fee and the impact fee. For what the liquidation fee is and what it costs you, see [Liquidation](./liquidation.md).

## The network fee

Every transaction on chain costs a network fee. Zenex charges a fee in the token you trade with, so you do not need to hold the network's own asset. Your signature on the transaction fixes the token that fee is paid in and a ceiling on the amount. A relayer sends your signed transaction to the network. The relayer picks the amount inside your ceiling and names the account that receives it. The amount is the relayer's own charge and does not track what the chain costs, so budget for your ceiling. A fee above your ceiling fails the whole transaction.

**A transaction that fails as a whole charges you nothing.** A transaction that lands and leaves your order resting still charges the network fee, because the transaction did its work.

## Where your fees go

The trade fee and the impact fee divide three ways at the fill. The keeper takes a share of both, at a per-market rate. The treasury takes its own share of both, at a rate that covers every market. The vault keeps what the two did not take. Each of those two shares has a ceiling of half, so the keeper and the treasury together can leave the vault nothing. A liquidation adds the liquidation fee to the amount the three divide.

The borrowing interest divides two ways. The treasury takes its share of it, the keeper takes none, and the vault keeps the rest.

What the vault keeps is yield for the liquidity providers who deposited it. The vault is the counterparty on the other side of your trade. It also pays out your profit, and it absorbs a loss too large for your margin to cover.

## Costs that run over time

An open position carries two more costs, and both accrue with time rather than at a fill. Borrowing interest falls on the crowded side of the market. Funding moves between longs and shorts with the market's imbalance. The market settles each the next time your position changes. For the borrowing rate and what it charges, see [Borrowing interest](./borrowing-interest.md). For the funding rate and which side pays it, see [Funding rate](./funding-rate.md).
