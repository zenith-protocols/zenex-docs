---
sidebar_position: 4
title: Fees
---

# Fees

An order on Zenex carries five itemized costs: the trade fee, the impact fee, borrowing interest, funding, and a flat execution fee. Two of them (borrowing and funding) accrue continuously over the life of a position and are covered on their own pages. The trade fee and impact fee are charged at each fill and come out of your collateral. The execution fee is escrowed when you create an order and goes to the keeper that fills it. Together these costs compensate the vault, reward the keepers that run the protocol, fund the treasury, and keep long and short exposure balanced.

Fees are computed at the moment of the fill from the market's current rates and deducted from the collateral escrowed with your order. If the escrowed collateral cannot cover the fees and the margin requirement, the fill is rejected and the order rests until it can fill or expires. You can cancel a resting order at any time and recover the full escrow.

All rates described below are per-market parameters and may change through the protocol's [parameter-change process](../governance/parameter-changes.md). Current values can be found in [Market Parameters](../markets/market-parameters.md#current-testnet-values).

## 1. Trade Fee (skew-split)

The trade fee is charged on every fill that changes your position size, and is split by how your trade affects the market's balance. A fill that only adds or removes collateral pays no trade fee. The market compares the total long size and total short size (measured in tokens). The leg of your trade that pushes those two further apart is the worsening leg, and the leg that brings them closer is the improving leg.

- The worsening leg pays the higher, dominant-side rate.
- The improving leg pays the lower, non-dominant rate.

A trade that lands entirely on the crowded side pays the higher rate on its whole notional, while a trade that helps balance the book pays the lower rate. This makes it slightly cheaper to take the underrepresented side and encourages balance between long and short open interest. Which side is dominant is decided by the token imbalance, not by notional.

## 2. Impact Fee

The impact fee reflects the cost that a large trade would impose on pricing in a traditional order book. Every fill that moves size pays it on the full size of the fill, and the fee rate grows with that size: doubling the fill quadruples the fee. The rate is capped at 10% of the fill's size.

How quickly the rate grows is set by the market's impact scalar, a per-market parameter tuned to the liquidity of the asset. A larger scalar means a gentler curve.

For example, a market with an impact scalar of 100,000 USDC charges 10 USDC on a 1,000 USDC fill (a 1% rate) and 40 USDC on a 2,000 USDC fill (a 2% rate). Larger fills pay a higher rate on a larger size, which discourages oversized trades and protects vault depositors from the risk they create, while splitting the same size across smaller fills over time pays less.

## 3. Borrowing and Funding

In addition to the per-fill fees above, an open position carries two continuous costs.

Borrowing interest is charged to the crowded side of the market: the side holding the larger token exposure pays, the smaller side pays nothing (a dead-even book charges both sides). The rate follows a kink model tied to how much of the vault's capacity that side reserves. See [Borrowing Interest](./borrowing-interest.md).

Funding is a transfer between longs and shorts driven by the market's imbalance. The crowded side pays it, and the payment counts against the position like any other cost. The other side earns it, and earned funding accrues to a claimable balance you withdraw separately rather than being credited to your position. See [Funding Rate](./funding-rate.md).

## 4. Keeper Reward and Treasury Cut

The fees you pay are shared among the parties that keep the market running.

The keeper that submits the price and executes your fill receives a cut of the trade fee (base plus impact) at a per-market rate, plus the flat execution fee that was escrowed with your order. The execution fee is a per-market amount, held alongside your collateral from the moment you create the order rather than deducted from your collateral at the fill, and refunded in full if you cancel. Together these two pieces are what pay permissionless keepers to fill orders. Liquidations and auto-deleveraging involve no order and carry no execution fee, so the keeper that performs them earns only the fee cut, which on a liquidation also covers a share of the liquidation fee.

The treasury takes its own cut of the trade fee, of the borrowing fee, and of the liquidation fee. The treasury rate is read from the treasury contract and bounded by the protocol.

Whatever remains after the keeper and treasury cuts is retained by the vault as yield for liquidity providers, and the vault is also what funds realized profit and absorbs any bad debt.

## 5. Network Fee

The costs above are protocol fees. Getting the transaction on-chain has its own cost, and how you pay it depends on how you sign in.

With a **smart account**, transactions ride Zenex's relay: the relay pays the XLM gas and collects a small fee in USDC instead, sized to the transaction's actual resource cost. The fee is bounded by a maximum you sign with each action, defaulting to a few cents and adjustable in settings, and a transaction whose computed fee would exceed your signed cap is refused rather than charged. In practice, Stellar's low gas costs make this fee a small fraction of a cent.

With a **browser wallet**, you sign and submit a classic Stellar transaction and pay the network fee in XLM from your own account, typically fractions of a cent. No USDC fee applies on this path.
