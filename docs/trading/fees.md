---
sidebar_position: 3
title: Fees
---

# Fees

An order on Zenex carries five itemized costs: the trade fee, the impact fee, borrowing interest, funding, and a flat execution fee. Two of them (borrowing and funding) accrue continuously over the life of a position and are covered on their own pages. The trade fee and impact fee are charged at each fill and come out of your collateral. The execution fee is escrowed when you create an order and goes to the keeper that fills it. Together these costs compensate the vault, reward the keepers that run the protocol, fund the treasury, and keep long and short exposure balanced.

Fees are computed at the moment of the fill from the market's current rates and deducted from the collateral escrowed with your order. If the escrowed collateral cannot cover the fees and the margin requirement, the fill is rejected and the order rests until it can fill or expires. You can cancel a resting order at any time and recover the full escrow.

All rates described below are per-market parameters and may change through the protocol's [parameter-change process](../governance/parameter-changes.md). Current values for each supported market can be found [here](../markets/supported-assets.md).

## 1. Trade Fee (skew-split)

The trade fee is charged on every fill that changes your position size, and is split by how your trade affects the market's balance. A fill that only adds or removes collateral pays no trade fee. The market compares the total long size and total short size (measured in tokens). The leg of your trade that pushes those two further apart is the worsening leg, and the leg that brings them closer is the improving leg.

- The worsening leg pays the higher, dominant-side rate.
- The improving leg pays the lower, non-dominant rate.

A trade that lands entirely on the crowded side pays the higher rate on its whole notional, while a trade that helps balance the book pays the lower rate. This makes it slightly cheaper to take the underrepresented side and encourages balance between long and short open interest. Which side is dominant is decided by the token imbalance, not by notional.

## 2. Impact Fee

The impact fee reflects the cost that a large trade would impose on pricing in a traditional order book. It is charged only on the worsening leg, the part of a trade that pushes the book further out of balance. Trades that balance the book do not pay it.

The fee scales with the worsening notional: it is the worsening notional divided by the market's impact divisor, a per-market parameter, since liquidity conditions differ from one market to the next.

For example, a market with an impact divisor of 1,000 charges an impact fee of 10 USDC on a trade whose worsening leg is 10,000 USDC. A worsening leg twice as large pays twice the fee, so larger imbalancing trades pay proportionally more, which discourages oversized one-sided positions and protects vault depositors from the risk they create.

## 3. Borrowing and Funding

In addition to the per-fill fees above, an open position carries two continuous costs.

Borrowing interest is charged to the crowded side of the market: the side holding the larger token exposure pays, the smaller side pays nothing (a dead-even book charges both sides). The rate follows a kink model tied to how much of the vault's capacity that side reserves. See [Borrowing Interest](./borrowing-interest.md).

Funding is a transfer between longs and shorts driven by the market's imbalance. The crowded side pays it, and the payment counts against the position like any other cost. The other side earns it, and earned funding accrues to a claimable balance you withdraw separately rather than being credited to your position. See [Funding Rate](./funding-rate.md).

## 4. Keeper Reward and Treasury Cut

The fees you pay are shared among the parties that keep the market running.

The keeper that submits the price and executes your fill receives a cut of the trade fee (base plus impact) at a per-market rate, plus the flat execution fee that was escrowed with your order. The execution fee is a per-market amount, held alongside your collateral from the moment you create the order rather than deducted from your collateral at the fill, and refunded in full if you cancel. Together these two pieces are what pay permissionless keepers to fill orders. Liquidations and auto-deleveraging involve no order and carry no execution fee, so the keeper that performs them earns only the trade-fee cut.

The treasury takes its own cut of the trade fee and of the borrowing fee (and of any forfeited remainder on a hard liquidation). The treasury rate is read from the treasury contract and bounded by the protocol.

Whatever remains after the keeper and treasury cuts is retained by the vault as yield for liquidity providers, and the vault is also what funds realized profit and absorbs any bad debt.
