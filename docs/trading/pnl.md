---
sidebar_position: 4
title: PnL
---

# PnL calculations

PnL ("profit and loss") measures how much you have gained or lost on a position as the market moves. It updates continuously and is the primary indicator of trade performance. It is also an important metric in the context of [liquidations](./liquidation.md), which is why this section will briefly elaborate on the subject.

**How to calculate PnL**

After you open a long or short position, your PnL updates continuously as the market moves. PnL turns positive when price moves in your favor and negative when it moves against you. Concretely: your PnL is the amount you receive upon closing your position, if it is negative, it is taken out of the collateral of the position.

The generic formula's to calculate a position's PnL are as follows:

$$
PnL Long = \frac{currentPrice - openPrice}{openPrice} * notionalSize
$$

$$
PnL Short = \frac{openPrice - currentPrice}{openPrice}*notionalSize
$$

The notional size is equal to the position's collateral multiplied with its leverage.

**Example**

The workings of the PnL definition described above can be illustrated with an example: A user opens a long with a notional size of \$10.000 on XLM, a 10% price increase yields a \$1000 gain, which means the PnL is now \$1000. If the price then decreases with 15%, PnL goes to -\$500. This means upon closing the position, the user receives a payout of the collateral minus \$500,-.
