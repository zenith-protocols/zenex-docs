---
sidebar_position: 6
title: Fees
---

# Fees

The Zenex fee structure comprises distinct trading fees: the base fee and the price impact fee. While reading, it is important to keep in mind that all initial parameters might be subject to adjustments by the DAO later on.

### **1. Base Fee**

The base fee is a small fee to be paid for both opening and closing a trade. This fee will initially be set to 0.05% across all assets, in order to align and be competitive with similar decentralized perpetuals exchanges. The base fee is applied exclusively to the dominant market side: When long positions exceed short positions, the fee is levied only upon the opening or closing of a long position, and vice versa.

### **2. Price Impact Fee**

The price impact fee is meant to simulate the market impact that large sized notional trades would have on the price in traditional exchanges. Its implementation serves to disincentivize excessive position sizes, since this would add risk for vault depositors. The price impact fee varies per asset, as it depends on the (expected) trading volume of the asset in question. It is computed as follows:

$$
PriceImpactFee = \frac{NotionalSize}{PriceImpactScalar}
$$

The PriceImpactScalar settings for each asset can be found [here](../markets/supported-assets.md).
