---
title: Glossary
sidebar_position: 4
---

# Glossary

A short definition of every term the rest of this documentation uses. Each entry names the page that carries the mechanism in full.

## Markets and prices

| Term | Meaning | Covered in |
| --- | --- | --- |
| Market | One asset pair, run by two contracts deployed together: the market itself and its vault. Each market has its own price stream and parameters. | [Markets](../markets/overview.md) |
| Settlement token | The token a market takes as collateral and pays out in. Every fee in that market is charged in it. | [Markets](../markets/overview.md) |
| Base asset | The asset whose price a market tracks. A position records the amount of the base asset your size bought, and the imbalance between the two sides counts in that amount. | [Profit and loss](../trading/pnl.md) |
| Price report | The signed quote from a market's price stream that a keeper submits with the call it runs. | [Prices](../markets/prices.md) |
| Oracle | The contract that checks each price report and refuses one that is stale, wrongly signed, or off the market's stream. | [Prices](../markets/prices.md) |
| Bid and ask | The two prices a report carries. You open on one side of the quote and close on the other. | [Prices](../markets/prices.md) |
| Spread | The distance between the bid and the ask. The oracle narrows it, and what is left is a cost on every round trip. | [Prices](../markets/prices.md) |
| Settlement price | The flat price that the owner of a delisted market can fix. Every fill in that market then runs at it. | [Market status](../markets/status.md) |
| Ledger | The batch of transactions the network settles together. An order expiry counts in ledgers and not in clock time. | [Prices](../markets/prices.md) |
| Keeper | Any account that submits a signed price report to fill a trade order, to fill a vault order, to liquidate a position, or to deleverage a side. Each of those calls pays a reward. | [Keepers](../keepers.md) |
| Active | The market state in which every action runs. | [Market status](../markets/status.md) |
| On ice | The market state that stops every fill which opens a position or adds size. Every other action runs. | [Market status](../markets/status.md) |
| Frozen | The market state that halts every action, for you and for the keepers. | [Market status](../markets/status.md) |
| Delisted | The state that winds a market down. New size stops, and a clock runs toward a forced close of what is left. | [Market status](../markets/status.md) |
| Retired | The end state of a market. A claim, a cancel, and a redeem stay open, and nothing else runs. | [Market status](../markets/status.md) |

## Orders and positions

| Term | Meaning | Covered in |
| --- | --- | --- |
| Order | A signed request to change one side of your position. It carries the size, the margin, an expiry, and the terms a fill must meet. | [Orders](../trading/orders.md) |
| Fill | The moment a keeper runs one of your orders against a signed price. An order fills in one piece, and the fill settles every cost of the change it makes. | [Orders](../trading/orders.md) |
| Increase and decrease | The two order families. An increase adds size or margin to a side, and a decrease removes size or margin from it. | [Orders](../trading/orders.md) |
| Trigger price | The level the price must cross before a keeper can fill a limit order or a stop order. | [Orders](../trading/orders.md) |
| Price bound | The worst price you accept on a fill. A fill outside it is refused, and your order keeps resting. | [Orders](../trading/orders.md) |
| Expiry | The last ledger at which a keeper can fill your order. Your escrow stays with the market until you cancel. | [Orders](../trading/orders.md) |
| Take profit and stop loss | Decrease orders that rest against a position with a trigger. A full close cancels them and refunds their escrow. | [Orders](../trading/orders.md) |
| Escrow | The funds the market holds against your order from the moment you sign it. A cancel returns them in full. | [Orders](../trading/orders.md) |
| Position | Your open exposure on one side of one market. You hold at most one long and one short in a market. | [Positions](../trading/positions.md) |
| Size | The exposure a position carries on one side of a market, counted in the token that market settles in. A fill that adds size takes its fees from the collateral you post, so the margin behind your size is less than that collateral. | [Positions](../trading/positions.md) |
| Entry price | What the size you hold cost, divided by that size. A fill that adds size blends the price of that fill into it. A close leaves it where it is. | [Profit and loss](../trading/pnl.md) |
| Decrease lock | A short window that follows a fill that adds size. While any of your size is locked, a full close is refused, and a partial close can take no more than the unlocked part. A later fill that adds size adds to the locked amount and restarts the window. | [Positions](../trading/positions.md) |
| Minimum order size | The least size, and the least margin, that an order can carry. An order under either floor is refused. | [Market parameters](../markets/market-parameters.md) |
| Minimum position size | The least size a position can hold. A decrease that would leave less closes the position in full, and a forced close respects the same floor. | [Positions](../trading/positions.md) |
| Open interest | The total size of all positions on one side of a market. Each market caps it. | [Margin and leverage](../trading/margin-and-leverage.md) |
| Imbalance | The gap between the two sides, measured in the base asset. It steers the trade fee and the funding rate. | [Funding rate](../trading/funding-rate.md) |

## Margin and risk

