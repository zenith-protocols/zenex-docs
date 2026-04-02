---
sidebar_position: 6
title: Liquidation
---

# Liquidation

Liquidation protects the protocol from bad debt when a position no longer has enough equity to cover its risk. If your equity falls below a safety threshold, the engine will close your position to restore solvency. It is important to note that all collateral is lost in liquidation, therefore it is vital to regularly check your PnL in order to keep your position healthy in the case of market volatility (increasing collateral if necessary).

### **Liquidation threshold**

Within Zenex, the health of a position is evaluated through the liquidation threshold (`liq_fee`), a per-market configurable parameter. A position becomes eligible for liquidation when:

$$
Equity < liquidationThreshold
$$

Where:

$$
Equity = Collateral + PnL - Fees
$$

$$
liquidationThreshold = notionalSize \times liq\_fee
$$

The `liq_fee` is set per market and must always be less than the initial margin (`margin`). The gap between them is the safety buffer that absorbs PnL and fee accrual.

### Liquidation price

The liquidation price is calculated slightly differently for shorts and longs, as is shown below:

$$
liquidationPriceLong < openPrice + openPrice \times \frac{liquidationThreshold + fees - collateral}{notionalSize}
$$

$$
liquidationPriceShort > openPrice - openPrice \times \frac{liquidationThreshold + fees - collateral}{notionalSize}
$$
