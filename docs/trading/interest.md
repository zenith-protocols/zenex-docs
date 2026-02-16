---
sidebar_position: 7
title: Interest
---

# Interest

The hourly borrowing rate is a fee designed to reflect the costs associated with borrowing assets within the protocol. This fee dynamically adjusts based on current market conditions, specifically the ratio between long and short positions on the asset in question.

The initial settings for the base hourly rates can be found [here](../markets/supported-assets.md). The way they are subsequently corrected based on market conditions is explained below.

## Long/Short Correction

If the notional value of all long positions significantly exceeds that of the shorts (or vice versa), the hourly rate adjusts to incentivize a more balanced market. For example; the more longs dominate, the more negative the hourly rate for shorts becomes, and the more positive the hourly rate for longs becomes. This way users are encouraged to open shorts instead of longs. When the market is extremely one-sided this opens up an arbitrage opportunity for users: they could secure a net profit by entering the subsidized (negative-carry) leg and hedging the opposite risk externally at low cost. Overall this dynamic helps align long and short exposure, reducing risk for the vault.

The hourly rate is adjusted based on the market as shown below. By construction, 80% of positive hourly fees paid by the majority side is rebated to positions on the opposing side, while the remaining 20% serves as yield for the vault depositors (liquidity providers):

If longs > shorts we have:

$$
hourlyRateLong = hourlyRate \times \frac{notionalLongs}{totalShorts}
$$

$$
hourlyRateShort = -0.8 \times hourlyRate \times \left(\frac{notionalLongs}{totalShorts}\right)^2
$$

Conversely, when longs < shorts:

$$
hourlyRateLong = -0.8 \times hourlyRate \times \left(\frac{notionalShorts}{totalLongs}\right)^2
$$

$$
hourlyRateShort = hourlyRate \times \frac{notionalShorts}{totalLongs}
$$

Furthermore, for edge cases the following applies. If:

$$
notionalLongs = notionalShorts, \text{ we have } hourlyRateLong = HourlyRateShort = baseHourlyRate
$$

$$
notionalShorts = 0 \text{ \& } notionalLongs \neq 0, \text{ } hourlyRateLong = baseHourlyRate
$$

$$
notionalLongs = 0 \text{ \& } notionalShorts \neq 0, \text{ } hourlyRateShort = baseHourlyRate
$$

**Example:** If the notional value of all short positions would be 20, and the notional value of all long positions would be 80, we would have the following hourly rates:

$$
HourlyRateLong = baseHourlyRate \times 4
$$

$$
HourlyRateShort = -0.8 \times baseHourlyRate \times 16 = -0.8 \times (HourlyRateLong \times 4)
$$