| Term | Meaning | Covered in |
| --- | --- | --- |
| Margin | The collateral behind one position. Fees, funding, and borrowing come out of it, and it is the most that position can lose. | [Margin and leverage](../trading/margin-and-leverage.md) |
| Leverage | The size of a position measured against the margin behind it. | [Margin and leverage](../trading/margin-and-leverage.md) |
| Initial margin | The share of your size that your posted collateral must cover, measured on the position a change leaves behind. It fixes the leverage ceiling of the market. | [Margin and leverage](../trading/margin-and-leverage.md) |
| Maintenance margin | The lower share of your size that your equity must cover. Equity under that line makes the position liquidatable. | [Margin and leverage](../trading/margin-and-leverage.md) |
| Equity | What a position would return if it closed now. It is your margin, plus or minus your unrealized profit and loss, less the costs the close settles. | [Margin and leverage](../trading/margin-and-leverage.md) |
| Unrealized profit and loss | The gain or loss your open position carries at the current price. It is a mark, not a payout. | [Profit and loss](../trading/pnl.md) |
| Pending profit | The profit a whole side of a market carries at the current price, before any of it is paid out. It arms auto-deleveraging, sets the profit cap, and gates a vault redeem. | [Profit and loss](../trading/pnl.md) |
| Profit cap | The limit on what one side collects from the vault at a single close. While that side runs far ahead, a winner is paid a scaled-down profit. The market measures the limit again at each close. | [Profit and loss](../trading/pnl.md) |
| Liquidation | The forced close of a whole position whose equity falls under the maintenance margin. The market charges a liquidation fee and returns what is left to you. | [Liquidation](../trading/liquidation.md) |
| Liquidation price | The price at which your equity reaches the maintenance margin. Costs move it toward your entry price for as long as you hold. | [Liquidation](../trading/liquidation.md) |
| Auto-deleveraging (ADL) | The forced reduction of a winning position on a side whose pending profit has grown too large against the vault. The keeper names the amount. A request that reaches your size, or that would leave less than the minimum position size, closes the position in full. | [Auto-deleveraging](../trading/adl.md) |
| Bad debt | The part of a loss and its costs that the margin behind a position could not cover. The vault absorbs it. | [Liquidation](../trading/liquidation.md) |

## What a position costs

| Term | Meaning | Covered in |
| --- | --- | --- |
| Trade fee | The fee on every fill that moves size. The part of a fill that pushes the two sides further apart pays the higher of the market's two rates. | [Fees](../trading/fees.md) |
| Impact fee | A second fee on every fill that moves size. Its rate grows with the size, up to a ceiling of one tenth of the size that fill moves. | [Fees](../trading/fees.md) |
| Execution fee | A flat amount you escrow with every order. It pays the keeper that fills the order, and a cancel returns the fee. | [Fees](../trading/fees.md) |
| Funding | A payment that passes between longs and shorts. The rate builds toward the crowded side over time, so the side that pays can lag the crowd. | [Funding rate](../trading/funding-rate.md) |
| Borrowing interest | A charge that runs with time on the side that holds more of the asset, for the vault liquidity that side reserves. | [Borrowing interest](../trading/borrowing-interest.md) |
| Claimable credit | One balance in your name that holds the funding you earn and any payout the market could not send. A claim pays the smaller of that balance and the market's credit pool, the one reserve that backs every claim in that market. Any remainder stays claimable. | [Claimable credit](../trading/claimable-credit.md) |
| Network fee | The relayer's charge for sending your transaction, taken in the token you trade with. Your signature fixes the token and a ceiling, and the relayer picks the amount under that ceiling. | [Fees](../trading/fees.md) |

## The vault

| Term | Meaning | Covered in |
| --- | --- | --- |
| Vault | The pool of liquidity that backs every position in one market. It pays the winners there and keeps the losses. | [Vault](../vault/overview.md) |
| Share | A claim on a vault. A deposit mints shares and a redeem burns them. Shares transfer freely. | [Vault](../vault/overview.md) |
| Share value | What one share converts at, which counts the vault balance and the pending profit and loss of the open positions. | [Share value](../vault/share-value.md) |
| Vault order | A deposit or a redeem that you escrow up front and a keeper fills in one piece. | [Deposits and redeems](../vault/depositing.md) |
| Vault fee | The fee that a deposit fill or a redeem fill takes from the assets it moves. | [Deposits and redeems](../vault/depositing.md) |
| Minimum received | The least you accept from a vault order, counted after the vault fee. A fill that would return less is refused, and the order keeps resting. | [Deposits and redeems](../vault/depositing.md) |
| Redeem cooldown | The wait that a redeem order serves before any keeper can fill it. | [Deposits and redeems](../vault/depositing.md) |
| Utilization | The share of its own capacity that one side reserves, which sets the borrowing rate that side pays. The capacity is a set share of half the vault balance. | [Borrowing interest](../trading/borrowing-interest.md) |

## Roles

| Term | Meaning | Covered in |
| --- | --- | --- |
| Owner | The account or contract that holds the parameters, the state, and the code of one market. Each market answers to its own owner. | [Governance](../governance.md) |
| Timelock | A contract that can own a market and takes each change through a public queue and a fixed wait. A change of the market's state is the exception and reaches the market at once. | [Governance](../governance.md) |
| Relayer | The party that sends your signed transaction to the network and takes the network fee for it. | [Fees](../trading/fees.md) |
| Treasury | The contract that takes the protocol's share of the fees a market charges. | [Fees](../trading/fees.md) |
| Referrer and referee | A referee is a trader you bring to Zenex, and you are the referrer of that account. One referrer holds for the life of an account. | [Referrals](../referrals.md) |
