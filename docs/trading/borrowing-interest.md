---
sidebar_position: 4
title: Borrowing Interest
---

# Borrowing Interest

When you hold a leveraged position on Zenex, you are drawing on the vault's capacity to back your exposure. Borrowing interest is the cost of that capacity. It accrues continuously over the lifetime of your position and is settled at each fill.

Both sides of the market pay borrowing interest. Long and short open interest alike reserve vault capacity, so a long position and a short position accrue borrowing at the same rate. This is different from funding, which is a transfer between the two sides. Borrowing is a cost that flows from traders to the vault regardless of which side you are on.

## How the Rate Is Determined

The borrowing rate follows a kink model driven by vault utilization. Utilization measures how much of the vault's lendable capacity the market's open interest is currently reserving:

$$
u = \frac{reserved}{maxUtilOpen \times vaultBalance}
$$

Here `reserved` is the capacity locked up by open positions on both sides, and `maxUtilOpen` is the share of the vault that may be committed to open positions. Utilization is clamped between 0 and 1.

The rate has two regimes separated by a target utilization (the kink):

- Below the target, the rate rises gently in proportion to utilization, scaled by the base borrow rate.
- Above the target, an additional term kicks in that climbs more steeply, so that at full utilization the rate reaches the higher stressed borrow rate exactly.

The base borrow rate, the stressed borrow rate, and the target utilization are all set per market by governance. The design keeps borrowing cheap while the vault has ample spare capacity and makes it climb sharply as the market approaches full utilization, protecting the vault from becoming overextended.

## How It Accrues

Borrowing interest accrues every second against the open interest the position reserves. The protocol tracks a cumulative borrowing index, and your position records a snapshot of that index each time it changes. The difference between the current index and your snapshot determines the borrowing you owe, and it is settled out of your collateral at the next fill. A market with no open interest reserves nothing and accrues no borrowing.

Because it accrues continuously, longer-held positions accumulate more borrowing interest. This is one of the key costs to monitor when holding leveraged positions over extended periods.
