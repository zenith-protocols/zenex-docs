---
title: Market parameters
sidebar_position: 4
---

# Market parameters

Every market carries one set of values that decides what you pay and how much risk you may take. The owner of that market sets them, and each market sets its own. Two markets on the same pair can charge different fees and cap leverage at different points. This page groups the values a market carries, says what each group does to your money, and points to the page that covers the mechanism.

The contract that holds a value is the authority on it. The market holds its own set, and the market owner replaces that whole set in one call. The protocol fee share sits on the treasury contract, and the price settings sit on the price feed contract. Each of those two contracts has its own owner. The protocol bounds each value and fixes the order between related ones, so a fee rate can never pass its ceiling. Some values carry a floor and no ceiling, among them the size caps and the cap on the vault balance. Any figure on this page can therefore be out of date. For who makes such a change, and how much warning you get, read [Governance](../governance.md).

## Size and leverage

The initial margin is the share of your position size that you must hold as collateral, and it fixes the leverage ceiling of the market. The market measures that line on the collateral you posted, and it checks the line whenever you change your position. An auto-deleveraging close is the one exception. The market does not hold the position that close leaves behind to that line. An unrealized loss never carries you across the line. The fees of a fill come out of the collateral you post, so the leverage you reach sits a little under the ceiling. The maintenance margin is the lower line that marks liquidation, and it reads your equity, which does count your unrealized profit and loss. The liquidation fee is the rate a liquidation charges on the size that closes. Read [Margin and leverage](../trading/margin-and-leverage.md) for the two lines, and [Liquidation](../trading/liquidation.md) for what that close costs.

Five more values bound what you can hold. A market sets the smallest and the largest size for one position. It caps the total size that all positions on one side can reach. It also sets a floor on the size and on the collateral that one order may move.

## Trade and impact fees

A market carries two trade fee rates. One applies to the part of a fill that pushes the two sides further apart. The other applies to the part that brings them together, and it is never the higher of the two. Each market also sets how fast the impact fee grows with the size of a fill, tuned to the liquidity of the asset. A flat execution fee rides on every order you create, a vault order included. The market holds that fee from the moment you create the order, and the keeper that fills the order takes it in full. A cancel returns it to you. An order that reaches its expiry stops filling, and your cancel is still what releases the fee. A keeper share sets how much of the trade fee, the impact fee, the liquidation fee, and the vault fee reaches that keeper. Read [Fees](../trading/fees.md) for what each charge does and where it goes.

The share of fees that goes to the protocol treasury is one rate, set on the treasury contract that the market names. It covers the same four charges as the keeper share, and the borrowing charge as well. The owner of that treasury changes it, and it stands outside the market's own set.

## Borrowing and utilization

Each side of a market may reserve a capped share of its half of the vault balance. That cap does two jobs. It refuses an increase that would carry a side past its share, and it is the capacity that the side's borrowing rate is measured against. A second cap, never the lower of the two, governs a redeem, so liquidity stays behind the positions the vault backs.

The borrowing curve itself is three values. The first is the utilization where the curve bends. The second is the slope of the rate below the bend, and the third is the rate at full utilization. The charge starts at nothing on an unused side and climbs with that side's utilization. Read [Borrowing interest](../trading/borrowing-interest.md) for who pays and what the curve costs you.

## Funding

Funding moves between the two sides of a market, and six values steer it. Two speeds set how fast the rate builds toward the crowded side and how fast it winds down. Two imbalance levels decide whether a rate that already runs toward the crowded side keeps building, holds, or winds down. A rate at zero, and a rate that runs against the crowded side, build at any imbalance. A minimum charge sets the least any payer pays. A cap bounds the rate in either direction. Read [Funding rate](../trading/funding-rate.md) for how the rate moves and which side pays it.

## Profit limits

Four values bound how far one side of a market can run ahead of the vault. Each is measured against half the vault balance. Two of them arm and clear auto-deleveraging, the backstop that closes part of a winning position without your consent, and [Auto-deleveraging](../trading/adl.md) covers it. A third scales down the profit a winner realizes while its side sits far ahead, and [Profit and loss](../trading/pnl.md) covers that haircut. The fourth blocks a redeem while pending trader profit is too large for the liquidity that would remain. Read [Deposits and redeems](../vault/depositing.md) for the refusal you see.

