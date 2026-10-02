---
title: Market parameters
sidebar_position: 4
---

# Market parameters

Every market carries a set of values that decides what you pay and how much risk you can take. This page groups those values, says what each group does to your money, and links to the page that explains the mechanism. The last section records the values on the testnet market.

The owner of a market sets its values, so each market has its own set. Two markets for the same asset pair can charge different fees and allow different leverage. The owner replaces the whole set in one step. Four values have other owners. The treasury owner sets the protocol's share of each fee. The oracle owner sets the price rules, and the oracle is the contract that checks each price report. [Governance](../governance.md) covers who those owners are and how much warning a change gives you.

The protocol bounds most values and keeps related ones in a fixed order, so no fee rate can pass its ceiling. The size limits and the vault balance cap have no fixed maximum, so an owner can raise them. An owner can change any value inside its bounds, so a figure on this page records one moment.

## Two margin lines set your leverage and your liquidation point

The initial margin is the share of a position's size that you must hold as collateral whenever you change the position. One divided by it is the leverage ceiling of the market. The fees of a fill come out of the collateral you post, so the leverage you reach sits a little under that ceiling.

The maintenance margin is the lower line. A position whose equity falls under it can be liquidated. Equity is what the position would return if it closed now, so it counts your unrealized profit and loss. The liquidation fee is the rate that a liquidation charges on the size that closes.

The protocol keeps the three in one order, with the liquidation fee lowest and the initial margin highest. A liquidation at the maintenance margin therefore leaves equity to return to you after the fee. Read [Margin and leverage](../trading/margin-and-leverage.md) for the two lines and [Liquidation](../trading/liquidation.md) for what that close costs.

## Size limits bound what one position and one side can hold

A market sets the smallest and the largest size for one position. It also caps the total size of all positions on one side. Two more values set the least size and the least collateral that one order may move. The minimums keep dust orders out of the book, and the caps bound the exposure that the vault must back. Read [Positions](../trading/positions.md) for how the minimum shapes a close.

## Fees combine a trade rate, an impact rate, and a flat execution fee

A market carries two trade fee rates. The higher rate applies to the part of a fill that pushes long and short exposure further apart. The lower rate applies to the part that brings them closer together.

Each market also sets how fast the impact fee grows with the size of a fill, tuned to the liquidity of the asset. Every order carries a flat execution fee that pays the keeper who fills it, and a vault order carries one too. The [Keepers](../keepers.md) page covers the keeper role.

The keeper share sets how much of the trade fee, the impact fee, the liquidation fee, and the vault fee reaches that keeper. The treasury share is one rate that takes a cut of the same four charges and of the borrowing charge. The treasury owner changes it, so it sits outside the market's own set. Read [Fees](../trading/fees.md) for what each charge does and where it goes.

## Utilization limits what a side may reserve and prices borrowing

The vault backs each side of a market with half of its balance. A market lets each side reserve up to a set share of that half, and that share is the side's capacity. Utilization is the part of its capacity that a side's open positions reserve.

The first cap applies when you add size. It refuses an increase that would carry the increased side past its share, and the same capacity is the measure for that side's borrowing rate. The second cap applies when a redeem fills. It refuses a redeem that would leave either side above it. The second cap sits at or above the first, so a side that is full for new size does not lock every redeem out. A redeem still cannot pull liquidity from under the open positions.

The borrowing curve uses three values. The first is the utilization where the curve bends. The second sets how steeply the rate climbs toward the bend. The third is the rate at full utilization. The side that holds more of the asset pays at the rate its own utilization sets, and the other side pays nothing. A tie charges both sides. Read [Borrowing interest](../trading/borrowing-interest.md) for who pays and what the curve costs you.

## Six values shape the funding rate

Funding moves value between the two sides of a market. The imbalance is how far the long and short sides differ in the asset they hold, as a share of their combined size. The crowded side is the larger one, and the funding rate builds toward it.

Two speeds set how fast the rate builds and how fast it winds down. Two imbalance levels decide whether a rate that already points at the crowded side keeps building, holds, or winds down. A minimum charge is the least any payer pays whenever a side pays at all. A cap bounds the rate in either direction. Read [Funding rate](../trading/funding-rate.md) for how the rate moves and which side pays it.

## Four profit levels protect the vault from a side that runs ahead

Pending profit is the profit that all open positions on one side carry at the current price. Four values bound how far it may run, and each is a share of half the vault balance.

Two of them govern auto-deleveraging. The upper level flags a side, and the lower level clears the flag. While the flag stands, that side takes no new size. Auto-deleveraging closes part or all of a winning position without your consent, and [Auto-deleveraging](../trading/adl.md) covers it. The third value is the level where the profit cap starts to scale down the profit that a winner realizes. [Profit and loss](../trading/pnl.md) covers that cap. The fourth value blocks a redeem while either side's pending profit sits above it, measured on the balance the redeem would leave. [Deposits and redeems](../vault/depositing.md) covers the refusal you see.

