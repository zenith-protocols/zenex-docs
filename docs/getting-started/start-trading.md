---
title: Start trading
description: Connect a wallet, review an order, and follow it through confirmation and execution.
---

# Start trading

Your first trade starts with a funded wallet and ends with a confirmed position. The order between those steps carries the terms you approve.

## Before you start

Open the [Zenex app](https://app.zenex.trade) and connect a supported wallet. Check its network and trading address, then fund it with the market's settlement token. Leave enough for order execution fees and transaction fees. The fee token depends on your submission mode. [Wallets and funds](../account/wallets-and-funds.md) explains the balances.

## 1. Choose a market and side

Choose the asset you want to trade. Each market sets its own fees, leverage limit, and liquidity capacity.

Choose **long** if you want exposure to a price rise. Choose **short** if you want exposure to a price fall. You can hold one of each in a market. An order on a side you already hold changes that position. Read [Positions](../trading/positions.md) for how increases combine.

## 2. Enter collateral and exposure

Enter the collateral you want to commit and the leverage you want to use. Review the resulting size, fees, and estimated liquidation price. The app accounts for estimated trading fees.

:::warning Final collateral and leverage can differ
Other trades can change which fee rate applies before your order fills. Higher fees leave less collateral and higher leverage than shown. Lower fees leave more collateral and lower leverage. See [Fees](../trading/fees.md).
:::

## 3. Set your execution terms

Choose a market, limit, or stop order. Limit and stop orders need a trigger price. For a market order, review your slippage limit. It sets the worst fill price you accept. The app's limit and stop orders have no separate slippage limit. Check the order expiry too. [Orders](../trading/orders.md) explains triggers and limits.

Take-profit and stop-loss orders are separate exit orders. Each carries its own execution fee.

:::warning A stop loss needs a fill
When the price reaches your stop, a keeper still has to execute the order. The fill can happen later and at a worse price, especially during a fast move. Until it fills, your position remains open and can still be liquidated.
:::

## 4. Review and sign

Check the market, side, size, collateral, price bound, expiry, and fees. If the app shows several actions, review each one. For a relayed action, review the fee token, fee recipient, and maximum fee. [What you sign](../account/signing.md) explains these permissions.

## 5. Follow the result

Wait for confirmation, then check both **Orders** and **Positions**. A market order may fill in the creation transaction. A limit or stop order usually rests until its trigger is met.

If the transaction confirms but the order rests, it still holds its escrow. Expired orders need cancellation to return it. For a pending result or error, use [Pending and failed transactions](../account/transactions.md).
