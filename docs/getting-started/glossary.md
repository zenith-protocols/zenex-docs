---
title: Glossary
sidebar_position: 4
---

# Glossary

This page defines the terms the rest of the documentation uses. Each entry names the page that carries the mechanism in full.

## Markets and prices

| Term | Meaning | Covered in |
| --- | --- | --- |
| Market | One traded asset with its own vault, price stream, and parameters. | [Markets](../markets/overview.md) |
| Settlement token | The token a market takes as collateral and pays out in. | [Markets](../markets/overview.md) |
| Base asset | The asset whose price a market tracks. | [Markets](../markets/overview.md) |
| Price stream | The source of signed price reports that a market is bound to. | [Prices](../markets/prices.md) |
| Price report | A signed quote from the price stream, submitted by a keeper with the call it runs. | [Prices](../markets/prices.md) |
| Oracle | The contract that checks each price report before a market uses it. | [Prices](../markets/prices.md) |
| Bid and ask | The two prices a report carries. A long opens at the ask and closes at the bid, and a short the other way round. | [Prices](../markets/prices.md) |
| Spread | The distance between the bid and the ask. | [Prices](../markets/prices.md) |
| Settlement price | The flat price that the owner of a delisted market can fix for every remaining fill. | [Market status](../markets/status.md) |
| Ledger | The batch of transactions the network settles together, about every five seconds. | [Orders](../trading/orders.md) |
| Keeper | Any account that submits a price report to fill an order, liquidate a position, or deleverage a side, for a reward. | [Keepers](../keepers.md) |
| Active | The market state in which every action runs. | [Market status](../markets/status.md) |
| On ice | The market state that stops the fills which open a position or add size. | [Market status](../markets/status.md) |
| Frozen | The market state that halts every action. | [Market status](../markets/status.md) |
| Delisted | The market state that winds a market down toward a forced close. | [Market status](../markets/status.md) |
| Retired | The end state of a market, in which only claims, cancels, and redeems run. | [Market status](../markets/status.md) |

## Orders and positions

| Term | Meaning | Covered in |
| --- | --- | --- |
| Collateral | The settlement token you post with an order. | [Margin and leverage](../trading/margin-and-leverage.md) |
| Long and short | A long gains when the price rises, and a short gains when it falls. | [Positions](../trading/positions.md) |
| Order | A signed request to change one side of your position. | [Orders](../trading/orders.md) |
| Market order, limit order, and stop order | The three fill rules of an order. A market order fills at the next verified price. A limit order and a stop order rest until the price crosses your trigger. | [Orders](../trading/orders.md) |
| Fill | The moment a keeper runs one of your orders against a signed price. | [Orders](../trading/orders.md) |
| Increase and decrease | An increase adds size or margin to a side. A decrease removes size or margin from it. | [Orders](../trading/orders.md) |
| Trigger price | The level the price must cross before a keeper can fill a limit order or a stop order. | [Orders](../trading/orders.md) |
| Price bound | The worst price you accept on a fill. | [Orders](../trading/orders.md) |
| Expiry | The last ledger at which a keeper can fill your order. | [Orders](../trading/orders.md) |
| Take profit and stop loss | Decrease orders that rest against a position with a trigger price. | [Orders](../trading/orders.md) |
| Escrow | The funds the market holds against your order from the moment you sign it. | [Orders](../trading/orders.md) |
| Position | Your open exposure on one side of one market. | [Positions](../trading/positions.md) |
| Size | The exposure a position carries, counted in the settlement token. | [Positions](../trading/positions.md) |
| Entry price | The average price of the size you hold. | [Profit and loss](../trading/pnl.md) |
| Decrease lock | A short window after a fill that adds size, during which that size cannot be closed. | [Positions](../trading/positions.md) |
| Minimum order size | The least size, and the least margin, that an order can move. | [Market parameters](../markets/market-parameters.md) |
| Minimum position size | The least size a position can hold. | [Positions](../trading/positions.md) |
| Open interest | The total size of all positions on one side of a market. | [Margin and leverage](../trading/margin-and-leverage.md) |
| Imbalance | The gap between the long side and the short side of a market, measured in the base asset. | [Funding rate](../trading/funding-rate.md) |

## Margin and risk

