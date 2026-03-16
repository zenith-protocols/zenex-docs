---
sidebar_position: 6
title: Fees
---

# Fees

Zenex uses four core position costs: the base fee, price impact fee, borrow fee, and a side-to-side interest payment between longs and shorts. Together, these mechanisms help compensate liquidity providers, discourage excessive imbalance, and keep markets healthy.

Positions on the dominant side of the market pay higher costs, while positions on the non-dominant side benefit from lower fees and receive interest from the dominant side, similar to a funding mechanism on traditional perpetual exchanges.

All parameters described below are initial values and may be updated by the DAO over time.

### **1. Base Fee**

The base fee is charged when a position is opened and again when it is closed.

Initially, the base fee is set to:

- 0.04% for positions on the non-dominant side of the market

- 0.06% for positions on the dominant side of the market

This fee structure helps encourage balance between long and short open interest by making it slightly more expensive to trade on the crowded side of the market.
### **2. Price Impact Fee**

The price impact fee is designed to reflect the cost that large trades would impose on market pricing in a traditional order book environment.

It is charged when opening or closing a position if that action increases market imbalance. The fee scales with position size, which discourages oversized positions and further one-sided positioning. This is especially important for protecting vault depositors from the additional risk created by imbalanced markets.

The price impact fee is calculated as:

$$
PriceImpactFee = \frac{NotionalSize}{PriceImpactScalar}
$$

Because liquidity conditions differ per pair, the PriceImpactScalar is set separately for each market. Current values for each supported pair can be found [here](../markets/supported-assets.md).

### **3. Borrow Fee**

The borrow fee is a time-based fee paid when a position is closed. It accrues continuously over the lifetime of the position, but only applies to positions on the dominant side of the market.

This makes it more expensive to maintain the side of the book that creates imbalance. As utilization rises, the borrow fee rises as well.

The borrow fee rate is defined as:

$$
BorrowFeeRate = BaseBorrowFeeRate + VariableBorrowFeeRate * Util^{5}
$$

With:

$$
Utilization = \frac{OpenPnL}{VaultBalance}
$$

Utilization represents the share of vault liquidity that would be required to pay out all currently open positions if they were closed immediately.

When utilization is near 0, the borrow fee is close to the **BaseBorrowFeeRate**. As utilization increases toward 1, the fee rises along an exponential curve until it reaches:

$$
BaseBorrowFeeRate + VariableBorrowFeeRate
$$

Unlike the PriceImpactScalar, which is configured individually for each market, the **BaseBorrowFeeRate** and **VariableBorrowFeeRate** are global protocol parameters. They are not set on a per-market basis and therefore apply equally across all trading pairs. At launch, these parameters are set to:

$$
BaseBorrowFeeRate = 0.45
$$

$$
VariableBorrowFeeRate = 0.55
$$
