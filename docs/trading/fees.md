---
sidebar_position: 3
title: Fees
---

# Fees

Zenex charges two one-time fees when opening and closing a position: the base fee and the price impact fee. Together, these fees compensate liquidity providers, discourage excessive imbalance, and keep markets healthy. Only the **base fee** is direction-aware: positions on the dominant side of the market pay a higher base fee, while positions on the non-dominant side pay a lower one. The **price impact fee** is charged on every open and every close regardless of direction.

In addition to these one-time fees, positions are subject to continuous costs that accrue over time: [borrowing interest](./borrowing-interest.md) and the [funding rate](./funding-rate.md). These are covered on their own pages. A portion of trading and borrowing fees is also routed to the protocol treasury, and a share of trading fees on each action is paid to the keeper that executes it — see [Treasury Cut & Keeper Share](#3-treasury-cut--keeper-share) below.

All parameters described below are initial values and may be updated through governance over time.

### **1. Base Fee**

The base fee is charged when a position is opened and again when it is closed.

Initially, the base fee is set to:

- `fee_non_dom`: 0.04% for positions on the non-dominant side of the market

- `fee_dom`: 0.06% for positions on the dominant side of the market

This fee structure helps encourage balance between long and short open interest by making it slightly more expensive to trade on the crowded side of the market.

### **2. Price Impact Fee**

The price impact fee is designed to reflect the cost that large trades would impose on market pricing in a traditional order book environment.

It is charged on **every open and every close**, scaling linearly with notional via `notional / impact`. Unlike the base fee, this fee does not depend on whether your side is dominant or non-dominant — it is applied unconditionally. The fee scales with position size, which discourages oversized positions. This is especially important for protecting vault depositors from the additional risk created by imbalanced markets.

The price impact fee is calculated as:

$$
PriceImpactFee = \frac{NotionalSize}{impact}
$$

Because liquidity conditions differ per pair, the `impact` divisor is set separately for each market in the `MarketConfig`. Current values for each supported pair can be found [here](../markets/supported-assets.md).

### **3. Treasury Cut & Keeper Share**

Out of the trading fees collected on each action, the protocol takes a **treasury cut** (`treasury_rate`, currently 20% of protocol revenue) and pays a **keeper share** (`caller_rate`, currently 10%) to the keeper that executed the action. The remainder is retained by the vault as yield for liquidity providers. On liquidations, the keeper additionally receives a share of any residual equity above the liquidation threshold. See [Borrowing Interest](./borrowing-interest.md) and [Funding Rate](./funding-rate.md) for the continuous-cost components.

