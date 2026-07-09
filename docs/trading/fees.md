---
sidebar_position: 3
title: Fees
---

# Fees

Every fill on Zenex settles four itemized costs out of your collateral: the trade fee, the impact fee, borrowing interest, and funding. Two of them (borrowing and funding) accrue continuously over the life of a position and are covered on their own pages. The trade fee and impact fee are charged at each fill. Together these costs compensate the vault, reward the keepers that run the protocol, fund the treasury, and keep long and short exposure balanced.

Because every cost is subtracted from your posted collateral at the moment of the fill, a later change to fee rates can never break an order you already signed. If the collateral you post cannot cover the fees and the margin requirement at the fill, the fill is rejected and the order simply rests until it can fill or expires.

All rates described below are set per market by governance and may change over time. Current values for each supported market can be found [here](../markets/supported-assets.md).

## 1. Trade Fee (skew-split)

The trade fee is charged on every fill and is split by how your trade affects the market's balance. The market compares the total long size and total short size (measured in tokens). The leg of your trade that pushes those two further apart is the worsening leg, and the leg that brings them closer is the improving leg.

- The worsening leg pays the higher, dominant-side rate.
- The improving leg pays the lower, non-dominant rate.

A trade that lands entirely on the crowded side pays the higher rate on its whole notional, while a trade that helps balance the book pays the lower rate. This makes it slightly cheaper to take the underrepresented side and encourages balance between long and short open interest. Which side is dominant is decided by the token imbalance, not by notional.

## 2. Impact Fee

The impact fee reflects the cost that a large trade would impose on pricing in a traditional order book. It is charged only on the worsening leg, the part of a trade that pushes the book further out of balance. Trades that balance the book do not pay it.

The fee scales with the worsening notional: it is the worsening notional divided by the market's impact divisor, a value set per market by governance since liquidity conditions differ from one market to the next.

For example, a market with an impact divisor of 1,000 charges an impact fee of 10 USDC on a trade whose worsening leg is 10,000 USDC. A worsening leg twice as large pays twice the fee, so larger imbalancing trades pay proportionally more, which discourages oversized one-sided positions and protects vault depositors from the risk they create.

## 3. Borrowing and Funding

In addition to the per-fill fees above, an open position carries two continuous costs.

Borrowing interest is charged on open interest and is paid by both sides, since long and short exposure alike reserve vault capacity. Its rate follows a kink model tied to vault utilization. See [Borrowing Interest](./borrowing-interest.md).

Funding is a transfer between longs and shorts driven by the market's imbalance. It is a net cost to the crowded side and a credit to the other side, and unlike the other costs it is not deducted automatically as profit: earned funding accrues to a claimable balance you withdraw separately. See [Funding Rate](./funding-rate.md).

## 4. Keeper Reward and Treasury Cut

The fees you pay are shared among the parties that keep the market running.

The keeper that submits the price and executes your fill receives a cut of the trade fee (base plus impact), a rate set per market by governance. This is what pays permissionless keepers to fill orders, run liquidations, and perform auto-deleveraging.

The treasury takes its own cut of the trade fee and of the borrowing fee (and of any forfeited remainder on a hard liquidation). The treasury rate is read from the treasury contract and bounded by the protocol.

Whatever remains after the keeper and treasury cuts is retained by the vault as yield for liquidity providers, and the vault is also what funds realized profit and absorbs any bad debt.
