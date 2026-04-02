---
sidebar_position: 3
title: Fees
---

# Fees

Zenex charges two one-time fees when opening and closing a position: the base fee and the price impact fee. Together, these fees compensate liquidity providers, discourage excessive imbalance, and keep markets healthy. Positions on the dominant side of the market pay higher fees, while positions on the non-dominant side benefit from lower costs.

In addition to these fees, positions are subject to continuous costs that accrue over time: [borrowing interest](./borrowing-interest.md) and the [funding rate](./funding-rate.md). These are covered on their own pages.

All parameters described below are initial values and may be updated through governance over time.

### **1. Base Fee**

The base fee is charged when a position is opened and again when it is closed.

Initially, the base fee is set to:

- `fee_non_dom`: 0.04% for positions on the non-dominant side of the market

- `fee_dom`: 0.06% for positions on the dominant side of the market

This fee structure helps encourage balance between long and short open interest by making it slightly more expensive to trade on the crowded side of the market.
### **2. Price Impact Fee**

The price impact fee is designed to reflect the cost that large trades would impose on market pricing in a traditional order book environment.

It is charged when opening or closing a position if that action increases market imbalance. The fee scales with position size, which discourages oversized positions and further one-sided positioning. This is especially important for protecting vault depositors from the additional risk created by imbalanced markets.

The price impact fee is calculated as:

$$
PriceImpactFee = \frac{NotionalSize}{impact}
$$

Because liquidity conditions differ per pair, the `impact` divisor is set separately for each market in the `MarketConfig`. Current values for each supported pair can be found [here](../markets/supported-assets.md).

