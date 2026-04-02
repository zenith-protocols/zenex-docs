---
sidebar_position: 5
title: Funding Rate
---

# Interest (Funding Rate)

The funding rate is a peer-to-peer fee where one side pays the other based on the current market imbalance. It is comparable to the hourly funding rate in traditional perpetual exchanges. The funding rate ensures that the dominant side (more open interest) compensates the minority side, encouraging balanced markets.

The protocol uses a single global base funding rate (`r_funding`) that applies to all markets. From there, rates are adjusted dynamically based on each market's long/short imbalance.

## Long/Short Correction

If the notional value of all long positions significantly exceeds that of the shorts (or vice versa), the interest rate adjusts to incentivize a more balanced market. For example; the more longs dominate, the more negative the hourly rate for shorts becomes, and the more positive the hourly rate for longs becomes. This way users are encouraged to open shorts instead of longs. When the market is extremely one-sided this opens up an arbitrage opportunity for users: they could secure a net profit by entering the subsidized (negative-carry) leg and hedging the opposite risk at a lower cost. Overall this dynamic helps align long and short exposure, reducing risk for the vault.

The funding rate is recalculated hourly via the permissionless `apply_funding()` function, but accrues continuously between updates. The rate paid by the dominant side is fixed for the hour, while the receiving side's effective rate adjusts continuously as the OI ratio changes.

The base funding rate is calculated as:

$$
fundingRate = r\_funding \times \frac{|notionalLongs - notionalShorts|}{notionalLongs + notionalShorts}
$$

The rate is naturally bounded in `[-r_funding, +r_funding]`. A fully one-sided market produces a rate equal to `r_funding`, while a perfectly balanced market produces zero.

For the paying (dominant) side, the delta per unit is applied directly. For the receiving (minority) side, the delta is scaled by the OI ratio so that total paid equals total received. This makes funding purely peer-to-peer — 100% flows between longs and shorts with no protocol cut.

**Example:** If longs have a notional of 80 and shorts have a notional of 20:

$$
fundingRate = r\_funding \times \frac{|80 - 20|}{80 + 20} = r\_funding \times 0.6
$$

Longs pay this rate per unit per hour. Shorts receive `fundingRate × (80 / 20) = fundingRate × 4` per unit per hour. The total paid by longs equals the total received by shorts.

If shorts increase to 40, the receiving rate adjusts to `fundingRate × (80 / 40) = fundingRate × 2` per unit. The paying rate remains fixed until the next hourly update.
