---
title: Fees
sidebar_position: 5
---

# Fees

A fill pays up to five charges. Two of them, the trade fee and the impact fee, scale with the size the fill moves. The execution fee is one flat amount per order. Borrowing interest and any funding you owe settle on every fill. Each transaction you sign also pays a network fee. This page itemizes each charge, says who pays it and when, and says where it goes. The [Keepers](../keepers.md) page describes the keeper that submits a fill.

## Costs come out of your margin, and profit pays first on a close

The market computes the trade fee and the impact fee at the fill, from the market's rates and the book at that moment. On an open, both come out of the margin you posted with the order. If they are larger than that margin, the rest comes out of the margin already behind the position. On a close, your realized profit pays them first, and the margin behind the position pays what the profit did not cover. The borrowing interest and any funding you owe come off the same way.

Each market sets its two trade fee rates, its execution fee, how fast its impact fee grows, and its keeper share. The treasury share is one rate held by the treasury, not by the market. The protocol caps each trade fee rate at 1% of the size a fill moves and caps the impact fee at 10% of that size. For how a value changes, see the [parameter-change process](../governance.md). For the values in use, see [Market parameters](../markets/market-parameters.md#current-testnet-values).

## The trade fee is lower on the thinner side

The trade fee applies to the size a fill moves, on an open and on a close alike. A fill that only adds or removes collateral moves no size and pays no trade fee.

Each market carries two trade fee rates, and your fill can pay both. The higher rate applies to the part of the fill that pushes long and short exposure further apart. The lower rate applies to the part that brings them closer together. The market weighs the tokens held long against the tokens held short, so a price move alone never decides which side is crowded.

A fill that adds to the crowded side pays the higher rate on its whole size. A fill out of a balanced book pays the higher rate too, whichever side it takes. A fill that brings the two sides closer together pays the lower rate, and a close on the crowded side is such a fill. If your fill carries the book past balance onto the other side, the two rates divide it. The part that runs the imbalance down to zero pays the lower rate, and the part beyond zero pays the higher rate. The gap between the two rates makes the thinner side cheaper to take.

The rates in this example are an illustration and not rates in use. Take a market with a higher rate of 0.10% and a lower rate of 0.04%. Longs hold 2,000 USDC more than shorts at the fill price.

| Your fill | Part at the higher rate | Part at the lower rate | Trade fee |
| --- | --- | --- | --- |
| Open a long of 5,000 USDC | 5,000 USDC | 0 | 5.00 USDC |
| Open a short of 1,000 USDC | 0 | 1,000 USDC | 0.40 USDC |
| Open a short of 5,000 USDC | 3,000 USDC | 2,000 USDC | 3.80 USDC |
| Close 1,000 USDC of a long | 0 | 1,000 USDC | 0.40 USDC |
| Close 1,000 USDC of a short | 1,000 USDC | 0 | 1.00 USDC |

The third row carries the book past balance. The first 2,000 USDC runs the imbalance to zero, and the other 3,000 USDC lands on the short side.

## The impact fee grows with the square of the size

Every fill that moves size pays the impact fee on the full size of the fill, whichever way the fill moves the balance. The rate grows with the size, so the fee grows faster than the size does. Below the ceiling, double the size of a fill and the fee is four times as large. The rate stops at 10% of the fill, and above that point the fee grows in step with the size. Each market sets how fast the rate grows.

The numbers below are an illustration and not a rate in use. Take a market where a 1,000 USDC fill pays 10 USDC.

| Size of the fill | Impact fee | Rate on the fill |
| --- | --- | --- |
| 1,000 USDC | 10 USDC | 1% |
| 2,000 USDC | 40 USDC | 2% |
| 5,000 USDC | 250 USDC | 5% |
| 10,000 USDC | 1,000 USDC | 10% |
| 20,000 USDC | 2,000 USDC | 10% |

An order fills in one piece, so the fee follows the whole size the fill moves. That size is the size your order asks for, unless a decrease closes your position in full. The fee then follows the whole position, and [Positions](./positions.md) says which decreases close in full. Below the ceiling, several smaller orders pay less impact fee in total than one large order. In the table, two fills of 5,000 USDC pay 500 USDC together, and one fill of 10,000 USDC pays 1,000 USDC. Once every part sits at or above the ceiling, a split saves nothing.

## The execution fee is flat and goes to the keeper

Each order carries one flat execution fee, and each market sets the amount. You escrow it when you create the order, on top of any margin you post. [Orders](./orders.md) gives what each kind of order escrows. The market copies the fee in force at creation into the order, so a later change to the market's fee leaves a resting order alone.

A fill pays the fee in full to the keeper. Whoever submits the fill names the account that receives it. If you cancel the order, you get the fee back in full. A full close of the position also cancels a resting decrease order and refunds its fee, as [Positions](./positions.md) describes.

A liquidation and a forced close under auto-deleveraging consume no order, so neither carries an execution fee. For what the liquidation fee is and what it costs you, see [Liquidation](./liquidation.md).

## The network fee is paid in the token you trade with

Every transaction you sign costs a network fee. The token you trade with pays it, so you do not need to hold the network's own asset. Your signature names that token, names the account that receives the fee, and fixes a ceiling on the amount. A relayer sends your signed transaction to the network. The relayer picks the amount inside your ceiling. A fee above your ceiling fails the whole transaction.

**A transaction that fails as a whole charges you nothing.** A transaction that creates your order and lands, but whose fill fails, still charges the network fee. The order rests.

## Fees divide between the keeper, the treasury, and the vault

The trade fee and the impact fee divide three ways at the fill. The keeper takes a share of both at the market's rate. The treasury, the contract that collects the protocol's share, takes its own share of both. The vault keeps the rest. A liquidation adds the liquidation fee to the amount the three divide. The borrowing interest divides two ways. The treasury takes its share, the keeper takes none, and the vault keeps the rest.

| Charge | Keeper | Treasury | Vault |
| --- | --- | --- | --- |
| Trade fee and impact fee | A share | A share | The rest |
| Liquidation fee | A share | A share | The rest |
| Execution fee | All of it | None | None |
| Borrowing interest | None | A share | The rest |
| Funding you pay | None | None | None |
| Network fee | None | None | None |

Funding you pay is banked for the traders on the earning side of the market, who claim it as credit. See [Funding rate](./funding-rate.md) and [Claimable credit](./claimable-credit.md). The network fee goes to the account your signature names.

Each of the two shares has a ceiling of half, so the keeper and the treasury together can leave the vault nothing. What the vault keeps is yield for the liquidity providers who deposited into it. The vault is the counterparty on the other side of your trade. It also pays out your profit, and it absorbs a loss too large for your margin to cover.

## Interest and funding accrue between fills

An open position carries two more costs, and both accrue with time and not at a fill. Borrowing interest falls on the crowded side of the market. Funding moves between longs and shorts with the market's imbalance. The market settles each the next time a fill changes your position. For the borrowing rate and what it charges, see [Borrowing interest](./borrowing-interest.md). For the funding rate and which side pays it, see [Funding rate](./funding-rate.md).

## What this means for you

An open takes its fees out of your margin at once. The margin behind a new position is the margin you posted less those costs. The trade fee and the impact fee follow the size and the imbalance at the moment of the fill. The rate your fill pays can differ from the rate you saw when you signed. A cancel returns your execution fee in full, and only the network fee stays spent.
