---
sidebar_position: 7
title: Interest
---

# Interest

The hourly borrowing rate is a fee designed to reflect the costs associated with borrowing assets within the protocol. By construction the hourly borrowing rate is peer-to-peer, with one side paying the other based on the market. One could think of it as comparable to the hourly funding rate in traditional perps exchanges. 

Each market starts with a configured base hourly rate (which can be found [here](../markets/supported-assets.md)). From there, the protocol adjusts rates dynamically based on the current long/short imbalance.

## Long/Short Correction

If the notional value of all long positions significantly exceeds that of the shorts (or vice versa), the hourly rate adjusts to incentivize a more balanced market. For example; the more longs dominate, the more negative the hourly rate for shorts becomes, and the more positive the hourly rate for longs becomes. This way users are encouraged to open shorts instead of longs. When the market is extremely one-sided this opens up an arbitrage opportunity for users: they could secure a net profit by entering the subsidized (negative-carry) leg and hedging the opposite risk at a lower cost. Overall this dynamic helps align long and short exposure, reducing risk for the vault.

The rate for the dominant side is set every hour based on the current market. During that hour, 80% of the interest paid is rebated to the opposing side, while the remaining 20% serves as yield for the vault depositors. This means that the negative hourly rate displayed in the UI is an estimate, since it continually changes as the long/short ratio changes. The positive rate displayed in the UI is **not** an estimate, and is only changed every hour.

The hourly rates are calculated as shown below. 

If longs > shorts we have:

$$
hourlyRateLong = baseHourlyRate \times \frac{|notionalLongs-notionalShorts|}{totalNotional}
$$

$$
hourlyRateShort = -0.8 \times hourlyRateLong \times \frac{notionalLongs}{notionalShorts}
$$

Conversely, when longs < shorts:

$$
hourlyRateLong = -0.8 \times hourlyRateShort \times \frac{notionalShorts}{notionalLongs}
$$

$$
hourlyRateShort = hourlyRate \times \frac{|notionalLongs-notionalShorts|}{totalNotional}
$$

Furthermore, if longs = shorts:

$$
hourlyRateLong = HourlyRateShort = baseHourlyRate
$$


**Example:** If the notional value of all short positions would be 20, and the notional value of all long positions would be 80, the longHourlyRate would be set like this:

$$
HourlyRateLong = baseHourlyRate \times 0.6
$$

The shortHourlyRate would start at:

$$
HourlyRateShort = -0.8 \times hourlyRateLong \times 4
$$

During the hour that the interest rate for longs is set, however, the short rate might change if notional shorts went up to 40:

$$
HourlyRateShort = -0.8 \times hourlyRateLong \times 2
$$
