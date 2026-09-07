---
sidebar_position: 5
title: Borrowing Interest
---

# Borrowing Interest

When you hold a leveraged position on Zenex, you are drawing on the vault's capacity to back your exposure. Borrowing interest is the cost of that capacity. It accrues while your position is open and is settled at each fill.

Borrowing interest is charged to the dominant side of the market, the side whose positions hold more of the base asset. If longs outweigh shorts, longs pay borrowing and shorts pay none, and vice versa. When the two sides are exactly balanced, both pay, each at a rate driven by its own utilization. This is different from funding, which is a transfer between the two sides. Borrowing is a cost that flows from traders to the vault, less a protocol share that goes to the treasury.

## How the Rate Is Determined

The borrowing rate follows a kink model driven by vault utilization. Each side of the market has its own utilization. A side's utilization is how much of its lending capacity its open positions currently reserve, expressed as a percentage from 0% (nothing reserved) to 100% (fully reserved). A side's lending capacity is half of the vault, scaled by the share of the vault that may be committed to open positions.

For example, if a market allows up to 80% of the vault to back open positions and the vault holds 1,000,000 USDC, each side has a lending capacity of 400,000 USDC (80% of its 500,000 USDC half). If long positions currently reserve 200,000 USDC, the long side's utilization is 50%.

The rate has two regimes separated by a target utilization (the kink):

- Below the target, the rate rises gently in proportion to utilization, scaled by the base borrow rate.
- Above the target, an additional term kicks in that climbs more steeply, so that at full utilization the rate reaches the higher stressed borrow rate exactly.

The base borrow rate, the stressed borrow rate, and the target utilization are all per-market parameters, set through the protocol's [parameter-change process](../governance/parameter-changes.md). The design keeps borrowing cheap while the vault has ample spare capacity and makes it climb sharply as the market approaches full utilization, protecting the vault from becoming overextended. The exact rate formula is in the [technical reference](/technical/market/borrowing-rate).

## How It Accrues

Borrowing interest accrues every second while your side of the market is the one being charged. The protocol tracks a cumulative borrowing index for each side of the market, and your position records a snapshot of its side's index each time it changes. The difference between the current index and your snapshot determines the borrowing you owe, and it is settled out of your collateral at the next fill. A market with no open interest reserves nothing and accrues no borrowing.

Because it accrues over time, longer-held positions on the paying side accumulate more borrowing interest. This is one of the key costs to monitor when holding leveraged positions over extended periods.
