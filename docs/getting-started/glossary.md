---
title: Glossary
description: Short definitions for the terms used throughout the reader docs.
---

# Glossary

For the full behavior, follow the linked page.

| Term | Meaning |
| --- | --- |
| [Market](../markets/overview.md) | One traded asset, settlement token, vault, and set of rules. |
| Settlement token | The token used for margin, market fees, and payouts. |
| Long | Exposure that gains when the asset price rises. |
| Short | Exposure that gains when the asset price falls. |
| [Position](../trading/positions.md) | Your open exposure on one side of one market. |
| Size | Exposure measured at entry in settlement tokens. |
| Margin | Collateral behind a position. |
| [Leverage](../trading/margin-and-leverage.md) | Position size compared with its margin. |
| Equity | What remains after the marked result and closing costs, including any profit cap. |
| Initial margin | Required posted collateral for a position you open or change. |
| Maintenance margin | Equity threshold below which the position can be liquidated. |
| [Order](../trading/orders.md) | A request to change a position, held until execution or cancellation. |
| Trigger | Price condition that makes a limit or stop order eligible. |
| Price bound | The worst execution price an order accepts. |
| Expiry | Last ledger where an order or permission can be used. |
| Ledger | A batch of changes confirmed by Stellar. |
| Escrow | Funds held by the market for a resting order. |
| Fill | Successful execution of an order. |
| [Keeper](../keepers.md) | An account that submits execution with a price report. |
| [Relayer](../account/signing.md) | A service that submits a transaction using your signed permissions. |
| Router | A contract that bundles calls and can attempt a fill. |
| Fee forwarder | A contract that collects a relay fee before it invokes the target. |
| [Session key](../account/one-click-trading.md) | A delegated key that signs eligible actions until permission ends. |
| [Bid and ask](../markets/prices.md) | The sale and purchase sides of a quote. |
| Spread | The gap between bid and ask. |
| [Funding](../trading/funding-rate.md) | Payments between the paying and receiving market sides. |
| [Borrowing interest](../trading/borrowing-interest.md) | Time-based cost of reserved vault liquidity. |
| [Claimable credit](../trading/claimable-credit.md) | Earned funding or a parked payout held in your name. |
| [Liquidation](../trading/liquidation.md) | Forced full close when equity falls below maintenance. |
| [Auto-deleveraging](../trading/adl.md) | Forced reduction on a side with excessive pending profit. |
| Profit cap | Limit that scales paid profit when a side runs above it. |
| [Vault](../vault/overview.md) | The liquidity pool backing one market. |
| Share | A token representing part of a vault. |
| Redeem | Exchange vault shares for settlement tokens. |
| Minimum received | Lowest share or token amount accepted from a vault fill, after fees. |
| [Owner](../governance.md) | The account or contract controlling administrative actions. |
| Timelock | A contract that queues ordinary administrative actions for a delay. |
