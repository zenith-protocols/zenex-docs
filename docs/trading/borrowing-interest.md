---
sidebar_position: 4
title: Borrowing Interest
---

# Borrowing Interest

When you open a leveraged position on Zenex, you are effectively borrowing from the vault. Borrowing interest is the cost of that loan. It accrues continuously over the lifetime of your position and is settled when the position closes.

Borrowing interest only applies to positions on the dominant side of the market, the side with more open interest. If longs outweigh shorts, long positions pay borrowing interest. If shorts outweigh longs, short positions pay. When the market is perfectly balanced, both sides pay. This creates a natural incentive to take the less crowded side of the market.

## How the Rate Is Determined

The borrowing interest rate combines three components into a single additive formula:

$$
BorrowingRate = r\_base + r\_var \times UtilVault^{5} + r\_var\_market \times UtilMarket^{3}
$$

The first component, `r_base`, is a global base rate that applies to all markets equally. It represents the minimum cost of borrowing from the vault, regardless of how much capacity is being used.

The second component scales with vault-level utilization. As the total open interest across all markets grows relative to the vault's capacity, this term increases along a steep quintic curve (raised to the power of 5). The curve is designed to be gentle when utilization is low and aggressive as it approaches full capacity. This protects the vault from becoming overextended across all markets simultaneously.

The third component scales with per-market utilization. Each market has its own utilization cap, and as a single market's open interest grows relative to that cap, this term increases along a cubic curve (raised to the power of 3). The cubic curve reacts faster than the quintic curve, which means that congestion in a single market drives up borrowing costs more quickly than broad vault-level usage does.

## Utilization

Utilization measures how much of the available capacity is currently consumed by open positions. It is calculated separately at two levels.

Vault utilization looks at the total open interest across all markets relative to the vault's global capacity. Market utilization looks at a single market's open interest relative to that market's individual capacity. Both values are clamped between 0 and 1, meaning they can never exceed 100%.

When utilization is near zero, the borrowing rate is close to the base rate. As utilization approaches 1, the exponential curves cause the rate to climb sharply. At full utilization on both levels, the maximum borrowing rate equals the sum of all three components: `r_base + r_var + r_var_market`.

## Parameters

The base rate (`r_base`) and the vault-level variable rate (`r_var`) are global parameters set in the trading configuration. They apply equally to every market on the platform.

The per-market variable rate (`r_var_market`) is configured individually for each market. This allows governance to set higher borrowing costs for markets with less liquidity or higher volatility, while keeping costs lower for deep, stable markets.

## How It Accrues

Borrowing interest accrues every second against your position's notional value. The protocol tracks cumulative borrowing indices for each market, and your position records a snapshot of the index at the time it was opened. When your position closes, the difference between the current index and your snapshot determines the total borrowing interest you owe.

Because it accrues continuously, longer-held positions accumulate more borrowing interest. This is one of the key costs to monitor when holding leveraged positions over extended periods.