| Term | Meaning | Covered in |
| --- | --- | --- |
| Margin | The collateral behind one position. | [Margin and leverage](../trading/margin-and-leverage.md) |
| Leverage | The size of a position measured against the margin behind it. | [Margin and leverage](../trading/margin-and-leverage.md) |
| Initial margin | The share of your size that your margin must cover after every change you make. It sets the leverage ceiling. | [Margin and leverage](../trading/margin-and-leverage.md) |
| Maintenance margin | The lower share of your size that your equity must cover before the position can be liquidated. | [Margin and leverage](../trading/margin-and-leverage.md) |
| Equity | What a position would return if it closed now. | [Margin and leverage](../trading/margin-and-leverage.md) |
| Unrealized profit and loss | The gain or loss your open position carries at the current price. | [Profit and loss](../trading/pnl.md) |
| Pending profit | The profit a whole side of a market carries at the current price. | [Profit and loss](../trading/pnl.md) |
| Profit cap | The limit on one side's pending profit, above which a close pays a scaled-down profit. | [Profit and loss](../trading/pnl.md) |
| Liquidation | The forced close of a position whose equity falls under the maintenance margin. | [Liquidation](../trading/liquidation.md) |
| Liquidation price | The price at which your equity reaches the maintenance margin. | [Liquidation](../trading/liquidation.md) |
| Auto-deleveraging (ADL) | The forced reduction of a winning position on a side whose pending profit has grown too large against the vault. | [Auto-deleveraging](../trading/adl.md) |
| Bad debt | The part of a loss that the margin behind a position could not cover. | [Liquidation](../trading/liquidation.md) |

## What a position costs

| Term | Meaning | Covered in |
| --- | --- | --- |
| Trade fee | The fee on every fill that moves size. | [Fees](../trading/fees.md) |
| Impact fee | A second fee on every fill that moves size, which grows with the size of the fill. | [Fees](../trading/fees.md) |
| Execution fee | A flat amount you escrow with every order to pay the keeper that fills it. | [Fees](../trading/fees.md) |
| Funding | A payment between longs and shorts that leans against the crowded side. | [Funding rate](../trading/funding-rate.md) |
| Borrowing interest | A charge that runs with time on the side that holds more of the base asset, at a rate that follows how much of the vault's liquidity that side reserves. | [Borrowing interest](../trading/borrowing-interest.md) |
| Claimable credit | A balance in your name that holds the funding you earn and any payout the market could not send. | [Claimable credit](../trading/claimable-credit.md) |
| Credit pool | The reserve in a market that backs every claim on claimable credit. | [Claimable credit](../trading/claimable-credit.md) |
| Network fee | The charge a relayer takes to send your transaction to the network. | [Fees](../trading/fees.md) |

## The vault

| Term | Meaning | Covered in |
| --- | --- | --- |
| Vault | The pool of liquidity that backs every position in one market. | [Vault](../vault/overview.md) |
| Liquidity provider | An account that deposits into a vault and holds its shares. | [Vault](../vault/overview.md) |
| Share | A claim on a vault. A deposit mints shares and a redeem burns them. | [Vault](../vault/overview.md) |
| Share value | What one share converts at. | [Share value](../vault/share-value.md) |
| Vault order | A deposit or a redeem, escrowed up front and filled by a keeper. | [Deposits and redeems](../vault/depositing.md) |
| Vault fee | The fee that a deposit fill or a redeem fill takes from the assets it moves. | [Deposits and redeems](../vault/depositing.md) |
| Minimum received | The least you accept from a vault order, counted after the vault fee. | [Deposits and redeems](../vault/depositing.md) |
| Redeem cooldown | The wait that a redeem order serves before any keeper can fill it. | [Deposits and redeems](../vault/depositing.md) |
| Utilization | The share of its capacity that one side of a market reserves. | [Borrowing interest](../trading/borrowing-interest.md) |

## Roles

| Term | Meaning | Covered in |
| --- | --- | --- |
| Owner | The account or contract that controls the parameters, the state, and the code of a market. | [Governance](../governance.md) |
| Timelock | A contract that can own a market and holds each change but a change of state in a public queue for a fixed wait. | [Governance](../governance.md) |
| Relayer | The party that sends your signed transaction to the network and takes the network fee for it. | [Fees](../trading/fees.md) |
| Treasury | The contract that takes the protocol's share of the fees a market charges. | [Fees](../trading/fees.md) |
| Referrer and referee | A referee is a trader you bring to Zenex, and you are the referrer of that account. One referrer holds for the life of an account. | [Referrals](../referrals.md) |