## Vault orders

The vault fee is two rates. The market takes one from the assets a deposit fill moves, and the other from the assets a redeem fill moves. It sets the smallest deposit it accepts and the ceiling on the total balance the vault may hold. A redeem on a retired market pays out as you create it, and it carries no vault fee and no execution fee. Read [Deposits and redeems](../vault/depositing.md) for how an order fills and why one is refused.

## Locks and wind-down windows

Two timing values delay your exit. A short window locks size you add against your own decrease. The lock is longer than the life of a price, so one price cannot open and close the same size. Read [Positions](../trading/positions.md) for how that window binds your close. The other is the cooldown that a redeem waits out before a keeper can fill it. Read [Deposits and redeems](../vault/depositing.md) for that wait.

A delisted market winds down on two windows. The first runs before the owner may set the settlement price. The second runs before any keeper may close any remaining position. The protocol fixes both, so they are the same on every market. Read [Market status](./status.md) for the wind-down and the length of each window.

## Price settings

The freshness of the price your order fills at is set on the price feed contract, not on the market. Three of its settings shape the price you get. The first is the strict age window that a fill accepts. The second is the window that a liquidation or an auto-deleveraging close accepts, and it is never the shorter of the two. The third narrows the quote before the market prices anything. It moves both sides of the quote toward the middle of the spread by that share. The owner of that feed contract changes all three. One feed contract can serve several markets, so those three values are shared. Read [Prices](./prices.md) for the price a fill uses.

## Current testnet values

The values below are the configuration recorded for the `zenex-v2-testnet-20260905` stack on 2026-09-05. That stack runs one market, the XLM market settled in USDC. The treasury share row is a setting of the treasury contract. The last two rows are settings of the price feed, and every market that feed serves gets those two values. The contracts hold the values in force at any moment.

| Parameter | Value |
| --- | --- |
| Maximum leverage | a little under 20x, from a 5% initial margin |
| Maintenance margin | 2% of the position size |
| Liquidation fee | 0.5% of the size that closes |
| Position size | 1 to 25,000 USDC |
| Total size per side | 50,000 USDC |
| Minimum per order | 1 USDC of size, and 1 USDC of collateral |
| Trade fee | 0.06% on the part of a fill that pushes the sides apart, and 0.04% on the part that brings them together |
| Impact fee | a 0.1% rate on a 10,000 USDC fill, and the rate doubles when the size doubles |
| Execution fee | 0.01 USDC per order |
| Keeper share | 10% of the trade fee, the impact fee, the liquidation fee, and the vault fee |
| Treasury share | 30% of those same four charges, and of the borrowing charge |
| Utilization cap | 80% for an increase, and 90% for a redeem |
| Borrowing curve bend | 80% utilization on the paying side |
| Borrowing curve slope | about 50% a year, which is about 40% a year at the bend |
| Borrowing interest at full utilization | about 50% a year |
| Funding cap | about 20% a year in either direction |
| Minimum funding charge | about 1% a year, whenever a side pays at all |
| Funding build-up level | a 4% imbalance |
| Funding wind-down level | a 0% imbalance |
| Funding build-up speed | at full imbalance, from nothing to the cap in about 2 hours |
| Funding wind-down speed | from the cap to nothing in about 2 days. A 0% wind-down level never selects that speed |
| Auto-deleveraging | arms at 55% of half the vault balance, and clears at 40% |
| Profit haircut | starts at 90% of half the vault balance |
| Redeem block | pending trader profit on a side above 15% of half the vault balance the redeem would leave behind |
| Vault fee | 0.1% on a deposit, and 0.25% on a redeem |
| Minimum deposit | 1 USDC |
| Vault balance cap | 100,000 USDC |
| Redeem cooldown | 1 hour |
| Lock on new size | 30 seconds |
| Price age | 10 seconds for a fill, and 60 seconds for a liquidation or an auto-deleveraging close |
| Quote narrowing | both sides of the spread move half the way to its middle |