The protocol holds the four in one order. The redeem block is lowest, then the level where auto-deleveraging clears, then the level where it flags, then the profit cap. Auto-deleveraging therefore starts before the cap reduces any payout, and no permitted redeem leaves a side above the clear level.

## Vault orders carry a fee, a deposit minimum, and a balance cap

The vault fee is two rates. The market takes one from the assets a deposit fill moves, and it takes the other from the assets a redeem fill moves. The market also sets the smallest deposit it accepts and a cap on the total balance the vault may hold. A deposit that would carry the vault past the cap is refused. Read [Deposits and redeems](../vault/depositing.md) for how an order fills and why one is refused.

## Three price settings sit on the oracle and not on the market

The oracle holds three values that shape the price your order fills at. The strict age limit applies to a fill. The wider age limit applies to a liquidation and to an auto-deleveraging close. The spread narrowing sets how much of the quote's spread the oracle removes before the market prices anything. The oracle owner changes all three, and every market on that oracle shares them. Read [Prices](./prices.md) for what each one does to the price you get.

## Waiting periods delay an exit or a forced close

The decrease lock is a short window after you add size. Until it ends, you cannot close the size you added. The lock cannot be shorter than the longest strict age limit the oracle allows. One price can therefore never open and then close the same size. Read [Positions](../trading/positions.md) for how the lock binds your close.

The redeem cooldown is the wait a redeem serves before a keeper can fill it. Read [Deposits and redeems](../vault/depositing.md) for that wait.

A delisted market runs two counts from the moment of the delist. The first count decides when the owner can set a settlement price and when the owner can no longer undo the delist. The second count decides when any keeper can close any remaining position. The protocol fixes both counts, so every market runs the same two. Read [Market status](./status.md) for their length and for what each one allows.

## A change applies to what you already hold

A change by the owner applies to positions and orders that already exist. Two values are the exception because the market records them when you act. An order keeps the execution fee it carried at creation, and added size keeps the lock it received. A fee, a margin line, or a cap can therefore differ between the day you open a position and the day you close it.

## Current testnet values

The table records the configuration of the testnet-v3-20260929 stack on 2026-09-29. That stack runs one market, the market for XLM, the Stellar network's own asset, settled in USDC. The treasury share is a setting of the treasury. The last two rows hold the three price settings of the oracle, and every market on that oracle uses them. The contracts hold the values in force at any moment.

| Parameter | Value |
| --- | --- |
| Maximum leverage | a little under 20x, from a 5% initial margin |
| Maintenance margin | 2% of the position size |
| Liquidation fee | 0.5% of the size that closes |
| Position size | 1 to 25,000 USDC |
| Total size per side | 50,000 USDC |
| Minimum per order | 1 USDC of size and 1 USDC of collateral |
| Trade fee | 0.06% on the part of a fill that pushes the sides apart and 0.04% on the part that brings them together |
| Impact fee | 0.1% of the fill at a size of 10,000 USDC. The rate doubles when the size doubles. |
| Execution fee | 0.01 USDC per order |
| Keeper share | 10% of the trade fee, the impact fee, the liquidation fee, and the vault fee |
| Treasury share | 30% of those same four charges and of the borrowing charge |
| Utilization cap | 80% of half the vault balance for an increase and 90% for a redeem |
| Borrowing curve bend | 80% utilization |
| Borrowing rate | one straight line from nothing on an unused side to about 40% a year at the bend and about 50% a year at full utilization |
| Funding cap | about 20% a year in either direction |
| Minimum funding charge | about 1% a year whenever a side pays at all |
| Funding build-up level | a 4% imbalance |
| Funding wind-down level | a 0% imbalance |
| Funding build-up speed | at full imbalance, from nothing to the cap in about 2 hours |
| Funding wind-down speed | from the cap to nothing in about 2 days. No imbalance falls under a 0% level, so this speed never applies on this market. |
| Auto-deleveraging | flags a side at 55% of half the vault balance and clears the flag at 40% |
| Profit cap | starts at 90% of half the vault balance |
| Redeem block | pending profit on a side above 15% of half the vault balance that the redeem would leave |
| Vault fee | 0.1% of the assets a deposit fill moves and 0.25% of the assets a redeem fill moves |
| Minimum deposit | 10 USDC |
| Vault balance cap | 100,000 USDC |
| Redeem cooldown | 1 hour |
| Lock on new size | 30 seconds |
| Price age | 15 seconds for a fill and 60 seconds for a liquidation or an auto-deleveraging close |
| Spread narrowing | the oracle moves each side of the quote half the way to the middle of the spread |
